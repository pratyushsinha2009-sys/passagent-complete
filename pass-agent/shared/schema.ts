import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Portal constants                                                    */
/* ------------------------------------------------------------------ */

export const PORTAL_START_URL = "https://www.passportindia.gov.in/";

/** Top-level navigations are only allowed to these hosts (exact or subdomain). */
export const PORTAL_ALLOWED_HOST_SUFFIXES = ["passportindia.gov.in"] as const;

export function isAllowedPortalUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.username || url.password || (url.port && url.port !== "443")) return false;
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return PORTAL_ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export const VIEWPORT = { width: 1280, height: 800 } as const;

/* ------------------------------------------------------------------ */
/* Applicant vault                                                     */
/* ------------------------------------------------------------------ */
/*
 * The vault holds the form answers the agent may type on the applicant's
 * behalf. By design it does NOT hold passwords, OTPs, Aadhaar, PAN or any
 * other national identifier — those are always typed by the human through
 * the live browser canvas during a HITL hand-off.
 */

const nonEmpty = z.string().trim().min(1, "Required");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date <= new Date();
  }, "Enter a real date of birth that is not in the future");
const indianMobile = z
  .string()
  .regex(/^[6-9]\d{9}$/, "10-digit Indian mobile number");
const pinCode = z.string().regex(/^[1-9]\d{5}$/, "6-digit PIN code");

export const GenderSchema = z.enum(["male", "female", "transgender"]);
export const MaritalStatusSchema = z.enum([
  "single",
  "married",
  "divorced",
  "widowed",
  "separated",
]);
export const EmploymentTypeSchema = z.enum([
  "government",
  "psu",
  "statutory_body",
  "private",
  "self_employed",
  "retired_government",
  "retired_private",
  "student",
  "homemaker",
  "not_employed",
  "others",
]);
export const EducationSchema = z.enum([
  "7th_pass_or_less",
  "8th_to_9th",
  "10th_or_above",
  "graduate_or_above",
]);

export const AddressSchema = z.object({
  houseAndStreet: nonEmpty,
  cityOrVillage: nonEmpty,
  district: nonEmpty,
  state: nonEmpty,
  pinCode,
  policeStation: nonEmpty,
});
export type Address = z.infer<typeof AddressSchema>;

export const ApplicantVaultSchema = z.object({
  service: z.object({
    applicationType: z.enum(["fresh", "reissue"]),
    scheme: z.enum(["normal", "tatkaal"]),
    bookletPages: z.enum(["36", "60"]),
    preferredPassportOfficeCity: nonEmpty,
  }),
  applicant: z.object({
    givenName: nonEmpty,
    surname: z.string().trim(),
    knownByOtherNames: z.boolean(),
    otherNames: z.string().trim(),
    gender: GenderSchema,
    dateOfBirth: isoDate,
    placeOfBirth: z.object({
      cityOrVillage: nonEmpty,
      district: nonEmpty,
      state: nonEmpty,
      country: nonEmpty,
    }),
    maritalStatus: MaritalStatusSchema,
    citizenshipBy: z.enum(["birth", "descent", "registration_naturalization"]),
    employmentType: EmploymentTypeSchema,
    education: EducationSchema,
    visibleDistinguishingMark: z.string().trim(),
  }),
  family: z.object({
    fatherName: z.string().trim(),
    motherName: z.string().trim(),
    legalGuardianName: z.string().trim(),
    spouseName: z.string().trim(),
  }),
  contact: z.object({
    mobile: indianMobile,
    email: z.string().email(),
    presentAddress: AddressSchema,
    permanentSameAsPresent: z.boolean(),
    permanentAddress: AddressSchema.nullable(),
  }),
  emergencyContact: z.object({
    name: nonEmpty,
    address: nonEmpty,
    mobile: indianMobile,
  }),
}).superRefine((vault, ctx) => {
  if (vault.applicant.knownByOtherNames && !vault.applicant.otherNames) {
    ctx.addIssue({ code: "custom", path: ["applicant", "otherNames"], message: "Enter your other names" });
  }
  if (!vault.contact.permanentSameAsPresent && !vault.contact.permanentAddress) {
    ctx.addIssue({ code: "custom", path: ["contact", "permanentAddress"], message: "Enter your permanent address" });
  }
});
export type ApplicantVault = z.infer<typeof ApplicantVaultSchema>;

/* ------------------------------------------------------------------ */
/* Agent state & timeline                                              */
/* ------------------------------------------------------------------ */

