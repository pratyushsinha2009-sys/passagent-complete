import { useState, type FormEvent } from "react";
import type { HitlKind, HitlRequest } from "@pass-agent/shared";
import { useAgentStore } from "../store/useAgentStore";

const KIND_TITLE: Record<HitlKind, string> = {
  captcha: "Solve the CAPTCHA",
  otp: "Enter the OTP",
  login: "Log in to the portal",
  sensitive_input: "Fill a sensitive field",
  confirm_action: "Approve this action",
  payment: "Payment step",
  document_upload: "Upload a document",
  ambiguity: "The agent has a question",
};

/** Kinds where the human does something in the canvas, then tells the agent to resume. */
const HANDOFF_KINDS: ReadonlySet<HitlKind> = new Set(["captcha", "otp", "login", "sensitive_input", "document_upload", "payment"]);

export default function HitlInterventionCard({ request }: { request: HitlRequest }) {
  const respondHitl = useAgentStore((s) => s.respondHitl);
  const uploadFile = useAgentStore((s) => s.uploadFile);
  const uploadedRequestId = useAgentStore((s) => s.uploadedRequestId);
  const [answer, setAnswer] = useState("");
  const [uploadError, setUploadError] = useState("");

  const respond = (decision: "approve" | "reject" | "done" | "answer", text?: string) =>
    respondHitl({ requestId: request.id, decision, ...(text !== undefined ? { answer: text } : {}) });

  const onSubmitAnswer = (e: FormEvent) => {
    e.preventDefault();
    if (answer.trim()) respond("answer", answer.trim());
  };

  return (
    <div className="rounded-lg border border-saffron-500/60 bg-saffron-500/10 p-4 shadow-lg shadow-saffron-500/10">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          🙋
        </span>
        <h3 className="text-sm font-semibold text-saffron-500">{KIND_TITLE[request.kind]}</h3>
      </div>
      <p className="text-sm text-slate-100">{request.question}</p>
      {request.reason && <p className="mt-1 text-xs text-slate-400">Why: {request.reason}</p>}

      {request.actionPreview && (
        <div className="mt-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-300">
          {request.kind === "document_upload" ? "Document field" : "Will click"}: “{request.actionPreview.label}”
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {request.kind === "confirm_action" && (
          <>
            <button className="btn-primary" onClick={() => respond("approve")}>
              Approve
            </button>
            <button className="btn-secondary" onClick={() => respond("reject")}>
              Reject
            </button>
          </>
        )}

        {HANDOFF_KINDS.has(request.kind) && (
          <>
            <button className="btn-primary" onClick={() => respond("done")}>
              Done — resume agent
            </button>
            <button className="btn-secondary" onClick={() => respond("reject")}>
              I can’t do this now
            </button>
          </>
        )}

        {request.kind === "ambiguity" && (
          <div className="w-full space-y-2">
            {request.options.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {request.options.map((opt) => (
                  <button key={opt} className="btn-secondary" onClick={() => respond("answer", opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={onSubmitAnswer} className="flex gap-2">
              <input
                className="field-input"
                placeholder="Type your answer…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={2000}
              />
              <button type="submit" className="btn-primary" disabled={!answer.trim()}>
                Send
              </button>
            </form>
            <button className="text-xs text-slate-400 underline hover:text-slate-200" onClick={() => respond("reject")}>
              Skip this question
            </button>
          </div>
        )}
      </div>

      {request.kind === "document_upload" && request.actionPreview && (
        <div className="mt-3 space-y-2 text-sm">
          <label className="block">Choose a document (PDF, JPG or PNG, up to 5 MB)
            <input aria-label="Choose document" type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-2 block w-full text-xs"
              onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(request, file).catch(() => setUploadError("Could not read the document. Try again.")); }} />
          </label>
          {uploadedRequestId === request.id && <p className="text-emerald-400" role="status">Document attached. Check it in the live page, then press Done.</p>}
          {uploadError && <p role="alert">{uploadError}</p>}
        </div>
      )}

      {HANDOFF_KINDS.has(request.kind) && (
        <p className="mt-3 text-xs text-slate-400">
          Click inside the live page on the left and type directly. What you type goes straight to the portal — the
          agent does not receive your keystrokes as chat messages. Page screenshots are sent to Gemini when it observes the page, so do not reveal secrets on screen.
        </p>
      )}
    </div>
  );
}
