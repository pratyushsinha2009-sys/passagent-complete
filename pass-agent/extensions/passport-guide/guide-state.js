/* Pure observation helpers. No field values, storage or network access. */
globalThis.PassportGuideState = Object.freeze({
  placeGuide(anchor, height, viewport) {
    const margin = 12, gap = 14;
    const width = Math.min(viewport.width <= 600 ? 272 : 292, viewport.width - margin * 2);
    const wantedHeight = Math.min(height, 320, viewport.height - margin * 2);
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    const rightSpace = viewport.width - anchor.right - gap - margin;
    const leftSpace = anchor.left - gap - margin;
    const belowSpace = Math.max(0, viewport.height - anchor.bottom - gap - margin);
    const aboveSpace = Math.max(0, anchor.top - gap - margin);
    if (rightSpace >= width) return { left: anchor.right + gap, top: clamp(anchor.top, margin, viewport.height - wantedHeight - margin), width, maxHeight: wantedHeight, side: "right" };
    if (leftSpace >= width) return { left: anchor.left - gap - width, top: clamp(anchor.top, margin, viewport.height - wantedHeight - margin), width, maxHeight: wantedHeight, side: "left" };
    const below = belowSpace >= wantedHeight || (aboveSpace < wantedHeight && belowSpace >= aboveSpace);
    const maxHeight = Math.min(wantedHeight, below ? belowSpace : aboveSpace);
    return { left: clamp(anchor.left, margin, viewport.width - width - margin), top: below ? anchor.bottom + gap : anchor.top - gap - maxHeight, width, maxHeight, side: below ? "bottom" : "top" };
  },
  observationKey(context) {
    return JSON.stringify({ url: context.url, heading: context.heading, goal: context.goal, stage: context.stage,
      activeId: context.field.id, fields: context.fields.map(({ id, label, name, help, section, type, required, filled, invalid, options, confirmed, skipped }) => ({ id, label, name, help, section, type, required, filled, invalid, options, confirmed, skipped })) });
  },
  chooseNext(context) {
    const fields = context.fields;
    const invalid = fields.find((field) => field.invalid);
    if (invalid) return invalid.id;
    const required = fields.find((field) => field.required && !field.filled);
    if (required) return required.id;
    const after = fields.findIndex((field) => field.id === context.field.id) + 1;
    const next = fields.slice(after).find((field) => !field.filled);
    return next?.id || fields.find((field) => /next|continue|save|review/i.test(field.label))?.id || null;
  },
});
