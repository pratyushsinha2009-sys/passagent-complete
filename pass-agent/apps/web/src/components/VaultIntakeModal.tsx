import { useState, type FormEvent, type ReactNode } from "react";
import {
  ApplicantVaultSchema,
  EducationSchema,
  EmploymentTypeSchema,
  GenderSchema,
  MaritalStatusSchema,
  type Address,
  type ApplicantVault,
} from "@pass-agent/shared";
import { useAgentStore } from "../store/useAgentStore";

const emptyAddress = (): Address => ({
  houseAndStreet: "",
  cityOrVillage: "",
  district: "",
  state: "",
  pinCode: "",
  policeStation: "",
});

const initialVault = (): ApplicantVault => ({
  service: { applicationType: "fresh", scheme: "normal", bookletPages: "36", preferredPassportOfficeCity: "" },
  applicant: {
    givenName: "",
    surname: "",
    knownByOtherNames: false,
    otherNames: "",
    gender: "male",
    dateOfBirth: "",
    placeOfBirth: { cityOrVillage: "", district: "", state: "", country: "India" },
    maritalStatus: "single",
    citizenshipBy: "birth",
    employmentType: "private",
    education: "graduate_or_above",
    visibleDistinguishingMark: "",
  },
  family: { fatherName: "", motherName: "", legalGuardianName: "", spouseName: "" },
  contact: {
    mobile: "",
    email: "",
    presentAddress: emptyAddress(),
    permanentSameAsPresent: true,
    permanentAddress: null,
  },
  emergencyContact: { name: "", address: "", mobile: "" },
});

const humanize = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

type Errors = Record<string, string>;

function Field(props: { label: string; path: string; errors: Errors; children: ReactNode; className?: string }) {
  const err = props.errors[props.path];
  return (
    <label className={props.className}>
      <span className="field-label">{props.label}</span>
      {props.children}
      {err && <span className="mt-1 block text-xs text-red-400">{err}</span>}
    </label>
  );
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-800 p-4">
      <legend className="px-1 text-sm font-semibold text-saffron-500">{props.title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{props.children}</div>
    </fieldset>
  );
}

function AddressFields(props: {
  prefix: string;
  value: Address;
  onChange: (next: Address) => void;
  errors: Errors;
}) {
  const set = (key: keyof Address) => (e: { target: { value: string } }) =>
    props.onChange({ ...props.value, [key]: e.target.value });
  const rows: [keyof Address, string][] = [
    ["houseAndStreet", "House no. & street"],
    ["cityOrVillage", "City / village"],
    ["district", "District"],
    ["state", "State / UT"],
    ["pinCode", "PIN code"],
    ["policeStation", "Police station"],
  ];
  return (
    <>
      {rows.map(([key, label]) => (
        <Field key={key} label={label} path={`${props.prefix}.${key}`} errors={props.errors}>
          <input
            className="field-input"
            value={props.value[key]}
            onChange={set(key)}
            inputMode={key === "pinCode" ? "numeric" : undefined}
          />
        </Field>
      ))}
    </>
  );
}

