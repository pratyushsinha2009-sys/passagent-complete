import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";
import {
  HitlKindSchema,
  isAllowedPortalUrl,
  type HitlRequest,
  type HitlResponse,
  type TimelineKind,
  type ApplicantVault,
} from "@pass-agent/shared";
import { isSourcedAnswer } from "./answers";
import type { PlaywrightManager } from "../browser/playwrightManager";
import {
  distillPage,
  formatDistilledPage,
  type DistilledElement,
  type DistilledPage,
} from "../browser/domDistiller";

/* ------------------------------------------------------------------ */
/* Tool definitions (sent to Gemini as function declarations)          */
/* ------------------------------------------------------------------ */

export const TOOL_DEFINITIONS: FunctionDeclaration[] = [
  {
    name: "scroll_page",
    description: "Scroll the page to discover controls lower down, then return a fresh snapshot.",
    parametersJsonSchema: { type: "object", properties: { delta_y: { type: "integer", minimum: -4000, maximum: 4000 } }, required: ["delta_y"], additionalProperties: false },
  },
  {
    name: "observe_page",
    description:
      "Return a screenshot plus a fresh text snapshot of the current page. Use when the layout matters or the last snapshot seems incomplete.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "navigate",
    description:
      "Open a URL on passportindia.gov.in. Any other domain is blocked. Prefer clicking portal links over typing URLs.",
    parametersJsonSchema: {
      type: "object",
      properties: { url: { type: "string", description: "Absolute https URL on passportindia.gov.in" } },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "click_element",
    description:
      "Click an element by its snapshot id (buttons, links, radio buttons, tabs). Irreversible controls (submit, pay, book appointment) pause for the human's approval automatically.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        element_id: { type: "string", description: "Snapshot id such as e12" },
        rationale: { type: "string", description: "One short sentence on why you are clicking it" },
      },
      required: ["element_id", "rationale"],
      additionalProperties: false,
    },
  },
  {
    name: "fill_field",
    description:
      "Clear a text input or textarea and type a value from the applicant vault. Never use for SENSITIVE fields.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        element_id: { type: "string" },
        value: { type: "string", description: "Exact value, already converted to the portal's format" },
        vault_path: {
          type: "string",
          description: "Dot path of the vault field this value came from, e.g. applicant.givenName",
        },
      },
      required: ["element_id", "value", "vault_path"],
      additionalProperties: false,
    },
  },
  {
    name: "select_option",
    description: "Choose an option in a <select> dropdown by its visible label.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        element_id: { type: "string" },
        option_label: { type: "string", description: "One of the options listed in the snapshot" },
      },
      required: ["element_id", "option_label"],
      additionalProperties: false,
    },
  },
  {
    name: "set_checkbox",
    description: "Check or uncheck a checkbox.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        element_id: { type: "string" },
        checked: { type: "boolean" },
      },
      required: ["element_id", "checked"],
      additionalProperties: false,
    },
  },
  {
    name: "request_human",
    description:
      "Pause and hand control to the applicant. Use for CAPTCHA, OTP, login, sensitive IDs, document upload, payment, or when you need an answer you cannot find in the vault. Returns once the human responds.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: HitlKindSchema.options.filter((k) => k !== "confirm_action") },
        reason: { type: "string", description: "Why the human is needed, in one sentence" },
        question: { type: "string", description: "What exactly the human should do or answer" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Candidate answers for kind=ambiguity; empty array otherwise",
        },
      },
      required: ["kind", "reason", "question", "options"],
      additionalProperties: false,
    },
  },
  {
    name: "task_complete",
    description:
      "End the session. Use when the human has taken over payment/appointment after submission, or when no further progress is possible.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Honest summary of what was done and what remains" },
        success: { type: "boolean" },
      },
      required: ["summary", "success"],
      additionalProperties: false,
    },
  },
];

/* ------------------------------------------------------------------ */
/* Input schemas (validated before execution)                          */
/* ------------------------------------------------------------------ */

const ElementId = z.string().regex(/^e\d+$/, "Element ids look like e12");

