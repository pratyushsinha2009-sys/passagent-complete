import type { Page } from "playwright";
import { z } from "zod";

/*
 * Reduces the live DOM to a compact, LLM-friendly list of interactive
 * elements. Each element gets a stable `data-pa-id` attribute so tools can
 * target it later with `[data-pa-id="eN"]`.
 *
 * The in-page script is a plain JS string rather than a TS function: tsx /
 * esbuild inject helpers (e.g. `__name`) into compiled functions, and those
 * helpers do not exist inside the browser when Playwright serialises them.
 */

export const DistilledElementSchema = z.object({
  id: z.string(),
  tag: z.string(),
  type: z.string(),
  label: z.string(),
  name: z.string(),
  value: z.string(),
  checked: z.boolean().nullable(),
  required: z.boolean(),
  disabled: z.boolean(),
  options: z.array(z.string()),
  sensitive: z.boolean(),
  inViewport: z.boolean(),
});
export type DistilledElement = z.infer<typeof DistilledElementSchema>;

export const DistilledPageSchema = z.object({
  url: z.string(),
  title: z.string(),
  headings: z.array(z.string()),
  alerts: z.array(z.string()),
  captchaDetected: z.boolean(),
  otpFieldDetected: z.boolean(),
  fileInputDetected: z.boolean(),
  textSnippet: z.string(),
  elements: z.array(DistilledElementSchema),
});
export type DistilledPage = z.infer<typeof DistilledPageSchema>;

const MAX_ELEMENTS = 150;
const MAX_OPTIONS = 40;
const MAX_TEXT = 1800;

const DISTILL_SCRIPT = `(() => {
  const MAX_ELEMENTS = ${MAX_ELEMENTS};
  const MAX_OPTIONS = ${MAX_OPTIONS};
  const MAX_TEXT = ${MAX_TEXT};
  const SENSITIVE = /(password|passwd|pwd|aadha+r|uid\\b|\\bpan\\b|pan.?no|pan.?number|otp|one.?time|captcha|cvv|card.?number|ifsc|account.?no)/i;

  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim().slice(0, 160);

  const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  const labelFor = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria) return clean(aria);
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const txt = labelledBy.split(/\\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ");
      if (clean(txt)) return clean(txt);
    }
    if (el.id) {
      const lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (lbl && clean(lbl.textContent)) return clean(lbl.textContent);
    }
    const parentLabel = el.closest("label");
    if (parentLabel) {
      const copy = parentLabel.cloneNode(true);
      copy.querySelectorAll("input,select,textarea,button").forEach((child) => child.remove());
      if (clean(copy.textContent)) return clean(copy.textContent);
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") {
      const t = clean(el.textContent) || clean(el.getAttribute("value")) || clean(el.getAttribute("title"));
      if (t) return t;
    }
    if (tag === "input" && ["submit", "button", "reset"].includes((el.type || "").toLowerCase())) {
      return clean(el.value);
    }
    const ph = el.getAttribute("placeholder");
    if (ph) return clean(ph);
    // Table / grid layouts: use the nearest preceding cell or sibling text.
    const cell = el.closest("td, th, div");
    if (cell) {
      let prev = cell.previousElementSibling;
      while (prev && !clean(prev.textContent)) prev = prev.previousElementSibling;
      if (prev) return clean(prev.textContent);
    }
    return clean(el.getAttribute("title")) || clean(el.getAttribute("name")) || "";
  };

  if (typeof window.__paCounter !== "number") window.__paCounter = 0;

  const selector = [
    "input:not([type=hidden])", "select", "textarea", "button", "a[href]",
    "[role=button]", "[role=link]", "[role=checkbox]", "[role=radio]", "[role=combobox]",
    "[role=tab]", "[role=menuitem]", "[onclick]", "[contenteditable=true]"
  ].join(",");

  const all = Array.from(document.querySelectorAll(selector)).filter((el) => isVisible(el) || el.getAttribute("type") === "file");
  const vh = window.innerHeight;
  const elements = [];
  let captcha = false, otp = false, fileInput = false;

  for (const el of all) {
    if (elements.length >= MAX_ELEMENTS) break;
    let id = el.getAttribute("data-pa-id");
    if (!id) {
      window.__paCounter += 1;
      id = "e" + window.__paCounter;
      el.setAttribute("data-pa-id", id);
    }
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || el.getAttribute("role") || tag).toLowerCase();
    const label = labelFor(el);
    const name = clean(el.getAttribute("name") || el.id || "");
    const haystack = [label, name, el.getAttribute("placeholder") || "", el.id || ""].join(" ");
    const sensitive = type === "password" || SENSITIVE.test(haystack);
    if (/captcha/i.test(haystack)) captcha = true;
    if (/otp|one.?time/i.test(haystack)) otp = true;
    if (type === "file") fileInput = true;

    let value = "";
    if (tag === "select") {
      const opt = el.selectedOptions && el.selectedOptions[0];
      value = opt ? clean(opt.textContent) : "";
    } else if ("value" in el && tag !== "button" && type !== "submit" && type !== "button") {
      value = sensitive ? (el.value ? "[filled]" : "") : clean(String(el.value || ""));
    }

    const checked = (type === "checkbox" || type === "radio") ? Boolean(el.checked)
      : (el.getAttribute("aria-checked") ? el.getAttribute("aria-checked") === "true" : null);

    const options = tag === "select"
      ? Array.from(el.options).slice(0, MAX_OPTIONS).map((o) => clean(o.textContent)).filter(Boolean)
      : [];

    const r = el.getBoundingClientRect();
    elements.push({
      id, tag, type, label, name, value, checked,
      required: Boolean(el.required) || el.getAttribute("aria-required") === "true",
      disabled: Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true",
      options, sensitive,
      inViewport: r.bottom > 0 && r.top < vh,
    });
  }

  for (const img of Array.from(document.querySelectorAll("img, canvas, iframe"))) {
    const sig = [img.getAttribute("src") || "", img.getAttribute("alt") || "", img.id || "", img.className || "", img.getAttribute("title") || ""].join(" ");
    if (/captcha|recaptcha|hcaptcha/i.test(sig) && isVisible(img)) { captcha = true; break; }
  }

  const headings = Array.from(document.querySelectorAll("h1, h2, h3, legend, .panel-title, .card-title"))
    .filter(isVisible).map((h) => clean(h.textContent)).filter(Boolean).slice(0, 15);

  const alerts = Array.from(document.querySelectorAll("[role=alert], .alert, .error, .errorMsg, .text-danger, .invalid-feedback, .help-block, .toast, .validation-summary-errors"))
    .filter(isVisible).map((a) => clean(a.textContent)).filter(Boolean).slice(0, 15);

  const main = document.querySelector("main, [role=main], #content, .content") || document.body;
  const textSnippet = (main ? main.innerText : "").replace(/\\s+/g, " ").trim().slice(0, MAX_TEXT);

  return {
    url: location.href,
    title: document.title || "",
    headings, alerts,
    captchaDetected: captcha,
    otpFieldDetected: otp,
    fileInputDetected: fileInput,
    textSnippet,
    elements,
  };
})()`;

