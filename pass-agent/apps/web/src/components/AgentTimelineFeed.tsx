import { useEffect, useRef } from "react";
import type { TimelineKind } from "@pass-agent/shared";
import { useAgentStore } from "../store/useAgentStore";

const KIND_META: Record<TimelineKind, { icon: string; tone: string }> = {
  info: { icon: "ℹ️", tone: "text-slate-300" },
  thought: { icon: "💭", tone: "text-slate-300" },
  action: { icon: "🖱️", tone: "text-sky-300" },
  observation: { icon: "👁️", tone: "text-slate-400" },
  hitl: { icon: "🙋", tone: "text-saffron-500" },
  policy: { icon: "🛡️", tone: "text-violet-300" },
  error: { icon: "⚠️", tone: "text-red-300" },
  success: { icon: "✅", tone: "text-emerald-300" },
};

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function AgentTimelineFeed() {
  const timeline = useAgentStore((s) => s.timeline);
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only if the user is already near the bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Agent timeline</h2>
        <span className="text-xs text-slate-500">{timeline.length} events</span>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-live="polite">
        {timeline.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-slate-500">
            Nothing yet. Start a session to see each step the agent takes.
          </p>
        )}
        {timeline.map((ev) => {
          const meta = KIND_META[ev.kind];
          return (
            <div key={ev.id} className="flex gap-2 rounded-md px-2 py-1.5 hover:bg-slate-900">
              <span className="w-5 shrink-0 text-center" aria-hidden>
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`text-sm ${meta.tone} ${ev.kind === "thought" ? "italic" : "font-medium"} break-words`}>
                    {ev.title}
                  </p>
                  <time className="shrink-0 font-mono text-[10px] text-slate-600">{timeFmt.format(ev.ts)}</time>
                </div>
                {ev.detail && <p className="mt-0.5 break-words text-xs text-slate-500">{ev.detail}</p>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
