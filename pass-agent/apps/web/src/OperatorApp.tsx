import { useEffect } from "react";
import type { AgentStatus } from "@pass-agent/shared";
import { useAgentStore, type ConnectionState } from "./store/useAgentStore";
import SplitWorkspace from "./components/SplitWorkspace";
import VaultIntakeModal from "./components/VaultIntakeModal";

const STATUS_STYLE: Record<AgentStatus, string> = {
  idle: "bg-slate-700 text-slate-200",
  starting: "bg-sky-700 text-sky-100",
  running: "bg-emerald-700 text-emerald-100",
  paused: "bg-amber-600 text-white",
  awaiting_human: "bg-saffron-500 text-slate-950 animate-pulse",
  completed: "bg-emerald-600 text-white",
  failed: "bg-red-700 text-red-100",
  stopped: "bg-slate-600 text-slate-100",
};

const CONNECTION_DOT: Record<ConnectionState, string> = {
  open: "bg-emerald-400",
  connecting: "bg-amber-400",
  closed: "bg-red-500",
};

export default function App() {
  const connect = useAgentStore((s) => s.connect);
  const connection = useAgentStore((s) => s.connection);
  const status = useAgentStore((s) => s.status);
  const vaultOpen = useAgentStore((s) => s.vaultOpen);
  const setVaultOpen = useAgentStore((s) => s.setVaultOpen);
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const pauseAgent = useAgentStore((s) => s.pauseAgent);
  const resumeAgent = useAgentStore((s) => s.resumeAgent);
  const lastError = useAgentStore((s) => s.lastError);
  const clearError = useAgentStore((s) => s.clearError);
  const modelConfigured = useAgentStore((s) => s.modelConfigured);

  useEffect(() => {
    connect();
  }, [connect]);

  const active = status === "starting" || status === "running" || status === "paused" || status === "awaiting_human";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 bg-navy-900 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">
            Pass<span className="text-saffron-500">Agent</span>
          </span>
          <span className="hidden text-xs text-slate-400 sm:inline">
            Passport Seva co-pilot · you stay in control
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`h-2 w-2 rounded-full ${CONNECTION_DOT[connection]}`} />
            {connection}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
            {status.replace("_", " ")}
          </span>
          {active ? (
            <div className="flex items-center gap-2">
            {status === "running" && <button className="btn-primary" onClick={pauseAgent}>Take control</button>}
            {status === "paused" && <button className="btn-primary" onClick={resumeAgent}>Resume agent</button>}
            <button className="btn-danger" onClick={stopAgent}>
              End session
            </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => setVaultOpen(true)} disabled={connection !== "open"}>
              New session
            </button>
          )}
        </div>
      </header>

      {modelConfigured === false && (
        <div role="status" className="bg-amber-950 px-4 py-2 text-sm text-amber-200">
          AI setup needed: add your Gemini API key to apps/server/.env, then restart the server. Your key stays on this computer.
        </div>
      )}

      {lastError && (
        <div className="flex items-center justify-between bg-red-950 px-4 py-1.5 text-sm text-red-200">
          <span>{lastError}</span>
          <button className="text-red-300 hover:text-white" onClick={clearError} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}

      <main className="min-h-0 flex-1">
        <SplitWorkspace />
      </main>

      {vaultOpen && !active && <VaultIntakeModal onClose={() => setVaultOpen(false)} />}
    </div>
  );
}