const Inputs = {
  scroll_page: z.object({ delta_y: z.number().int().min(-4000).max(4000) }),
  observe_page: z.object({}).strict(),
  navigate: z.object({ url: z.string().url() }),
  click_element: z.object({ element_id: ElementId, rationale: z.string() }),
  fill_field: z.object({ element_id: ElementId, value: z.string().max(500), vault_path: z.string() }),
  select_option: z.object({ element_id: ElementId, option_label: z.string().min(1) }),
  set_checkbox: z.object({ element_id: ElementId, checked: z.boolean() }),
  request_human: z.object({
    kind: HitlKindSchema.exclude(["confirm_action"]),
    reason: z.string().min(1),
    question: z.string().min(1),
    options: z.array(z.string()),
  }),
  task_complete: z.object({ summary: z.string().min(1), success: z.boolean() }),
} as const;

export type ToolName = keyof typeof Inputs;

function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(Inputs, name);
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

export type HumanRequestInput = Omit<HitlRequest, "id" | "createdAt">;

export interface ToolContext {
  vault: ApplicantVault;
  signal: AbortSignal;
  browser: PlaywrightManager;
  requestHuman: (req: HumanRequestInput) => Promise<HitlResponse>;
  log: (kind: TimelineKind, title: string, detail?: string) => void;
  /** Most recent snapshot; refreshed after every action. */
  snapshot: DistilledPage | null;
}

export interface ToolOutcome {
  text: string;
  /** Base64 JPEG attached to the function response (observe_page only). */
  imageBase64?: string;
  isError: boolean;
  completion?: { summary: string; success: boolean };
}

/** Controls that must never be clicked without the human's explicit approval. */
const IRREVERSIBLE_LABEL =
  /\b(final\s*submit|submit|pay(ment)?|make\s+payment|proceed\s+to\s+pay|book(\s+appointment)?|schedule\s+appointment|reschedule|cancel\s+application|delete|confirm)\b/i;
const PAYMENT_LABEL = /\b(pay(ment)?|proceed\s+to\s+pay|make\s+payment)\b/i;

function errorOutcome(message: string): ToolOutcome {
  return { text: `Error: ${message}`, isError: true };
}

async function refreshSnapshot(ctx: ToolContext): Promise<string> {
  ctx.snapshot = await distillPage(ctx.browser.page);
  return formatDistilledPage(ctx.snapshot);
}

async function resultWithSnapshot(ctx: ToolContext, message: string): Promise<ToolOutcome> {
  const snapshot = await refreshSnapshot(ctx);
  return { text: `${message}\n\n--- CURRENT PAGE ---\n${snapshot}`, isError: false };
}

function findElement(ctx: ToolContext, id: string): DistilledElement | undefined {
  return ctx.snapshot?.elements.find((el) => el.id === id);
}

function describeHumanResponse(res: HitlResponse): string {
  switch (res.decision) {
    case "approve":
      return "The applicant approved.";
    case "reject":
      return "The applicant declined.";
    case "done":
      return "The applicant reports the hand-off task is done.";
    case "answer":
      return `The applicant answered: ${JSON.stringify(res.answer ?? "")}`;
  }
}

/** Hand a sensitive field to the human instead of typing into it. */
async function escalateSensitive(ctx: ToolContext, el: DistilledElement): Promise<ToolOutcome> {
  ctx.log("policy", "Sensitive field — handing to you", el.label || el.id);
  const res = await ctx.requestHuman({
    kind: "sensitive_input",
    reason: `"${el.label || el.name || el.id}" is a sensitive field the agent is not allowed to fill.`,
    question: "Please click the field in the live browser and type the value yourself, then press Done.",
    options: [],
    actionPreview: null,
  });
  return resultWithSnapshot(
    ctx,
    `Policy: the agent may not fill sensitive fields. ${describeHumanResponse(res)}`,
  );
}

