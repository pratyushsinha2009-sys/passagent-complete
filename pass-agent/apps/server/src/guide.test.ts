import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { chromium } from "playwright";
import type { GoogleGenAI, GenerateContentParameters } from "@google/genai";
import { GuideInput, installGuideRoutes } from "./guide";
import { runGuideAgent } from "./guideAgent";

const input = GuideInput.parse({ url: "https://www.passportindia.gov.in/forms/applicant", heading: "Applicant details", field: { id: "f1", label: "Given name", type: "text", required: true, options: [] }, fields: [], event: "next_step" });
const guidance = { title: "Your given name", explanation: "Enter your first and middle names as shown in your supporting documents.", example: "Aarav Kumar (fictional example)", caution: "Check the spelling.", targetId: "f1", action: "highlight", stage: "applicant", plan: ["Complete your given name", "Review the section"] };
const callResponse = (name: string, args: object = {}) => ({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }] });

test("agent observes before guiding, rejects invented targets and recovers", async () => {
  let calls = 0;
  const client = { models: { generateContent: async () => {
    calls++;
    if (calls === 1) return callResponse("guide_user", guidance);
    if (calls === 2) return callResponse("inspect_page");
    if (calls === 3) return callResponse("guide_user", { ...guidance, targetId: "f999" });
    return callResponse("guide_user", guidance);
  } } } as unknown as GoogleGenAI;
  const result = await runGuideAgent(client, input, AbortSignal.timeout(3000));
  assert.equal(calls, 4);
  assert.equal(result.targetId, "f1");
});

test("guide input rejects personal field values and foreign sites", () => {
  assert.equal(GuideInput.safeParse({ ...input, field: { ...input.field, value: "secret" } }).success, false);
  assert.equal(GuideInput.safeParse({ ...input, url: "https://passportindia.gov.in.evil.test" }).success, false);
});

test("agent stays with the selected field when answering a question", async () => {
  let calls = 0;
  const second = { ...input.field, id: "f2", label: "Email address" };
  const client = { models: { generateContent: async () => {
    calls++;
    return calls === 1 ? callResponse("inspect_page") : callResponse("guide_user", { ...guidance, targetId: calls === 2 ? "f2" : "f1" });
  } } } as unknown as GoogleGenAI;
  const result = await runGuideAgent(client, { ...input, fields: [input.field, second], event: "question" }, AbortSignal.timeout(3000));
  assert.equal(calls, 3);
  assert.equal(result.targetId, "f1");
});

test("agent has bounded retries and honors cancellation", async () => {
  let calls = 0;
  const client = { models: { generateContent: async () => { calls++; return callResponse("unknown_tool"); } } } as unknown as GoogleGenAI;
  await assert.rejects(runGuideAgent(client, input, AbortSignal.timeout(3000)), /step limit/);
  assert.equal(calls, 5);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runGuideAgent(client, input, controller.signal));
  assert.equal(calls, 5);
});

