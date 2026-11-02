import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
} from "react";
import { HUMAN_INPUT_STATUSES, VIEWPORT, type CanvasInput } from "@pass-agent/shared";
import { useAgentStore } from "../store/useAgentStore";

const SPECIAL_KEYS = new Set<Extract<CanvasInput, { kind: "key" }>["key"]>([
  "Backspace",
  "Delete",
  "Enter",
  "Tab",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

function isSpecialKey(key: string): key is Extract<CanvasInput, { kind: "key" }>["key"] {
  return SPECIAL_KEYS.has(key as Extract<CanvasInput, { kind: "key" }>["key"]);
}

export default function BrowserCanvas() {
  const frame = useAgentStore((s) => s.frame);
  const status = useAgentStore((s) => s.status);
  const sendInput = useAgentStore((s) => s.sendInput);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const interactive = HUMAN_INPUT_STATUSES.includes(status) && frame !== null;

  useEffect(() => {
    if (!frame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = `data:image/jpeg;base64,${frame.data}`;
    return () => {
      cancelled = true;
    };
  }, [frame]);

  // Focus the canvas when a hand-off starts so the human can type immediately.
  useEffect(() => {
    if (status === "awaiting_human") canvasRef.current?.focus();
  }, [status]);

  const toViewport = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEWPORT.width;
    const y = ((clientY - rect.top) / rect.height) * VIEWPORT.height;
    return {
      x: Math.max(0, Math.min(VIEWPORT.width, Math.round(x))),
      y: Math.max(0, Math.min(VIEWPORT.height, Math.round(y))),
    };
  };

  const onClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    e.currentTarget.focus();
    sendInput({ kind: "click", ...toViewport(e.clientX, e.clientY) });
  };

  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const deltaY = Math.max(-5000, Math.min(5000, Math.round(e.deltaY)));
    if (deltaY !== 0) sendInput({ kind: "scroll", ...toViewport(e.clientX, e.clientY), deltaY });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
    if (isSpecialKey(e.key)) {
      e.preventDefault();
      sendInput({ kind: "key", key: e.key, shift: e.shiftKey });
    } else if (e.key.length === 1) {
      e.preventDefault();
      sendInput({ kind: "type", text: e.key });
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const text = e.clipboardData.getData("text").slice(0, 500);
    if (text) {
      e.preventDefault();
      sendInput({ kind: "type", text });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-slate-400">
        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-600" />
        <span className="truncate font-mono">{frame?.url || "about:blank"}</span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
        <canvas
          ref={canvasRef}
          width={VIEWPORT.width}
          height={VIEWPORT.height}
          tabIndex={0}
          onClick={onClick}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          aria-label="Live portal browser"
          className={`max-h-full max-w-full rounded-md bg-white outline-none ${
            interactive ? "cursor-pointer ring-2 ring-saffron-500/70 focus:ring-saffron-500" : "cursor-not-allowed"
          } ${frame ? "" : "opacity-0"}`}
          style={{ aspectRatio: `${VIEWPORT.width} / ${VIEWPORT.height}` }}
        />

        {!frame && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-slate-500">
            <div className="text-4xl">🛂</div>
            <p className="text-sm">The live portal view appears here once a session starts.</p>
          </div>
        )}

        {frame && !interactive && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-3 py-1 text-xs text-slate-300">
            Agent is driving. Press “Take control” to pause and edit the page.
          </div>
        )}
        {frame && status === "awaiting_human" && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-saffron-500 px-3 py-1 text-xs font-medium text-slate-950">
            Your turn — click and type directly in the page
          </div>
        )}
      </div>
    </div>
  );
}