export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  if (!isToolName(name)) return errorOutcome(`Unknown tool "${name}"`);
  ctx.signal.throwIfAborted();

  try {
    switch (name) {
      case "scroll_page": {
        const { delta_y } = Inputs.scroll_page.parse(rawInput);
        await ctx.browser.page.mouse.wheel(0, delta_y);
        return resultWithSnapshot(ctx, "Scrolled the page.");
      }
      case "observe_page": {
        Inputs.observe_page.parse(rawInput ?? {});
        const snapshot = await refreshSnapshot(ctx);
        const screenshot = await ctx.browser.screenshotBase64(ctx.snapshot?.elements.filter((el) => el.sensitive).map((el) => el.id));
        ctx.log("observation", "Observed page", ctx.snapshot?.url);
        return { text: snapshot, imageBase64: screenshot, isError: false };
      }

      case "navigate": {
        const { url } = Inputs.navigate.parse(rawInput);
        if (!isAllowedPortalUrl(url)) {
          ctx.log("policy", "Blocked off-portal navigation", url);
          return errorOutcome("Only passportindia.gov.in URLs are allowed.");
        }
        ctx.log("action", "Navigate", url);
        await ctx.browser.navigate(url);
        return resultWithSnapshot(ctx, `Navigated to ${url}.`);
      }

      case "click_element": {
        const { element_id, rationale } = Inputs.click_element.parse(rawInput);
        await refreshSnapshot(ctx);
        const el = findElement(ctx, element_id);
        if (!el) return errorOutcome(`No element ${element_id} in the latest snapshot. Call observe_page.`);
        const label = el.label || el.name || element_id;
        if (el.disabled) return errorOutcome("This control is disabled.");
        if (el.type === "file" || PAYMENT_LABEL.test(label)) {
          const res = await ctx.requestHuman({ kind: el.type === "file" ? "document_upload" : "payment", reason: rationale,
            question: el.type === "file" ? "Choose the document for this field using the upload control below." : "Complete payment yourself in the live browser, then press Done.",
            options: [], actionPreview: el.type === "file" ? { elementId: element_id, label } : null });
          return resultWithSnapshot(ctx, describeHumanResponse(res));
        }
        if (el.type === "checkbox") {
          return executeTool("set_checkbox", { element_id, checked: !el.checked }, ctx);
        }

        if (IRREVERSIBLE_LABEL.test(label)) {
          const isPayment = PAYMENT_LABEL.test(label);
          ctx.log("policy", `Approval needed: "${label}"`, rationale);
          const res = await ctx.requestHuman({
            kind: isPayment ? "payment" : "confirm_action",
            reason: rationale,
            question: isPayment
              ? `The next step is payment ("${label}"). Payments are always done by you. Approve to let the agent click it, or reject and complete it yourself in the live browser.`
              : `The agent wants to click "${label}". This may be irreversible. Approve?`,
            options: [],
            actionPreview: { elementId: element_id, label },
          });
          if (res.decision !== "approve") {
            return resultWithSnapshot(
              ctx,
              `The applicant did NOT approve clicking "${label}". Do not retry this click. ${describeHumanResponse(res)}`,
            );
          }
          ctx.signal.throwIfAborted();
          const previousUrl = ctx.snapshot?.url;
          await refreshSnapshot(ctx);
          const current = findElement(ctx, element_id);
          if (ctx.snapshot?.url !== previousUrl || !current || current.label !== el.label || current.name !== el.name) {
            return errorOutcome("The page changed during approval. Observe and request approval again.");
          }
        }

        ctx.log("action", `Click "${label}"`, rationale);
        await ctx.browser.locator(element_id).click({ timeout: 10_000 });
        await ctx.browser.settle();
        return resultWithSnapshot(ctx, `Clicked ${element_id} ("${label}").`);
      }

      case "fill_field": {
        const { element_id, value, vault_path } = Inputs.fill_field.parse(rawInput);
        await refreshSnapshot(ctx);
        const el = findElement(ctx, element_id);
        if (!el) return errorOutcome(`No element ${element_id} in the latest snapshot. Call observe_page.`);
        if (el.sensitive) return escalateSensitive(ctx, el);
        if (!isSourcedAnswer(ctx.vault, vault_path, value)) {
          return errorOutcome("Value does not match this applicant vault field. Ask the applicant to enter missing answers directly in the live page.");
        }
        if (el.disabled) return errorOutcome(`${element_id} is disabled.`);
        if (!["input", "textarea"].includes(el.tag) && el.type !== "textbox") {
          return errorOutcome(`${element_id} is a ${el.tag}; use select_option, set_checkbox or click_element.`);
        }

        ctx.signal.throwIfAborted();
        ctx.log("action", `Fill "${el.label || el.name}"`, `From applicant details: ${vault_path}`);
        const loc = ctx.browser.locator(element_id);
        await loc.fill(value, { timeout: 10_000 });
        // Many portal fields validate on blur.
        await loc.blur().catch(() => undefined);
        if (await loc.inputValue() !== value) return errorOutcome("The portal did not retain the entered value. Observe the validation message and ask the applicant if needed.");
        return resultWithSnapshot(ctx, `Filled ${element_id} with "${value}".`);
      }

      case "select_option": {
        const { element_id, option_label } = Inputs.select_option.parse(rawInput);
        await refreshSnapshot(ctx);
        const el = findElement(ctx, element_id);
        if (!el) return errorOutcome(`No element ${element_id} in the latest snapshot. Call observe_page.`);
        if (el.tag !== "select") return errorOutcome(`${element_id} is not a <select>.`);
        if (el.sensitive) return escalateSensitive(ctx, el);

        const wanted = option_label.trim().toLowerCase();
        const match = el.options.find((o) => o.toLowerCase() === wanted);
        if (!match) {
          return errorOutcome(
            `"${option_label}" is not among the options of ${element_id}: ${el.options.join(", ")}`,
          );
        }
        ctx.log("action", `Select "${match}"`, el.label || el.name);
        await ctx.browser.locator(element_id).selectOption({ label: match }, { timeout: 10_000 });
        await ctx.browser.settle();
        return resultWithSnapshot(ctx, `Selected "${match}" in ${element_id}.`);
      }

      case "set_checkbox": {
        const { element_id, checked } = Inputs.set_checkbox.parse(rawInput);
        await refreshSnapshot(ctx);
        const el = findElement(ctx, element_id);
        if (!el) return errorOutcome(`No element ${element_id} in the latest snapshot. Call observe_page.`);
        if (el.sensitive) return escalateSensitive(ctx, el);
        if (el.type !== "checkbox") return errorOutcome("This element is not a checkbox.");
        const label = el.label || el.name || element_id;
        if (checked && /declar|undertak|agree|certify/i.test(label)) {
          // Self-declarations are statements by the applicant; they must make them.
          ctx.log("policy", "Declaration needs your consent", label);
          const res = await ctx.requestHuman({
            kind: "confirm_action",
            reason: "This checkbox is a legal self-declaration by the applicant.",
            question: `Read the declaration in the live browser. Approve to let the agent tick "${label}".`,
            options: [],
            actionPreview: { elementId: element_id, label },
          });
          if (res.decision !== "approve") {
            return resultWithSnapshot(ctx, `The applicant did not approve ticking "${label}".`);
          }
          ctx.signal.throwIfAborted();
          const previousUrl = ctx.snapshot?.url;
          await refreshSnapshot(ctx);
          const current = findElement(ctx, element_id);
          if (ctx.snapshot?.url !== previousUrl || !current || current.label !== el.label) return errorOutcome("Declaration changed during approval. Observe again.");
        }
        ctx.log("action", `${checked ? "Check" : "Uncheck"} "${label}"`);
        await ctx.browser.locator(element_id).setChecked(checked, { timeout: 10_000 });
        return resultWithSnapshot(ctx, `${checked ? "Checked" : "Unchecked"} ${element_id}.`);
      }

      case "request_human": {
        const input = Inputs.request_human.parse(rawInput);
        ctx.log("hitl", `Needs you: ${input.kind.replace("_", " ")}`, input.question);
        await refreshSnapshot(ctx);
        const file = input.kind === "document_upload" ? ctx.snapshot?.elements.find((el) => el.type === "file") : undefined;
        const res = await ctx.requestHuman({ ...input, actionPreview: file ? { elementId: file.id, label: file.label || file.name } : null });
        return resultWithSnapshot(ctx, describeHumanResponse(res));
      }

      case "task_complete": {
        const { summary, success } = Inputs.task_complete.parse(rawInput);
        return { text: "Session ended.", isError: false, completion: { summary, success } };
      }
    }
  } catch (err) {
    ctx.signal.throwIfAborted();
    if (err instanceof z.ZodError) {
      return errorOutcome(`Invalid input for ${name}: ${err.issues.map((i) => i.message).join("; ")}`);
    }
    const message = err instanceof Error ? err.message : String(err);
    ctx.log("error", `${name} failed`, message);
    // Give the model a fresh view so it can recover.
    try {
      const snapshot = await refreshSnapshot(ctx);
      return { text: `Error: ${message}\n\n--- CURRENT PAGE ---\n${snapshot}`, isError: true };
    } catch {
      return errorOutcome(message);
    }
  }
}
