import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { Express } from "express";
import express from "express";
import { isAllowedPortalUrl } from "@pass-agent/shared";
import { runGuideAgent } from "./guideAgent";
import { guideFailure } from "./guideFailure";

const Field = z.object({ id: z.string().regex(/^f\d+$/), label: z.string().min(1).max(240), name: z.string().max(180).default(""), help: z.string().max(500).default(""), section: z.string().max(180).default(""), type: z.string().max(40), required: z.boolean(), options: z.array(z.string().max(160)).max(40), filled: z.boolean().default(false), invalid: z.boolean().default(false), confirmed: z.boolean().default(false), skipped: z.boolean().default(false) }).strict();

export const GuideInput = z.object({
  language: z.enum(["en", "hi", "bn", "mr", "ta", "te", "gu"]).default("en"),
  url: z.string().max(500).refine(isAllowedPortalUrl),
  heading: z.string().max(180),
  field: Field,
  fields: z.array(Field).max(100).default([]),
  event: z.enum(["focus", "question", "next_step", "field_complete", "page_changed", "validation_error"]).default("focus"),
  goal: z.enum(["fresh", "reissue", "understand"]).default("understand"),
  stage: z.string().max(40).default("welcome"),
  question: z.string().max(1200).default("Explain this field and what I should enter."),
}).strict();
export function installGuideRoutes(app: Express, options: { client?: GoogleGenAI } = {}): void {
  const recent: number[] = [];
  app.use("/api/guide", (req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
      res.status(403).json({ error: "Use the Passport Guide browser extension." }); return;
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  }, express.json({ limit: "96kb" }));

  app.post("/api/guide", async (req, res) => {
    const parsed = GuideInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "The guide could not read this field. Select another field and try again." }); return; }
    const now = Date.now();
    while (recent.length && recent[0]! < now - 60_000) recent.shift();
    if (recent.length >= 20) { res.status(429).json({ error: "Please wait a minute before asking for more AI explanations." }); return; }
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey && !options.client) { res.status(503).json({ error: "Add your Gemini key to apps/server/.env and restart PassAgent. Built-in guidance is still available." }); return; }
    recent.push(now);
    try {
      res.json(await runGuideAgent(options.client || new GoogleGenAI({ apiKey }), parsed.data, AbortSignal.timeout(22_000)));
    } catch (error) {
      res.status(502).json(guideFailure(error));
    }
  });
}
