import type { ApplicantVault } from "@pass-agent/shared";

/** Only allow text that has an applicant-provided source; no model inventions. */
export function isSourcedAnswer(vault: ApplicantVault, path: string, value: string): boolean {
  const keys = path.split(".");
  if (keys.some((key) => !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key))) return false;
  let source: unknown = vault;
  for (const key of keys) {
    if (!source || typeof source !== "object" || !Object.hasOwn(source, key)) return false;
    source = (source as Record<string, unknown>)[key];
  }
  if (typeof source !== "string" || !source.trim()) return false;
  const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
  if (normalize(source) === normalize(value)) return true;
  if (path === "applicant.dateOfBirth") {
    const [year, month, day] = source.split("-");
    return [`${day}/${month}/${year}`, `${day}-${month}-${year}`].includes(value);
  }
  return false;
}