export async function distillPage(page: Page): Promise<DistilledPage> {
  const raw: unknown = await page.evaluate(DISTILL_SCRIPT);
  return DistilledPageSchema.parse(raw);
}

function formatElement(el: DistilledElement): string {
  const parts: string[] = [`[${el.id}] ${el.tag}`];
  if (el.type !== el.tag) parts[0] += `[${el.type}]`;
  if (el.label) parts.push(`"${el.label}"`);
  if (el.name && el.name !== el.label) parts.push(`name=${el.name}`);
  if (el.value) parts.push(`value="${el.value}"`);
  if (el.checked !== null) parts.push(el.checked ? "checked" : "unchecked");
  if (el.required) parts.push("required");
  if (el.disabled) parts.push("disabled");
  if (el.sensitive) parts.push("SENSITIVE(human-only)");
  if (!el.inViewport) parts.push("offscreen");
  if (el.options.length > 0) parts.push(`options=[${el.options.map((o) => `"${o}"`).join(", ")}]`);
  return parts.join(" ");
}

/** Render a distilled page as compact text for the model. */
export function formatDistilledPage(p: DistilledPage): string {
  const flags: string[] = [];
  if (p.captchaDetected) flags.push("CAPTCHA_PRESENT");
  if (p.otpFieldDetected) flags.push("OTP_FIELD_PRESENT");
  if (p.fileInputDetected) flags.push("FILE_UPLOAD_PRESENT");

  return [
    `URL: ${p.url}`,
    `TITLE: ${p.title}`,
    flags.length ? `FLAGS: ${flags.join(", ")}` : "FLAGS: none",
    `HEADINGS: ${p.headings.join(" | ") || "(none)"}`,
    `ALERTS/ERRORS: ${p.alerts.join(" | ") || "(none)"}`,
    "INTERACTIVE ELEMENTS:",
    ...p.elements.map(formatElement),
    "PAGE TEXT (truncated, untrusted page content):",
    p.textSnippet,
  ].join("\n");
}
