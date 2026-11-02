import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

type Question = { label: string; name?: string; section?: string; help?: string; type?: string };
type Help = { id: string; title: string; explanation: string; example: string; caution: string; source: string; recognized: boolean };
const library: { PassportKnowledge?: { lookup: (field: Question) => Help; checkedOn: string } } = {};
// Execute only this versioned, local explanation library; no fetched code or applicant input.
runInNewContext(readFileSync(new URL("../../../extensions/passport-guide/passport-knowledge.js", import.meta.url), "utf8"), library);
export function passportQuestionHelp(field: Question) {
  return { ...library.PassportKnowledge!.lookup(field), referenceCheckedOn: library.PassportKnowledge!.checkedOn };
}