export default function VaultIntakeModal({ onClose }: { onClose: () => void }) {
  const startAgent = useAgentStore((s) => s.startAgent);
  const connection = useAgentStore((s) => s.connection);
  const [v, setV] = useState<ApplicantVault>(initialVault);
  const [errors, setErrors] = useState<Errors>({});

  const update = <K extends keyof ApplicantVault>(section: K, patch: Partial<ApplicantVault[K]>) =>
    setV((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const candidate: ApplicantVault = {
      ...v,
      contact: {
        ...v.contact,
        permanentAddress: v.contact.permanentSameAsPresent ? null : (v.contact.permanentAddress ?? emptyAddress()),
      },
    };
    const parsed = ApplicantVaultSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    startAgent(parsed.data);
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={onSubmit}
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Applicant vault</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Your answers and page observations are sent to Google Gemini to operate the form. They are not saved to browser storage. Passwords,
              OTPs, Aadhaar and PAN are never collected here — you type those into the portal yourself.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Section title="Service">
            <Field label="Application type" path="service.applicationType" errors={errors}>
              <select
                className="field-input"
                value={v.service.applicationType}
                onChange={(e) => update("service", { applicationType: e.target.value as ApplicantVault["service"]["applicationType"] })}
              >
                <option value="fresh">Fresh passport</option>
                <option value="reissue">Re-issue of passport</option>
              </select>
            </Field>
            <Field label="Scheme" path="service.scheme" errors={errors}>
              <select
                className="field-input"
                value={v.service.scheme}
                onChange={(e) => update("service", { scheme: e.target.value as ApplicantVault["service"]["scheme"] })}
              >
                <option value="normal">Normal</option>
                <option value="tatkaal">Tatkaal</option>
              </select>
            </Field>
            <Field label="Booklet pages" path="service.bookletPages" errors={errors}>
              <select
                className="field-input"
                value={v.service.bookletPages}
                onChange={(e) => update("service", { bookletPages: e.target.value as ApplicantVault["service"]["bookletPages"] })}
              >
                <option value="36">36 pages</option>
                <option value="60">60 pages</option>
              </select>
            </Field>
            <Field label="Preferred passport office city" path="service.preferredPassportOfficeCity" errors={errors}>
              <input
                className="field-input"
                value={v.service.preferredPassportOfficeCity}
                onChange={(e) => update("service", { preferredPassportOfficeCity: e.target.value })}
              />
            </Field>
          </Section>

          <Section title="Applicant">
            <Field label="Given name (first + middle)" path="applicant.givenName" errors={errors}>
              <input className="field-input" value={v.applicant.givenName} onChange={(e) => update("applicant", { givenName: e.target.value })} />
            </Field>
            <Field label="Surname (leave blank if none)" path="applicant.surname" errors={errors}>
              <input className="field-input" value={v.applicant.surname} onChange={(e) => update("applicant", { surname: e.target.value })} />
            </Field>
            <Field label="Gender" path="applicant.gender" errors={errors}>
              <select
                className="field-input"
                value={v.applicant.gender}
                onChange={(e) => update("applicant", { gender: GenderSchema.parse(e.target.value) })}
              >
                {GenderSchema.options.map((g) => (
                  <option key={g} value={g}>{humanize(g)}</option>
                ))}
              </select>
            </Field>
            <Field label="Date of birth" path="applicant.dateOfBirth" errors={errors}>
              <input
                type="date"
                className="field-input"
                value={v.applicant.dateOfBirth}
                onChange={(e) => update("applicant", { dateOfBirth: e.target.value })}
              />
            </Field>
            <Field label="Place of birth — city / village" path="applicant.placeOfBirth.cityOrVillage" errors={errors}>
              <input
                className="field-input"
                value={v.applicant.placeOfBirth.cityOrVillage}
                onChange={(e) => update("applicant", { placeOfBirth: { ...v.applicant.placeOfBirth, cityOrVillage: e.target.value } })}
              />
            </Field>
            <Field label="Place of birth — district" path="applicant.placeOfBirth.district" errors={errors}>
              <input
                className="field-input"
                value={v.applicant.placeOfBirth.district}
                onChange={(e) => update("applicant", { placeOfBirth: { ...v.applicant.placeOfBirth, district: e.target.value } })}
              />
            </Field>
            <Field label="Place of birth — state" path="applicant.placeOfBirth.state" errors={errors}>
              <input
                className="field-input"
                value={v.applicant.placeOfBirth.state}
                onChange={(e) => update("applicant", { placeOfBirth: { ...v.applicant.placeOfBirth, state: e.target.value } })}
              />
            </Field>
            <Field label="Place of birth — country" path="applicant.placeOfBirth.country" errors={errors}>
              <input
                className="field-input"
                value={v.applicant.placeOfBirth.country}
                onChange={(e) => update("applicant", { placeOfBirth: { ...v.applicant.placeOfBirth, country: e.target.value } })}
              />
            </Field>
            <Field label="Marital status" path="applicant.maritalStatus" errors={errors}>
              <select
                className="field-input"
                value={v.applicant.maritalStatus}
                onChange={(e) => update("applicant", { maritalStatus: MaritalStatusSchema.parse(e.target.value) })}
              >
                {MaritalStatusSchema.options.map((m) => (
                  <option key={m} value={m}>{humanize(m)}</option>
                ))}
              </select>
            </Field>
            <Field label="Citizenship by" path="applicant.citizenshipBy" errors={errors}>
              <select
                className="field-input"
                value={v.applicant.citizenshipBy}
                onChange={(e) => update("applicant", { citizenshipBy: e.target.value as ApplicantVault["applicant"]["citizenshipBy"] })}
              >
                <option value="birth">Birth</option>
                <option value="descent">Descent</option>
                <option value="registration_naturalization">Registration / naturalization</option>
              </select>
            </Field>
            <Field label="Employment type" path="applicant.employmentType" errors={errors}>
              <select
                className="field-input"
                value={v.applicant.employmentType}
                onChange={(e) => update("applicant", { employmentType: EmploymentTypeSchema.parse(e.target.value) })}
              >
                {EmploymentTypeSchema.options.map((m) => (
                  <option key={m} value={m}>{humanize(m)}</option>
                ))}
              </select>
            </Field>
            <Field label="Education" path="applicant.education" errors={errors}>
              <select
                className="field-input"
                value={v.applicant.education}
                onChange={(e) => update("applicant", { education: EducationSchema.parse(e.target.value) })}
              >
                {EducationSchema.options.map((m) => (
                  <option key={m} value={m}>{humanize(m)}</option>
                ))}
              </select>
            </Field>
            <Field label="Visible distinguishing mark (optional)" path="applicant.visibleDistinguishingMark" errors={errors}>
              <input
                className="field-input"
                value={v.applicant.visibleDistinguishingMark}
                onChange={(e) => update("applicant", { visibleDistinguishingMark: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={v.applicant.knownByOtherNames}
                onChange={(e) => update("applicant", { knownByOtherNames: e.target.checked })}
              />
              Known by other names / aliases
            </label>
            {v.applicant.knownByOtherNames && (
              <Field label="Other names (comma separated)" path="applicant.otherNames" errors={errors} className="sm:col-span-2">
                <input className="field-input" value={v.applicant.otherNames} onChange={(e) => update("applicant", { otherNames: e.target.value })} />
              </Field>
            )}
          </Section>

          <Section title="Family">
            <Field label="Father's name" path="family.fatherName" errors={errors}>
              <input className="field-input" value={v.family.fatherName} onChange={(e) => update("family", { fatherName: e.target.value })} />
            </Field>
            <Field label="Mother's name" path="family.motherName" errors={errors}>
              <input className="field-input" value={v.family.motherName} onChange={(e) => update("family", { motherName: e.target.value })} />
            </Field>
            <Field label="Legal guardian (if applicable)" path="family.legalGuardianName" errors={errors}>
              <input className="field-input" value={v.family.legalGuardianName} onChange={(e) => update("family", { legalGuardianName: e.target.value })} />
            </Field>
            <Field label="Spouse's name (if married)" path="family.spouseName" errors={errors}>
              <input className="field-input" value={v.family.spouseName} onChange={(e) => update("family", { spouseName: e.target.value })} />
            </Field>
          </Section>

          <Section title="Contact & present address">
            <Field label="Mobile" path="contact.mobile" errors={errors}>
              <input className="field-input" inputMode="numeric" value={v.contact.mobile} onChange={(e) => update("contact", { mobile: e.target.value })} />
            </Field>
            <Field label="Email" path="contact.email" errors={errors}>
              <input type="email" className="field-input" value={v.contact.email} onChange={(e) => update("contact", { email: e.target.value })} />
            </Field>
            <AddressFields
              prefix="contact.presentAddress"
              value={v.contact.presentAddress}
              onChange={(presentAddress) => update("contact", { presentAddress })}
              errors={errors}
            />
            <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={v.contact.permanentSameAsPresent}
                onChange={(e) =>
                  update("contact", {
                    permanentSameAsPresent: e.target.checked,
                    permanentAddress: e.target.checked ? null : (v.contact.permanentAddress ?? emptyAddress()),
                  })
                }
              />
              Permanent address is the same as present address
            </label>
            {!v.contact.permanentSameAsPresent && (
              <AddressFields
                prefix="contact.permanentAddress"
                value={v.contact.permanentAddress ?? emptyAddress()}
                onChange={(permanentAddress) => update("contact", { permanentAddress })}
                errors={errors}
              />
            )}
          </Section>

          <Section title="Emergency contact">
            <Field label="Name" path="emergencyContact.name" errors={errors}>
              <input className="field-input" value={v.emergencyContact.name} onChange={(e) => update("emergencyContact", { name: e.target.value })} />
            </Field>
            <Field label="Mobile" path="emergencyContact.mobile" errors={errors}>
              <input
                className="field-input"
                inputMode="numeric"
                value={v.emergencyContact.mobile}
                onChange={(e) => update("emergencyContact", { mobile: e.target.value })}
              />
            </Field>
            <Field label="Address" path="emergencyContact.address" errors={errors} className="sm:col-span-2">
              <textarea
                className="field-input"
                rows={2}
                value={v.emergencyContact.address}
                onChange={(e) => update("emergencyContact", { address: e.target.value })}
              />
            </Field>
          </Section>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <span className="text-xs text-red-400">
            {errorCount > 0 ? `${errorCount} field${errorCount > 1 ? "s" : ""} need attention` : ""}
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={connection !== "open"}>
              Start co-pilot
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
