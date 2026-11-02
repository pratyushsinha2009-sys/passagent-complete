import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { guideFailure } from "./guideFailure";
import { passportQuestionHelp } from "./passportKnowledge";

const extension = new URL("../../../extensions/passport-guide/", import.meta.url);
const helperSource = await readFile(new URL("guide-state.js", extension), "utf8");
type Field = { id: string; label: string; section?: string; type: string; required: boolean; filled: boolean; invalid: boolean; options: string[] };
type Observation = { url: string; heading: string; goal: string; stage: string; field: Field; fields: Field[] };
const sandbox: { PassportGuideState?: { chooseNext: (context: Observation) => string | null; observationKey: (context: Observation) => string } } = {};
runInNewContext(helperSource, sandbox);
const helpers = sandbox.PassportGuideState!;
const field = (id: string, patch: Partial<Field> = {}): Field => ({ id, label: id, type: "text", required: false, filled: false, invalid: false, options: [], ...patch });
const first = field("f1", { filled: true });
const page = (fields: Field[]): Observation => ({ url: "https://www.passportindia.gov.in/form", heading: "Applicant", goal: "fresh", stage: "applicant", field: first, fields });

test("passport knowledge explains specific questions and keeps family and address context", () => {
  const cases = [
    ["Are you eligible for Non-ECR category?", "", "", "non-ecr"],
    ["Given name", "fatherGivenName", "Family details", "father"],
    ["Surname", "motherSurname", "Mother's details", "mother"],
    ["Country", "birthCountry", "Applicant details", "birth-place"],
    ["Name", "", "Emergency contact", "emergency-name"],
    ["Is permanent address same as present address?", "", "Address", "same-address"],
    ["Visible distinguishing mark", "", "Applicant details", "mark"],
    ["Passport number", "", "Father's details", "passport-number"],
  ];
  for (const [label, name, section, topic] of cases) assert.equal(passportQuestionHelp({ label: label!, name, section }).id, topic, label);
  assert.match(passportQuestionHelp({ label: "Surname", name: "motherSurname", section: "Mother's details" }).explanation, /only.*mother's surname/);
  const unknown = passportQuestionHelp({ label: "j_idt42", name: "randomCode" });
  assert.equal(unknown.recognized, false);
  assert.match(unknown.explanation, /could not identify/);
  assert.equal(unknown.explanation.includes("This field"), false);
  assert.equal(passportQuestionHelp({ label: "Proof of date of birth", type: "file" }).id, "upload");
  assert.equal(passportQuestionHelp({ label: "Is your Login ID the same as your email?" }).id, "same-login-email");
  assert.equal(passportQuestionHelp({ label: "Have you ever been issued a passport?" }).id, "passport-ever");
});

test("offline next-step selection prioritizes errors, required answers, then remaining steps", () => {
  const required = field("f2", { required: true });
  const invalid = field("f3", { invalid: true });
  const next = field("f4", { label: "Next", type: "button" });
  assert.equal(helpers.chooseNext(page([first, required, invalid, next])), "f3");
  assert.equal(helpers.chooseNext(page([first, required, next])), "f2");
  assert.equal(helpers.chooseNext(page([first, { ...required, filled: true }, next])), "f4");
  assert.equal(helpers.chooseNext(page([first])), null);
});

test("old AI decisions become stale when options, labels, completion, goal or errors change", () => {
  const observation = page([first, field("f2", { label: "District" })]);
  const original = helpers.observationKey(observation);
  for (const patch of [{ label: "State" }, { section: "Permanent address" }, { options: ["New choice"] }, { filled: true }, { invalid: true }]) {
    const updated = page([first, { ...observation.fields[1]!, ...patch }]);
    assert.notEqual(helpers.observationKey(updated), original);
  }
  assert.notEqual(helpers.observationKey({ ...observation, goal: "reissue" }), original);
  const extra = { ...first, value: "PRIVATE INPUT" };
  assert.equal(helpers.observationKey(page([extra])).includes("PRIVATE INPUT"), false);
});

test("provider failures distinguish invalid credentials, quota, outages and timeouts without exposing raw errors", () => {
  assert.equal(guideFailure({ status: 403, message: "secret-key" }).code, "credentials");
  assert.equal(guideFailure({ status: 429 }).retryable, false);
  assert.equal(guideFailure({ status: 503 }).code, "provider_unavailable");
  const timeout = new Error("secret-key"); timeout.name = "TimeoutError";
  assert.equal(guideFailure(timeout).code, "timeout");
  assert.equal(JSON.stringify(guideFailure(timeout)).includes("secret-key"), false);
});

const backgroundSource = await readFile(new URL("background.js", extension), "utf8");
type Listener = (message: unknown, sender: { url: string }, respond: (reply: unknown) => void) => boolean | undefined;
function worker(fetcher: (url: string, init: RequestInit) => Promise<unknown>) {
  let listener: Listener | undefined;
  runInNewContext(backgroundSource, { URL, AbortSignal, fetch: fetcher, chrome: { runtime: { onMessage: { addListener: (callback: Listener) => { listener = callback; } } } } });
  return listener!;
}

test("extension bridge refuses foreign and lookalike websites", () => {
  let calls = 0;
  const listener = worker(async () => { calls++; return {}; });
  for (const url of ["https://evil.test", "https://passportindia.gov.in.evil.test", "http://www.passportindia.gov.in"]) {
    assert.equal(listener({ type: "passport_guide" }, { url }, () => assert.fail("Unauthorized reply")), undefined);
  }
  assert.equal(calls, 0);
});

test("extension bridge uses only the local endpoint and preserves recovery details", async () => {
  const listener = worker(async (url, init) => {
    assert.equal(url, "http://127.0.0.1:8787/api/guide");
    assert.equal(init.method, "POST");
    return { ok: false, json: async () => ({ error: "Quota reached", code: "quota", retryable: false }) };
  });
  const reply = await new Promise<unknown>((resolve) => {
    assert.equal(listener({ type: "passport_guide", context: { safe: true } }, { url: "https://services2.passportindia.gov.in/form" }, resolve), true);
  });
  assert.deepEqual(JSON.parse(JSON.stringify(reply)), { ok: false, error: "Quota reached", code: "quota", retryable: false });
});

test("extension bridge explains a stopped local server and allows retry", async () => {
  const listener = worker(async () => { throw new TypeError("Failed to fetch"); });
  const reply = await new Promise<unknown>((resolve) => listener({ type: "passport_guide", context: {} }, { url: "https://www.passportindia.gov.in/" }, resolve)) as { code: string; retryable: boolean; error: string };
  assert.equal(reply.code, "connection");
  assert.equal(reply.retryable, true);
  assert.match(reply.error, /Start PassAgent/);
});
