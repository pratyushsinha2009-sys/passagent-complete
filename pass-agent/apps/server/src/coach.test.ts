import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

type Field = { id?: string; label: string; name?: string; type: string; required: boolean; filled?: boolean; invalid?: boolean; confirmed?: boolean; skipped?: boolean; options: string[] };
type Coach = {
  followUp: (field: Field) => { choices: { id: string; option: string | null }[] } | null;
  checkAnswer: (input: { field: Field; value: string; nativeValid?: boolean; matchingValue?: string; today?: string }) => { valid: boolean; message: string };
  nextQuestion: (fields: Field[], id: string) => string | null;
  stageFor: (fields: Field[]) => string;
};
const sandbox: { PassportCoach?: Coach } = {};
for (const file of ["passport-knowledge.js", "coach.js"]) runInNewContext(await readFile(new URL(`../../../extensions/passport-guide/${file}`, import.meta.url), "utf8"), sandbox);
const coach = sandbox.PassportCoach!;
const field = (patch: Partial<Field>): Field => ({ label: "Given name", type: "text", required: true, options: [], ...patch });

test("coach asks about employment and only suggests an actual unique visible option", () => {
  const answer = coach.followUp(field({ label: "Employment Type", type: "select-one", options: ["Select", "Student", "Private", "Self Employed", "Government"] }));
  assert.equal(answer?.choices.find((choice) => choice.id === "student")?.option, "Student");
  assert.equal(answer?.choices.find((choice) => choice.id === "self")?.option, "Self Employed");
  const ambiguous = coach.followUp(field({ label: "Employment Type", options: ["Student", "student"] }));
  assert.equal(ambiguous?.choices.find((choice) => choice.id === "student")?.option, null);
  assert.equal(coach.followUp(field({ label: "Citizenship", options: ["Yes", "No"] })), null);
  assert.equal(coach.followUp(field({ label: "Eligible for Non-ECR", options: ["Yes", "No"] })), null);
});

test("coach catches empty answers, invalid email and mismatched confirmations without repeating secrets", () => {
  assert.equal(coach.checkAnswer({ field: field({}), value: "" }).valid, false);
  assert.equal(coach.checkAnswer({ field: field({ type: "email" }), value: "bad-email", nativeValid: false }).valid, false);
  assert.equal(coach.checkAnswer({ field: field({ label: "Email ID *", type: "text" }), value: "bad-email", nativeValid: true }).valid, false);
  const result = coach.checkAnswer({ field: field({ label: "Confirm password", type: "password" }), value: "PRIVATE ONE", matchingValue: "PRIVATE TWO" });
  assert.equal(result.valid, false); assert.match(result.message, /do not match/); assert.equal(result.message.includes("PRIVATE"), false);
  assert.equal(coach.checkAnswer({ field: field({ label: "Confirm email", type: "email" }), value: "one@example.com", matchingValue: "two@example.com" }).valid, false);
});

test("coach rejects future or impossible birth dates and accepts a real past date", () => {
  const dob = field({ label: "Date of birth", type: "date" });
  assert.equal(coach.checkAnswer({ field: dob, value: "2999-01-01", today: "2026-10-31" }).valid, false);
  assert.equal(coach.checkAnswer({ field: dob, value: "2001-02-30", today: "2026-10-31" }).valid, false);
  assert.equal(coach.checkAnswer({ field: dob, value: "1998-02-12", today: "2026-10-31" }).valid, true);
});

test("coach tracks confirmed answers instead of assuming a nonempty answer was reviewed", () => {
  const fields = [field({ id: "f1", confirmed: true }), field({ id: "f2", filled: true }), field({ id: "f3", skipped: true }), field({ id: "f4", invalid: true })];
  assert.equal(coach.nextQuestion(fields, "f1"), "f4");
  assert.equal(coach.nextQuestion(fields.slice(0, 3), "f1"), "f2");
  assert.equal(coach.stageFor([field({ label: "Confirm password" })]), "account");
  assert.equal(coach.stageFor([field({ label: "Employment Type" })]), "applicant");
});
