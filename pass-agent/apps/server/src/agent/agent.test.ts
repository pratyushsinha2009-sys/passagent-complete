import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import type { GoogleGenAI } from "@google/genai";
import { ApplicantVaultSchema, isAllowedPortalUrl, type ApplicantVault, type ServerMessage } from "@pass-agent/shared";
import { PlaywrightManager } from "../browser/playwrightManager";
import { distillPage } from "../browser/domDistiller";
import { executeTool, type ToolContext } from "./tools";
import { AgentOrchestrator } from "./orchestrator";
import { isSourcedAnswer } from "./answers";

const address = { houseAndStreet: "12 Test Street", cityOrVillage: "Pune", district: "Pune", state: "Maharashtra", pinCode: "411001", policeStation: "Test station" };
const vault: ApplicantVault = {
  service: { applicationType: "fresh", scheme: "normal", bookletPages: "36", preferredPassportOfficeCity: "Pune" },
  applicant: { givenName: "Test Applicant", surname: "Example", knownByOtherNames: false, otherNames: "", gender: "female", dateOfBirth: "1998-02-12", placeOfBirth: { cityOrVillage: "Pune", district: "Pune", state: "Maharashtra", country: "India" }, maritalStatus: "single", citizenshipBy: "birth", employmentType: "private", education: "graduate_or_above", visibleDistinguishingMark: "" },
  family: { fatherName: "", motherName: "", spouseName: "", legalGuardianName: "" },
  contact: { mobile: "9876543210", email: "test@example.com", presentAddress: address, permanentSameAsPresent: true, permanentAddress: null },
  emergencyContact: { name: "Emergency Example", mobile: "9876543211", address: "12 Test Street" },
};

test("portal navigation rejects lookalikes, embedded credentials and non-HTTPS URLs", () => {
  assert.equal(isAllowedPortalUrl("https://services2.passportindia.gov.in/forms/registration"), true);
  for (const url of ["https://passportindia.gov.in.evil.test", "http://passportindia.gov.in", "data:text/html,hello", "about:blank", "https://me:secret@passportindia.gov.in", "https://passportindia.gov.in:9443"]) assert.equal(isAllowedPortalUrl(url), false, url);
});

test("intake rejects impossible dates, missing alias and missing permanent address", () => {
  assert.equal(ApplicantVaultSchema.safeParse(vault).success, true);
  for (const dateOfBirth of ["1998-02-30", "2999-01-01"]) assert.equal(ApplicantVaultSchema.safeParse({ ...vault, applicant: { ...vault.applicant, dateOfBirth } }).success, false);
  assert.equal(ApplicantVaultSchema.safeParse({ ...vault, applicant: { ...vault.applicant, knownByOtherNames: true } }).success, false);
  assert.equal(ApplicantVaultSchema.safeParse({ ...vault, contact: { ...vault.contact, permanentSameAsPresent: false } }).success, false);
});

test("text answers require a real source and allow date formatting", () => {
  assert.equal(isSourcedAnswer(vault, "applicant.givenName", "TEST APPLICANT"), true);
  assert.equal(isSourcedAnswer(vault, "applicant.dateOfBirth", "12/02/1998"), true);
  assert.equal(isSourcedAnswer(vault, "applicant.givenName", "Invented Name"), false);
  assert.equal(isSourcedAnswer(vault, "__proto__.givenName", "Test Applicant"), false);
});

