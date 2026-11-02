import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  await page.goto("https://www.passportindia.gov.in/forms/registration", { waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.waitForFunction(() => document.body.innerText.includes("Full Name"), {}, { timeout: 12_000 });
  // Public-page visual/reader verification only. No form answers or credentials are entered.
  await page.evaluate(`globalThis.chrome={storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{sendMessage:async()=>({ok:false,error:'AI is not used in this public-page check.'})}}`);
  for (const file of ["guidance-languages.js", "languages.js", "guide-state.js", "passport-knowledge.js", "coach.js", "field-reader.js", "inline-theme.js", "content.js"]) await page.addScriptTag({ content: await readFile(new URL(`../../../extensions/passport-guide/${file}`, import.meta.url), "utf8") });
  await page.waitForSelector('[data-passport-guide="note"]');
  const fields = await page.evaluate<unknown[]>(`[...PassportFieldReader.customChoices(),...document.querySelectorAll('input[data-testid="text-input-outlined"]')].filter(el=>el.getBoundingClientRect().width>1&&PassportFieldReader.radioGroup(el)[0]===el).map((el,index)=>{const field=PassportFieldReader.read(el,'f'+index);return {label:field.label,type:field.type,required:field.required,options:field.options,topic:PassportKnowledge.lookup(field).id}})`);
  const unknown = fields.filter((field) => (field as { topic: string }).topic === "unidentified");
  const expectedTopics = ["register-office", "given-name", "email", "same-login-email", "login-id", "password", "captcha"];
  const missing = expectedTopics.filter((topic) => !fields.some((field) => (field as { topic: string }).topic === topic));
  await writeFile(new URL("../../../registration-verification.json", import.meta.url), JSON.stringify({ publicPage: page.url(), controls: fields, unrecognized: unknown.length, missingExpectedQuestions: missing, filledOrSubmitted: false }, null, 2));
  await page.screenshot({ path: fileURLToPath(new URL("../../../passport-coach-registration.png", import.meta.url)), fullPage: true });
  console.log(`Public registration page: ${fields.length - unknown.length}/${fields.length} questions recognized. No form answers entered or submitted.`);
  if (!fields.length || unknown.length || missing.length) { console.log(`Missing expected questions: ${missing.join(", ") || "none"}`); process.exitCode = 1; }
} catch {
  console.error("Public registration verification could not finish. Live compatibility remains unverified.");
  process.exitCode = 1;
} finally { await browser.close(); }