export const AgentStatusSchema = z.enum([
  "idle",
  "starting",
  "running",
  "paused",
  "awaiting_human",
  "completed",
  "failed",
  "stopped",
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const TimelineKindSchema = z.enum([
  "info",
  "thought",
  "action",
  "observation",
  "hitl",
  "policy",
  "error",
  "success",
]);
export type TimelineKind = z.infer<typeof TimelineKindSchema>;

export const TimelineEventSchema = z.object({
  id: z.string(),
  ts: z.number(),
  kind: TimelineKindSchema,
  title: z.string(),
  detail: z.string().optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

/* ------------------------------------------------------------------ */
/* Human-in-the-loop                                                   */
/* ------------------------------------------------------------------ */

export const HitlKindSchema = z.enum([
  /** Human must solve a CAPTCHA in the live canvas. */
  "captcha",
  /** Human must enter an OTP received on their phone/email. */
  "otp",
  /** Human must log in / register (passwords are never handled by the agent). */
  "login",
  /** Field holds a national ID / secret the agent must not type. */
  "sensitive_input",
  /** Agent wants to click an irreversible control (submit, final save…). */
  "confirm_action",
  /** Payment step — always human-driven. */
  "payment",
  /** File/document upload the human must perform. */
  "document_upload",
  /** Agent is unsure which value/option to use and asks the human. */
  "ambiguity",
]);
export type HitlKind = z.infer<typeof HitlKindSchema>;

export const HitlRequestSchema = z.object({
  id: z.string(),
  kind: HitlKindSchema,
  reason: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  /** For confirm_action: what will be clicked. */
  actionPreview: z
    .object({ elementId: z.string(), label: z.string() })
    .nullable(),
  createdAt: z.number(),
});
export type HitlRequest = z.infer<typeof HitlRequestSchema>;

export const HitlDecisionSchema = z.enum([
  /** confirm_action / payment: go ahead. */
  "approve",
  /** Decline the proposed action or abort the hand-off. */
  "reject",
  /** Human finished the hand-off task in the canvas; agent may resume. */
  "done",
  /** Human answered an ambiguity question (see `answer`). */
  "answer",
]);
export type HitlDecision = z.infer<typeof HitlDecisionSchema>;

export const HitlResponseSchema = z.object({
  requestId: z.string(),
  decision: HitlDecisionSchema,
  answer: z.string().max(2000).optional(),
});
export type HitlResponse = z.infer<typeof HitlResponseSchema>;

/* ------------------------------------------------------------------ */
/* Canvas input (human takeover of the live browser)                   */
/* ------------------------------------------------------------------ */

export const CanvasInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("click"),
    x: z.number().min(0).max(VIEWPORT.width),
    y: z.number().min(0).max(VIEWPORT.height),
  }),
  z.object({
    kind: z.literal("scroll"),
    x: z.number().min(0).max(VIEWPORT.width),
    y: z.number().min(0).max(VIEWPORT.height),
    deltaY: z.number().min(-5000).max(5000),
  }),
  z.object({ kind: z.literal("type"), text: z.string().min(1).max(500) }),
  z.object({
    kind: z.literal("key"),
    key: z.enum([
      "Backspace",
      "Delete",
      "Enter",
      "Tab",
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ]),
    shift: z.boolean().optional(),
  }),
]);
export type CanvasInput = z.infer<typeof CanvasInputSchema>;

/* ------------------------------------------------------------------ */
/* WebSocket protocol                                                  */
/* ------------------------------------------------------------------ */

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), vault: ApplicantVaultSchema }),
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({
    type: z.literal("upload"),
    requestId: z.string(),
    elementId: z.string().regex(/^e\d+$/),
    name: z.string().min(1).max(200).regex(/^[^\\/]+$/),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    data: z.string().min(4).max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  }),
  z.object({ type: z.literal("hitl_response"), response: HitlResponseSchema }),
  z.object({ type: z.literal("input"), input: CanvasInputSchema }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const FrameSchema = z.object({
  /** Base64 JPEG without the data: prefix. */
  data: z.string(),
  width: z.number(),
  height: z.number(),
  url: z.string(),
});
export type Frame = z.infer<typeof FrameSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status"), status: AgentStatusSchema }),
  z.object({ type: z.literal("timeline"), event: TimelineEventSchema }),
  z.object({ type: z.literal("frame"), frame: FrameSchema }),
  z.object({ type: z.literal("hitl_request"), request: HitlRequestSchema }),
  z.object({ type: z.literal("hitl_resolved"), requestId: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("upload_complete"), requestId: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

/** Statuses during which the human may drive the canvas directly. */
export const HUMAN_INPUT_STATUSES: readonly AgentStatus[] = [
  "idle",
  "paused",
  "awaiting_human",
  "completed",
  "failed",
  "stopped",
];