test("real browser tools fill sourced answers, enforce consent, upload and honor cancellation", { timeout: 45_000 }, async () => {
  const browser = new PlaywrightManager({ headless: true, onFrame: () => {} });
  await browser.launch();
  try {
    await browser.page.setContent(`<label>Given name<input id="name"></label><label>Password<input type="password"></label>
      <label>Education<select aria-label="Education"><option>Graduate and above</option><option>Graduate</option></select></label>
      <label>I agree to the declaration<input type="checkbox"></label><input type="file" aria-label="Address proof" style="display:none">
      <button onclick="this.dataset.clicked='yes'">Submit application</button><button>Make payment</button>`);
    const snapshot = await distillPage(browser.page);
    const id = (label: string) => snapshot.elements.find((element) => element.label === label)!.id;
    const controller = new AbortController();
    const handoffs: string[] = [];
    const ctx: ToolContext = { browser, vault, signal: controller.signal, snapshot, log: () => {},
      requestHuman: async (request) => { handoffs.push(request.kind); return { requestId: "test", decision: "reject" }; } };
    let result = await executeTool("fill_field", { element_id: id("Given name"), vault_path: "applicant.givenName", value: "Invented" }, ctx);
    assert.equal(result.isError, true);
    assert.equal(await browser.page.locator("#name").inputValue(), "");
    result = await executeTool("fill_field", { element_id: id("Given name"), vault_path: "applicant.givenName", value: vault.applicant.givenName }, ctx);
    assert.equal(result.isError, false);
    assert.equal(await browser.page.locator("#name").inputValue(), vault.applicant.givenName);
    await executeTool("fill_field", { element_id: id("Password"), vault_path: "applicant.givenName", value: "abc" }, ctx);
    assert.equal(handoffs.at(-1), "sensitive_input");
    await executeTool("click_element", { element_id: id("I agree to the declaration"), rationale: "Continue" }, ctx);
    assert.equal(handoffs.at(-1), "confirm_action");
    assert.equal(await browser.page.locator('[type="checkbox"]').isChecked(), false);
    await executeTool("click_element", { element_id: id("Submit application"), rationale: "Submit" }, ctx);
    assert.equal(await browser.page.locator("button").first().getAttribute("data-clicked"), null);
    await executeTool("click_element", { element_id: id("Make payment"), rationale: "Pay" }, ctx);
    assert.equal(handoffs.at(-1), "payment");
    result = await executeTool("select_option", { element_id: id("Education"), option_label: "Grad" }, ctx);
    assert.equal(result.isError, true);
    await executeTool("request_human", { kind: "document_upload", reason: "Proof needed", question: "Select your file", options: [] }, { ...ctx, requestHuman: async (request) => {
      assert.equal(request.actionPreview?.elementId, id("Address proof"));
      await browser.locator(request.actionPreview!.elementId).setInputFiles({ name: "proof.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nTest fixture") });
      return { requestId: "test", decision: "done" };
    } });
    assert.equal(await browser.page.locator('[type="file"]').evaluate((el: HTMLInputElement) => el.files?.[0]?.name), "proof.pdf");
    // Consent cannot be replayed after the page changes during the human review.
    result = await executeTool("click_element", { element_id: id("Submit application"), rationale: "Submit" }, { ...ctx, requestHuman: async () => {
      await browser.page.locator("button").first().evaluate((el) => { el.textContent = "Delete application"; });
      return { requestId: "test", decision: "approve" };
    } });
    assert.equal(result.isError, true);
    controller.abort();
    await assert.rejects(executeTool("fill_field", { element_id: id("Given name"), value: "x", vault_path: "applicant.givenName" }, ctx));
  } finally { await browser.close(); }
});

async function until(check: () => boolean) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) { if (check()) return; await delay(20); }
  assert.fail("Timed out waiting for agent state");
}

test("orchestrator pauses, replans after takeover, validates handoff responses and completes", { timeout: 20_000 }, async () => {
  const browser = new PlaywrightManager({ headless: true, onFrame: () => {} });
  const messages: ServerMessage[] = [];
  let release: ((value: unknown) => void) | undefined;
  let calls = 0;
  const client = { models: { generateContent: async () => {
    calls++;
    if (calls === 1) return await new Promise((resolve) => { release = resolve; });
    const call = calls === 2
      ? { name: "request_human", args: { kind: "login", reason: "Login needed", question: "Please log in", options: [] } }
      : { name: "task_complete", args: { summary: "Fixture completed", success: true } };
    return { candidates: [{ content: { parts: [{ functionCall: call }] } }] };
  } } } as unknown as GoogleGenAI;
  const agent = new AgentOrchestrator({ browser, client, emit: (message) => messages.push(message) });
  try {
    agent.start(vault);
    await until(() => Boolean(release));
    agent.pause();
    release!({ candidates: [{ content: { parts: [{ functionCall: { name: "task_complete", args: { summary: "Stale completion", success: true } } }] } }] });
    await until(() => agent.currentStatus === "paused");
    agent.resume();
    await until(() => agent.currentStatus === "awaiting_human");
    const request = agent.pendingRequest!;
    agent.resolveHitl({ requestId: request.id, decision: "approve" });
    assert.equal(agent.currentStatus, "awaiting_human");
    agent.resolveHitl({ requestId: request.id, decision: "done" });
    await until(() => agent.currentStatus === "completed");
    assert.equal(messages.some((message) => message.type === "timeline" && message.event.detail === "Stale completion"), false);
  } finally { agent.stop(); await browser.close(); }
});

test("model silence is reported as failure instead of successful completion", { timeout: 20_000 }, async () => {
  const browser = new PlaywrightManager({ headless: true, onFrame: () => {} });
  const client = { models: { generateContent: async () => ({ candidates: [{ content: { parts: [{ text: "I am done" }] } }] }) } } as unknown as GoogleGenAI;
  const agent = new AgentOrchestrator({ browser, client, emit: () => {} });
  try { agent.start(vault); await until(() => agent.currentStatus === "failed"); }
  finally { agent.stop(); await browser.close(); }
});