test("real extension runs observe-plan-guide loop, follows progress, catches errors, keeps entered values local", { timeout: 60_000 }, async () => {
  const observed: string[] = [];
  const client = { models: { generateContent: async (request: GenerateContentParameters) => {
    const turns = request.contents as { role: string; parts: { functionResponse?: { name: string; response: { result: typeof input } } }[] }[];
    const observation = turns.flatMap((turn) => turn.parts).find((part) => part.functionResponse?.name === "inspect_page")?.functionResponse?.response.result;
    if (!observation) return callResponse("inspect_page");
    observed.push(JSON.stringify(observation));
    const target = ["focus", "question"].includes(observation.event) ? observation.field : observation.fields.find((field) => field.invalid) || observation.fields.find((field) => field.required && !field.filled) || observation.field;
    return callResponse("guide_user", { ...guidance, title: `Help with ${target.label}`, targetId: target.id, action: target.invalid ? "fix_error" : "highlight", explanation: target.invalid ? "Check the email format requested by the portal." : observation.event === "question" ? "This is the answer to your field question." : `Enter your own ${target.label.toLowerCase()} in the highlighted box.` });
  } } } as unknown as GoogleGenAI;
  const app = express(); installGuideRoutes(app, { client });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const temp = await mkdtemp(path.join(tmpdir(), "passport-guide-test-"));
  const extension = path.join(temp, "extension");
  await cp(fileURLToPath(new URL("../../../extensions/passport-guide", import.meta.url)), extension, { recursive: true });
  const workerPath = path.join(extension, "background.js");
  await writeFile(workerPath, (await readFile(workerPath, "utf8")).replace("127.0.0.1:8787", `127.0.0.1:${address.port}`));
  const manifestPath = path.join(extension, "manifest.json");
  await writeFile(manifestPath, (await readFile(manifestPath, "utf8")).replace("127.0.0.1:8787", `127.0.0.1:${address.port}`));
  let browser;
  try {
    browser = await chromium.launchPersistentContext(path.join(temp, "profile"), { headless: true, channel: "chromium", viewport: { width: 1280, height: 900 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    const page = await browser.newPage();
    await page.route("https://www.passportindia.gov.in/**", (route) => route.fulfill({ contentType: "text/html", body: `<html><head><title>Passport fixture</title></head><body><main style="padding:50px;width:600px"><h1>Applicant details</h1><form><label for="name">Given name</label><input id="name" required style="display:block;margin:10px 0 30px;padding:12px"><label for="email">Email address</label><input id="email" type="email" required style="display:block;margin:10px 0 30px;padding:12px"><label for="password">Password</label><input id="password" type="password" style="display:block;padding:12px"><button type="button" id="next-page">Next</button></form></main></body></html>` }));
    await page.goto("https://www.passportindia.gov.in/forms/applicant");
    const toolbar = page.locator('[data-passport-guide="toolbar"]');
    const nameNote = page.locator('#name + [data-passport-guide="note"]');
    const emailNote = page.locator('#email + [data-passport-guide="note"]');
    await toolbar.locator(".settings > summary").click();
    await toolbar.locator("#ai").click();
    await page.waitForFunction(() => document.querySelector('#name + [data-passport-guide="note"]')?.shadowRoot?.querySelector(".status")?.textContent?.includes("AI explanation"));
    assert.match(await nameNote.locator("strong").innerText(), /Given name/);
    await page.locator("#name").fill("PRIVATE APPLICANT VALUE");
    await page.waitForFunction(() => document.activeElement?.id === "email");
    assert.equal(await page.locator("#email").inputValue(), "");
    await page.locator("#email").fill("INVALID PRIVATE EMAIL");
    await page.waitForTimeout(2400);
    assert.equal(await page.locator("#email").evaluate((el) => el === document.activeElement), true);
    await emailNote.locator("summary").click();
    await emailNote.locator("input").fill("What does this mean?");
    await emailNote.getByRole("button", { name: "Ask AI", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#email + [data-passport-guide="note"]')?.shadowRoot?.querySelector(".explanation")?.textContent?.includes("Check the email format"));
    const data = observed.join("\n");
    assert.equal(data.includes("PRIVATE APPLICANT VALUE"), false);
    assert.equal(data.includes("INVALID PRIVATE EMAIL"), false);
    await toolbar.locator("#hide").click();
    assert.equal(await nameNote.isVisible(), false);
    await toolbar.locator("#hide").click();
    assert.equal(await nameNote.isVisible(), true);
    await page.goto("https://www.passportindia.gov.in/forms/family");
    await page.waitForSelector('[data-passport-guide="note"]');
    assert.equal(await toolbar.locator("select").inputValue(), "fresh");
    await page.screenshot({ path: fileURLToPath(new URL("../../../guide-inline-integration.png", import.meta.url)), fullPage: true });
    const forbidden = await fetch(`http://127.0.0.1:${address.port}/api/guide`, { method: "POST", headers: { Origin: "https://evil.test", "Content-Type": "application/json" }, body: JSON.stringify(input) });
    assert.equal(forbidden.status, 403);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    assert.ok(path.resolve(temp).startsWith(`${path.resolve(tmpdir())}${path.sep}`));
    await rm(temp, { recursive: true, force: true });
  }
});
