import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import express from "express";
import { chromium } from "playwright";
import type { GoogleGenAI, GenerateContentParameters } from "@google/genai";
import { installGuideRoutes, GuideInput } from "./guide";
import type { z } from "zod";

test("browser question reaches the real local API, runs model tools and renders without sending form values", { timeout: 30_000 }, async () => {
  const seen: string[] = [];
  const client = { models: { generateContent: async (request: GenerateContentParameters) => {
    const contents = request.contents as { parts: { functionResponse?: { name: string; response: { result: z.infer<typeof GuideInput> } } }[] }[];
    const observed = contents.flatMap((turn) => turn.parts).find((part) => part.functionResponse?.name === "inspect_page")?.functionResponse?.response.result;
    const call = observed ? { name: "guide_user", args: { title: "Your given name", explanation: "Use your first and middle names, with the spelling shown in your documents.", example: "Aarav Kumar (made-up example)", caution: "", targetId: observed.field.id, action: "explain", stage: "applicant", plan: ["Check the spelling", "Choose Done—next"] } } : { name: "inspect_page", args: {} };
    if (observed) seen.push(JSON.stringify(observed));
    return { candidates: [{ content: { parts: [{ functionCall: call }] } }] };
  } } } as unknown as GoogleGenAI;
  const app = express(); installGuideRoutes(app, { client });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.exposeFunction("coachApi", async (context: unknown) => {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/guide`, { method: "POST", headers: { "Content-Type": "application/json", Origin: `chrome-extension://${"a".repeat(32)}` }, body: JSON.stringify(context) });
      const data = await response.json();
      return response.ok ? { ok: true, guide: data } : { ok: false, ...data };
    });
    await page.setContent(`<main><h1>Applicant details</h1><form style="width:650px"><label for="given">Given name</label><input id="given" style="display:block;width:650px;padding:10px" required></form></main>`);
    await page.evaluate(`globalThis.chrome={storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{sendMessage:async(message)=>globalThis.coachApi({...message.context,url:'https://www.passportindia.gov.in/forms/applicant'})}}`);
    for (const file of ["guidance-languages.js", "languages.js", "guide-state.js", "passport-knowledge.js", "coach.js", "field-reader.js", "inline-theme.js", "content.js"]) await page.addScriptTag({ path: fileURLToPath(new URL(`../../../extensions/passport-guide/${file}`, import.meta.url)) });
    await page.locator("#given").fill("PRIVATE APPLICANT NAME");
    const note = page.locator('#given + [data-passport-guide="note"]');
    await note.locator(".question-details summary").click();
    await note.locator(".ask input").fill("Do middle names belong here?");
    await note.getByRole("button", { name: "Ask AI", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-passport-guide="note"]')?.shadowRoot?.querySelector(".status")?.textContent?.includes("AI explanation"));
    assert.match(await note.locator(".explanation").innerText(), /first and middle names/);
    assert.equal(seen.length, 1);
    assert.equal(seen.join("").includes("PRIVATE APPLICANT NAME"), false);
    assert.equal(seen.join("").includes("Do middle names belong here?"), true);
    assert.equal(await page.locator("#given").inputValue(), "PRIVATE APPLICANT NAME");
  } finally { await browser.close(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
