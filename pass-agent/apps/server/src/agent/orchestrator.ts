import {
  ApiError,
  FinishReason,
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type Part,
} from "@google/genai";
import { randomUUID } from "node:crypto";
import {
  type AgentStatus,
  type ApplicantVault,
  type HitlRequest,
  type HitlResponse,
  type ServerMessage,
  type TimelineKind,
} from "@pass-agent/shared";
import type { PlaywrightManager } from "../browser/playwrightManager";
import { buildKickoffMessage, NUDGE_USE_TOOLS, SYSTEM_PROMPT } from "./prompts";
import {
  executeTool,
  TOOL_DEFINITIONS,
  type HumanRequestInput,
  type ToolContext,
} from "./tools";

const MODEL = process.env.PASSAGENT_MODEL ?? "gemini-3.8-flash";
const MAX_STEPS = Number(process.env.PASSAGENT_MAX_STEPS ?? 80);
const MAX_NUDGES = 2;

/** Finish reasons that mean Gemini blocked or refused the turn. */
const BLOCKED_FINISH_REASONS: ReadonlySet<FinishReason> = new Set([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

export interface OrchestratorOptions {
  browser: PlaywrightManager;
  emit: (msg: ServerMessage) => void;
  client?: GoogleGenAI;
}

interface PendingHitl {
  request: HitlRequest;
  resolve: (res: HitlResponse) => void;
}

class StoppedError extends Error {
  constructor() {
    super("Session stopped");
  }
}

/**
 * Drives the Gemini function-calling loop for one applicant session.
 *
 * A single tool call can block for minutes on a human hand-off, so the loop
 * is written by hand: it must be abortable and emit timeline events between
 * every step.
 */
export class AgentOrchestrator {
  private client: GoogleGenAI | null;
  private status: AgentStatus = "idle";
  private pending: PendingHitl | null = null;
  private abort: AbortController | null = null;
  private running = false;
  private pauseRequested = false;
  private resumeRun: (() => void) | null = null;

  pause(): void {
    if (this.status !== "running") return;
    this.pauseRequested = true;
    this.log("info", "Taking over after the current action finishes");
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.pauseRequested = false;
    this.resumeRun?.();
    this.resumeRun = null;
  }

  private async checkpoint(signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();
    if (!this.pauseRequested) return false;
    this.setStatus("paused");
    this.log("info", "You have control", "Make your changes in the live page, then resume the agent.");
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { this.resumeRun = null; reject(new StoppedError()); };
      signal.addEventListener("abort", onAbort, { once: true });
      this.resumeRun = () => { signal.removeEventListener("abort", onAbort); resolve(); };
    });
    signal.throwIfAborted();
    this.setStatus("running");
    return true;
  }

  constructor(private readonly opts: OrchestratorOptions) {
    this.client = opts.client ?? null;
  }

  get currentStatus(): AgentStatus {
    return this.status;
  }

  get pendingRequest(): HitlRequest | null {
    return this.pending?.request ?? null;
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Add your Google AI Studio key to apps/server/.env.");
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  private setStatus(status: AgentStatus): void {
    this.status = status;
    this.opts.emit({ type: "status", status });
  }

  private log(kind: TimelineKind, title: string, detail?: string): void {
    this.opts.emit({
      type: "timeline",
      event: { id: randomUUID(), ts: Date.now(), kind, title, ...(detail ? { detail } : {}) },
    });
  }

  private requestHuman(input: HumanRequestInput): Promise<HitlResponse> {
    if (this.abort?.signal.aborted) return Promise.reject(new StoppedError());
    const request: HitlRequest = { ...input, id: randomUUID(), createdAt: Date.now() };
    this.setStatus("awaiting_human");
    this.opts.emit({ type: "hitl_request", request });

    return new Promise<HitlResponse>((resolve, reject) => {
      const onAbort = () => {
        this.pending = null;
        reject(new StoppedError());
      };
      this.abort?.signal.addEventListener("abort", onAbort, { once: true });
      this.pending = {
        request,
        resolve: (res) => {
          this.abort?.signal.removeEventListener("abort", onAbort);
          this.pending = null;
          this.opts.emit({ type: "hitl_resolved", requestId: request.id });
          this.log("hitl", `You responded: ${res.decision}`, res.answer);
          this.setStatus("running");
          resolve(res);
        },
      };
    });
  }

  /** Called when the UI answers a pending hand-off. */
  resolveHitl(res: HitlResponse): void {
    if (!this.pending || this.pending.request.id !== res.requestId) {
      this.opts.emit({ type: "error", message: "No matching pending request." });
      return;
    }
    const kind = this.pending.request.kind;
    const valid = res.decision === "reject" ||
      (kind === "confirm_action" ? res.decision === "approve" :
        kind === "ambiguity" ? res.decision === "answer" && Boolean(res.answer?.trim()) : res.decision === "done");
    if (!valid) {
      this.opts.emit({ type: "error", message: "Please use the response requested for this step." });
      return;
    }
    this.pending.resolve(res);
  }

  stop(): void {
    if (!this.abort || this.abort.signal.aborted) return;
    this.abort.abort();
    this.log("info", "Stopped by you");
    this.setStatus("stopped");
  }

  /** Starts the run in the background; progress is reported via `emit`. */
  start(vault: ApplicantVault): void {
    if (this.running) {
      this.opts.emit({ type: "error", message: "A session is already running." });
      return;
    }
    this.abort = new AbortController();
    this.running = true;
    this.pauseRequested = false;
    void this.run(vault, this.abort.signal).finally(() => { this.running = false; });
  }

  private async run(vault: ApplicantVault, signal: AbortSignal): Promise<void> {
    this.setStatus("starting");
    let client: GoogleGenAI;
    try {
      client = this.getClient();
    } catch (err) {
      this.log("error", "Missing API key", err instanceof Error ? err.message : String(err));
      this.setStatus("failed");
      return;
    }
    try {
      await this.opts.browser.close();
      signal.throwIfAborted();
      await this.opts.browser.launch();
      signal.throwIfAborted();
    } catch (err) {
      if (signal.aborted) { this.setStatus("stopped"); return; }
      this.log("error", "Could not launch the browser", err instanceof Error ? err.message : String(err));
      this.setStatus("failed");
      return;
    }
    this.setStatus("running");
    this.log("info", "Session started", `Model: ${MODEL}`);

    const ctx: ToolContext = {
      vault,
      signal,
      browser: this.opts.browser,
      requestHuman: (req) => this.requestHuman(req),
      log: (kind, title, detail) => this.log(kind, title, detail),
      snapshot: null,
    };

    const contents: Content[] = [{ role: "user", parts: [{ text: buildKickoffMessage(vault) }] }];
    const pushUserText = (text: string) => contents.push({ role: "user", parts: [{ text }] });
    let nudges = 0;

    try {
      for (let step = 1; step <= MAX_STEPS; step++) {
        if (await this.checkpoint(signal)) {
          const observation = await executeTool("observe_page", {}, ctx);
          pushUserText(`The applicant took manual control. Use this fresh page state before proceeding:\n${observation.text}`);
        }
        if (signal.aborted) throw new StoppedError();

        const response = await client.models.generateContent({
          model: MODEL,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: TOOL_DEFINITIONS }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
            abortSignal: signal,
          },
        });

        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;
        if (!candidate?.content?.parts?.length) {
          const blockReason = response.promptFeedback?.blockReason;
          if (blockReason || (finishReason && BLOCKED_FINISH_REASONS.has(finishReason))) {
            this.log("error", "Gemini blocked this turn", String(blockReason ?? finishReason));
            this.setStatus("failed");
            return;
          }
          this.log("error", "Empty response from Gemini", finishReason ? String(finishReason) : undefined);
          pushUserText(NUDGE_USE_TOOLS);
          continue;
        }

        // Append the model turn unchanged so thought signatures are sent back.
        contents.push({ role: "model", parts: candidate.content.parts });

        for (const part of candidate.content.parts) {
          if (part.text && !part.thought && part.text.trim()) this.log("thought", part.text.trim());
        }

        const calls: FunctionCall[] = candidate.content.parts
          .map((p) => p.functionCall)
          .filter((c): c is FunctionCall => c !== undefined);

        if (calls.length === 0) {
          if (finishReason === FinishReason.MAX_TOKENS) {
            this.log("error", "Response was cut off", "Asking the model to continue in smaller steps.");
            pushUserText("Your last response was cut off. Continue with one tool call at a time.");
            continue;
          }
          if (nudges >= MAX_NUDGES) {
            this.log("info", "Agent stopped without calling task_complete");
            this.setStatus("failed");
            return;
          }
          nudges++;
          pushUserText(NUDGE_USE_TOOLS);
          continue;
        }

        // Browser actions must run sequentially; all responses go back in one user turn.
        const responseParts: Part[] = [];
        let completion: { summary: string; success: boolean } | undefined;
        let invalidated = false;
        for (const call of calls) {
          if (await this.checkpoint(signal)) invalidated = true;
          if (signal.aborted) throw new StoppedError();
          const name = call.name ?? "";
          if (completion) {
            responseParts.push({
              functionResponse: { id: call.id, name, response: { error: "Skipped: session already completed." } },
            });
            continue;
          }
          const outcome = invalidated
            ? await executeTool("observe_page", {}, ctx)
            : await executeTool(name, call.args ?? {}, ctx);
          if (invalidated) outcome.text = `Action skipped because the applicant took control. Replan using this fresh observation:\n${outcome.text}`;
          if (signal.aborted) throw new StoppedError();
          responseParts.push({
            functionResponse: {
              id: call.id,
              name,
              response: outcome.isError ? { error: outcome.text } : { output: outcome.text },
              ...(outcome.imageBase64
                ? { parts: [{ inlineData: { mimeType: "image/jpeg", data: outcome.imageBase64 } }] }
                : {}),
            },
          });
          if (outcome.completion) completion = outcome.completion;
        }
        contents.push({ role: "user", parts: responseParts });

        if (completion) {
          this.log(completion.success ? "success" : "info", "Session complete", completion.summary);
          this.setStatus(completion.success ? "completed" : "failed");
          return;
        }
      }

      this.log("error", `Stopped after ${MAX_STEPS} steps`, "Increase PASSAGENT_MAX_STEPS or continue manually.");
      this.setStatus("failed");
    } catch (err) {
      if (err instanceof StoppedError || signal.aborted) {
        if (this.status !== "stopped") this.setStatus("stopped");
        return;
      }
      this.log("error", "Agent error", describeError(err));
      this.setStatus("failed");
    }
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return `Gemini rejected the request: ${err.message}`;
      case 401:
      case 403:
        return "Gemini API key was rejected — check GEMINI_API_KEY in apps/server/.env.";
      case 404:
        return `Model "${MODEL}" was not found. Set PASSAGENT_MODEL to a model your key can use.`;
      case 429:
        return "Gemini rate limit or free-tier quota reached. Wait a minute or check your quota in Google AI Studio.";
      default:
        return `Gemini API error (${err.status}): ${err.message}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}
