import "dotenv/config";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { distillPage } from "./browser/domDistiller";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import {
  ClientMessageSchema,
  HUMAN_INPUT_STATUSES,
  type ServerMessage,
} from "@pass-agent/shared";
import { PlaywrightManager } from "./browser/playwrightManager";
import { AgentOrchestrator } from "./agent/orchestrator";
import { installGuideRoutes } from "./guide";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const PORT = Number(process.env.PORT ?? 8787);
const HEADLESS = process.env.HEADLESS !== "false";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
installGuideRoutes(app);
app.get("/health", (_req, res) => {
  res.json({ ok: true, modelConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) });
});

const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: 8 * 1024 * 1024,
  // The socket drives a real browser session, so only accept the local UI.
  verifyClient: ({ origin }: { origin?: string }) => !origin || ALLOWED_ORIGINS.includes(origin),
});

wss.on("connection", (socket: WebSocket) => {
  const send = (msg: ServerMessage) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    // Drop video frames when the client is falling behind; never drop other events.
    if (msg.type === "frame" && socket.bufferedAmount > 2 * 1024 * 1024) return;
    socket.send(JSON.stringify(msg));
  };

  const browser = new PlaywrightManager({
    headless: HEADLESS,
    onFrame: (frame) => send({ type: "frame", frame }),
    onBlockedNavigation: (url) =>
      send({
        type: "timeline",
        event: {
          id: `blocked-${Date.now()}`,
          ts: Date.now(),
          kind: "policy",
          title: "Blocked navigation outside the portal",
          detail: url,
        },
      }),
  });
  const agent = new AgentOrchestrator({ browser, emit: send });
  let inputQueue: Promise<void> = Promise.resolve();

  send({ type: "status", status: agent.currentStatus });

  socket.on("message", (data: RawData) => {
    inputQueue = inputQueue.then(async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      send({ type: "error", message: "Malformed JSON." });
      return;
    }
    const result = ClientMessageSchema.safeParse(parsed);
    if (!result.success) {
      send({ type: "error", message: `Invalid message: ${result.error.issues[0]?.message ?? "unknown"}` });
      return;
    }
    const msg = result.data;
    switch (msg.type) {
      case "start":
        agent.start(msg.vault);
        break;
      case "stop":
        agent.stop();
        break;
      case "pause":
        agent.pause();
        break;
      case "resume":
        agent.resume();
        break;
      case "upload": {
        const request = agent.pendingRequest;
        if (agent.currentStatus !== "awaiting_human" || request?.kind !== "document_upload" ||
          request.id !== msg.requestId || request.actionPreview?.elementId !== msg.elementId) {
          send({ type: "error", message: "No matching document request. Ask the agent to select an upload field." });
          break;
        }
        const snapshot = await distillPage(browser.page);
        if (!snapshot.elements.some((element) => element.id === msg.elementId && element.type === "file")) {
          send({ type: "error", message: "The upload field changed. Please resume and ask the agent to check it again." });
          break;
        }
        const buffer = Buffer.from(msg.data, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          send({ type: "error", message: "Choose a document smaller than 5 MB." });
          break;
        }
        await browser.locator(msg.elementId).setInputFiles({ name: msg.name, mimeType: msg.mimeType, buffer });
        send({ type: "upload_complete", requestId: msg.requestId });
        break;
      }
      case "hitl_response":
        agent.resolveHitl(msg.response);
        break;
      case "input":
        if (!browser.isLaunched) return;
        if (!HUMAN_INPUT_STATUSES.includes(agent.currentStatus)) {
          send({ type: "error", message: "The agent is driving. Wait for a hand-off or press Stop to take over." });
          return;
        }
        await browser.dispatchInput(msg.input);
        break;
    }
    }).catch((err: unknown) => send({ type: "error", message: err instanceof Error ? err.message : String(err) }));
  });

  socket.on("close", () => {
    agent.stop();
    void browser.close();
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[pass-agent] server listening on http://localhost:${PORT} (ws: /ws, headless=${HEADLESS})`);
});

const shutdown = () => {
  for (const client of wss.clients) client.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
