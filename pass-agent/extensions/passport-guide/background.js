chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "passport_guide") return;
  let url;
  try { url = new URL(sender.url); } catch { return; }
  if (url.protocol !== "https:" || !(url.hostname === "passportindia.gov.in" || url.hostname.endsWith(".passportindia.gov.in"))) return;
  // Destination is fixed. A page cannot use this extension as a fetch proxy.
  fetch("http://127.0.0.1:8787/api/guide", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.context), signal: AbortSignal.timeout(25000),
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok) { respond({ ok: false, error: result.error || "The AI guide is unavailable.", code: result.code || "unavailable", retryable: result.retryable === true }); return; }
    respond({ ok: true, guide: result });
  }).catch((error) => respond({ ok: false, code: "connection", retryable: true, error: error.message === "Failed to fetch"
    ? "Start PassAgent in your terminal to connect AI explanations. The built-in field guide still works."
    : error.message }));
  return true;
});
