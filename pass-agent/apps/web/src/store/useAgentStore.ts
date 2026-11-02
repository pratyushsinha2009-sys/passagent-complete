import { create } from "zustand";
import {
  ServerMessageSchema,
  type AgentStatus,
  type ApplicantVault,
  type CanvasInput,
  type ClientMessage,
  type Frame,
  type HitlRequest,
  type HitlResponse,
  type TimelineEvent,
} from "@pass-agent/shared";

export type ConnectionState = "connecting" | "open" | "closed";

const MAX_TIMELINE = 500;

interface AgentStore {
  connection: ConnectionState;
  modelConfigured: boolean | null;
  status: AgentStatus;
  timeline: TimelineEvent[];
  pendingHitl: HitlRequest | null;
  frame: Frame | null;
  lastError: string | null;
  vaultOpen: boolean;

  connect: () => void;
  startAgent: (vault: ApplicantVault) => void;
  stopAgent: () => void;
  pauseAgent: () => void;
  resumeAgent: () => void;
  uploadFile: (request: HitlRequest, file: File) => Promise<void>;
  uploadedRequestId: string | null;
  respondHitl: (response: HitlResponse) => void;
  sendInput: (input: CanvasInput) => void;
  setVaultOpen: (open: boolean) => void;
  clearError: () => void;
}

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectDelay = 500;

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

function localEvent(kind: TimelineEvent["kind"], title: string, detail?: string): TimelineEvent {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    kind,
    title,
    ...(detail ? { detail } : {}),
  };
}

export const useAgentStore = create<AgentStore>((set, get) => {
  const send = (msg: ClientMessage): boolean => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      set({ lastError: "Not connected to the PassAgent server." });
      return false;
    }
    socket.send(JSON.stringify(msg));
    return true;
  };

  const pushTimeline = (event: TimelineEvent) =>
    set((s) => ({ timeline: [...s.timeline, event].slice(-MAX_TIMELINE) }));

  const scheduleReconnect = () => {
    if (reconnectTimer !== null) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, 8000);
      get().connect();
    }, reconnectDelay);
  };

  return {
    connection: "closed",
    modelConfigured: null,
    status: "idle",
    timeline: [],
    pendingHitl: null,
    frame: null,
    lastError: null,
    vaultOpen: true,
    uploadedRequestId: null,

    connect: () => {
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
      }
      set({ connection: "connecting" });
      const ws = new WebSocket(wsUrl());
      socket = ws;

      ws.onopen = () => {
        reconnectDelay = 500;
        set({ connection: "open", lastError: null });
        void fetch("/health").then((response) => response.json()).then((health: { modelConfigured?: boolean }) => {
          set({ modelConfigured: health.modelConfigured === true });
        }).catch(() => set({ modelConfigured: null }));
      };

      ws.onclose = () => {
        if (socket !== ws) return;
        socket = null;
        // The server tears the browser session down when the socket closes.
        const wasActive = !["idle", "completed", "failed", "stopped"].includes(get().status);
        set({ connection: "closed", pendingHitl: null, frame: null, status: "idle" });
        if (wasActive) pushTimeline(localEvent("error", "Connection lost — the session was ended"));
        scheduleReconnect();
      };

      ws.onerror = () => {
        set({ lastError: "Could not reach the PassAgent server on :8787." });
      };

      ws.onmessage = (ev: MessageEvent<string>) => {
        let raw: unknown;
        try {
          raw = JSON.parse(ev.data);
        } catch {
          return;
        }
        const parsed = ServerMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        const msg = parsed.data;
        switch (msg.type) {
          case "upload_complete":
            set({ uploadedRequestId: msg.requestId });
            break;
          case "status":
            set({ status: msg.status });
            if (msg.status !== "awaiting_human") set({ pendingHitl: null });
            break;
          case "timeline":
            pushTimeline(msg.event);
            break;
          case "frame":
            set({ frame: msg.frame });
            break;
          case "hitl_request":
            set({ pendingHitl: msg.request });
            break;
          case "hitl_resolved":
            if (get().pendingHitl?.id === msg.requestId) set({ pendingHitl: null });
            break;
          case "error":
            set({ lastError: msg.message });
            break;
        }
      };
    },

    startAgent: (vault) => {
      if (send({ type: "start", vault })) {
        set({ status: "starting", frame: null, uploadedRequestId: null, timeline: [localEvent("info", "Starting PassAgent…")], vaultOpen: false, lastError: null });
      }
    },

    stopAgent: () => {
      send({ type: "stop" });
    },
    pauseAgent: () => { send({ type: "pause" }); },
    resumeAgent: () => { send({ type: "resume" }); },
    uploadFile: async (request, file) => {
      if (!request.actionPreview || file.size > 5 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
        set({ lastError: "Choose a PDF, JPG or PNG document smaller than 5 MB." });
        return;
      }
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Could not read this document."));
        reader.readAsDataURL(file);
      });
      send({ type: "upload", requestId: request.id, elementId: request.actionPreview.elementId,
        name: file.name, mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png", data });
    },

    respondHitl: (response) => {
      send({ type: "hitl_response", response });
    },

    sendInput: (input) => {
      send({ type: "input", input });
    },

    setVaultOpen: (open) => set({ vaultOpen: open }),
    clearError: () => set({ lastError: null }),
  };
});
