import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { GuideInput } from "./guide";
import { runGuideAgent } from "./guideAgent";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("No Gemini key configured in apps/server/.env."); process.exitCode = 1; }
else if (process.argv.includes("--connection")) {
  console.log(`Node ${process.version}; proxy configured: ${Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy)}`);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.PASSAGENT_MODEL || "gemini-3.8-flash")}`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(12_000) });
    console.log(`Gemini model lookup: HTTP ${response.status}`);
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`Gemini model lookup failed: ${error instanceof Error ? error.name : "UnknownError"}`);
    process.exitCode = 1;
  }
} else {
  try {
    const field = { id: "f1", label: "Given name", type: "text", required: true, options: [], filled: false, invalid: false };
    const result = await runGuideAgent(new GoogleGenAI({ apiKey }), GuideInput.parse({ url: "https://www.passportindia.gov.in/", heading: "Applicant details", field, fields: [field], goal: "fresh", event: "next_step" }), AbortSignal.timeout(45_000));
    console.log("AI connection verified.");
    console.log(`Agent tools: ${result.trace.join(" → ")}`);
    console.log(`Action: ${result.action}; target: ${result.targetId}`);
    console.log(result.explanation);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
    const errorType = error instanceof Error ? error.name : "UnknownError";
    const causeCode = error instanceof Error && typeof error.cause === "object" && error.cause && "code" in error.cause ? String(error.cause.code).replace(/[^A-Z0-9_]/g, "").slice(0, 50) : "";
    console.error(status === 503 ? "Gemini returned HTTP 503: the provider is temporarily unavailable. This does not establish whether the key is valid."
      : status ? `AI verification failed (HTTP ${status}). Check the key, model access and quota.` : "AI verification failed: the provider could not be reached or the response did not complete.");
    console.error(`Failure category: ${errorType}${causeCode ? ` (${causeCode})` : ""}`);
    process.exitCode = 1;
  }
}
