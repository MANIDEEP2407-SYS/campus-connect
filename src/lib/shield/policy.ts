// CampusShield moderation policy: maps provider category scores to CampusShield categories and a
// policy risk level. Pure functions — unit-tested. A score is the model's confidence that the TEXT
// matches a category; it is never a probability that a person committed misconduct.

import type { ShieldCategory, ShieldRisk } from "@/lib/shield/types";
import { CATEGORY_LABELS, RISK_META } from "@/lib/shield/types";

/** Raw provider scores, keyed by OpenAI moderation category names (the mock uses the same keys). */
export type ProviderScores = Partial<Record<
  | "harassment" | "harassment/threatening" | "hate" | "hate/threatening" | "illicit" | "illicit/violent"
  | "self-harm" | "self-harm/instructions" | "self-harm/intent" | "sexual" | "sexual/minors" | "violence" | "violence/graphic",
  number
>>;

export interface Thresholds {
  review: number;
  high: number;
  critical: number;
}

function num(v: string | undefined, fallback: number) {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : fallback;
}

/** Configurable via SHIELD_THRESHOLD_REVIEW / _HIGH / _CRITICAL (0–1). */
export function getThresholds(env: Record<string, string | undefined> = process.env): Thresholds {
  const t = {
    review: num(env.SHIELD_THRESHOLD_REVIEW, 0.45),
    high: num(env.SHIELD_THRESHOLD_HIGH, 0.75),
    critical: num(env.SHIELD_THRESHOLD_CRITICAL, 0.9),
  };
  // Keep the ladder ordered even if misconfigured.
  t.high = Math.max(t.high, t.review);
  t.critical = Math.max(t.critical, t.high);
  return t;
}

// ---------------------------------------------------------------------------
// Local personal-information detector (the provider has no doxxing category).
// ---------------------------------------------------------------------------
const PII_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "phone number", re: /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g },
  { kind: "email address", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: "roll / ID number", re: /\b[A-Z]{2}\.[A-Z]{2}\.[A-Z0-9]{6,}\b/gi },
  { kind: "long ID number", re: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
];
const LOCATION_HINTS = /\b(room\s?(no\.?|number)?\s?\d+|hostel\s+room|lives?\s+(at|in)|home\s+address|her\s+address|his\s+address|their\s+address)\b/i;
const EXPOSE_HINTS = /\b(call|text|message|find|visit|spam|go\s+to)\s+(her|him|them)\b|\beveryone\s+(call|text|spam)\b/i;

export function detectPersonalInfo(text: string): { kinds: string[]; score: number } {
  const kinds = PII_PATTERNS.filter((p) => text.match(p.re)).map((p) => p.kind);
  const location = LOCATION_HINTS.test(text);
  if (location) kinds.push("location / residence detail");
  if (!kinds.length) return { kinds, score: 0 };
  const exposing = EXPOSE_HINTS.test(text);
  return { kinds, score: exposing ? 0.85 : location && kinds.length > 1 ? 0.7 : 0.5 };
}

/** Replace personal identifiers before sending text to an external provider (data minimisation). */
export function redactForProvider(text: string): string {
  let out = text;
  for (const p of PII_PATTERNS) out = out.replace(p.re, `[${p.kind}]`);
  return out;
}

// ---------------------------------------------------------------------------
// Context signals that commonly cause false positives.
// ---------------------------------------------------------------------------
const QUOTE_OR_REPORT = /(["“”'‘’].{3,}["“”'‘’])|\b(someone|they|he|she)\s+(said|called|told|messaged|wrote)\b|\b(quote|quoting|reported|reporting|screenshot)\b/i;
const ACADEMIC = /\b(research|paper|study|lecture|course|seminar|history of|discussion on|essay|thesis|awareness)\b/i;

export function contextSignals(text: string): string[] {
  const s: string[] = [];
  if (QUOTE_OR_REPORT.test(text)) s.push("appears to quote or report someone else's words");
  if (ACADEMIC.test(text)) s.push("appears to be an academic or awareness discussion");
  return s;
}

// ---------------------------------------------------------------------------
// Mapping and decision
// ---------------------------------------------------------------------------
export type MappedScores = Record<Exclude<ShieldCategory, "repeated_bullying" | "none">, number>;

export function mapScores(p: ProviderScores, piiScore: number): MappedScores {
  const g = (k: keyof ProviderScores) => p[k] ?? 0;
  return {
    targeted_harassment: g("harassment"),
    threats_intimidation: Math.max(g("harassment/threatening"), g("hate/threatening"), g("illicit/violent"), g("violence") * 0.85),
    hate_discrimination: Math.max(g("hate"), g("hate/threatening")),
    sexual_harassment: Math.max(g("sexual") * 0.9, g("sexual/minors")),
    doxxing: piiScore,
    other_harmful: Math.max(g("self-harm/intent"), g("self-harm/instructions"), g("self-harm") * 0.8, g("violence/graphic") * 0.8, g("illicit") * 0.7),
  };
}

const ORDER: ShieldRisk[] = ["low", "review", "high", "critical"];
const CRITICAL_ELIGIBLE: string[] = ["threats_intimidation", "hate_discrimination", "sexual_harassment"];
const step = (r: ShieldRisk, d: number): ShieldRisk => ORDER[Math.min(3, Math.max(0, ORDER.indexOf(r) + d))]!;

export interface PolicyResult {
  category: ShieldCategory;
  risk: ShieldRisk;
  topScore: number;
  mapped: MappedScores;
  reasons: string[];
  explanation: string;
}

export function evaluate(
  providerScores: ProviderScores,
  text: string,
  opts: { thresholds?: Thresholds; providerLabel: string; context?: "content" | "report" } = { providerLabel: "provider" },
): PolicyResult {
  const t = opts.thresholds ?? getThresholds();
  const pii = detectPersonalInfo(text);
  const mapped = mapScores(providerScores, pii.score);
  const [category, topScore] = (Object.entries(mapped) as [keyof MappedScores, number][]).sort((a, b) => b[1] - a[1])[0]!;

  let risk: ShieldRisk = topScore >= t.critical ? "critical" : topScore >= t.high ? "high" : topScore >= t.review ? "review" : "low";
  const reasons: string[] = [];
  // Critical (content withheld pending review) is reserved for safety-level categories. Insults and
  // other harassment, however strongly scored, get priority human review instead of auto-hiding.
  if (risk === "critical" && !CRITICAL_ELIGIBLE.includes(category)) risk = "high";

  // Hard safety overrides that warrant urgent human attention regardless of the overall top score.
  const g = (k: keyof ProviderScores) => providerScores[k] ?? 0;
  if (g("sexual/minors") >= 0.3) { risk = "critical"; reasons.push("possible content involving minors"); }
  if (g("harassment/threatening") >= t.high) { risk = "critical"; reasons.push("possible direct threat"); }
  if (g("self-harm/intent") >= 0.6) { risk = "critical"; reasons.push("possible self-harm risk — wellbeing escalation, not a violation"); }

  // Reduce false positives: quoting, reporting or academic discussion lowers non-critical risk one level.
  const ctx = contextSignals(text);
  if (ctx.length && risk !== "critical" && risk !== "low") {
    risk = step(risk, -1);
    reasons.push(`downgraded one level: ${ctx.join("; ")}`);
  }
  if (pii.kinds.length) reasons.push(`contains ${pii.kinds.join(", ")}`);

  const finalCategory: ShieldCategory = risk === "low" ? "none" : category;
  const scoreList = (Object.entries(mapped) as [string, number][])
    .filter(([, v]) => v >= 0.1)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${CATEGORY_LABELS[k as ShieldCategory]} ${v.toFixed(2)}`)
    .join(", ");
  const explanation =
    `${opts.providerLabel} scores: ${scoreList || "all below 0.10"}. ` +
    (risk === "low"
      ? "Below the review threshold."
      : `Policy: ${CATEGORY_LABELS[finalCategory]} at ${topScore.toFixed(2)} → ${RISK_META[risk].label} (thresholds ${t.review}/${t.high}/${t.critical}).`) +
    (reasons.length ? ` Notes: ${reasons.join("; ")}.` : "") +
    " Automated model scores describe the text only and are not a finding — a moderator decides.";

  return { category: finalCategory, risk, topScore, mapped, reasons, explanation };
}

/** Plain-language, non-revealing suggestion shown to authors before publishing. */
export function draftSuggestion(category: ShieldCategory): string {
  switch (category) {
    case "doxxing":
      return "This seems to include someone's personal details. Sharing them publicly can put people at risk — consider removing them.";
    case "threats_intimidation":
      return "This could be read as threatening. If you're in conflict with someone, consider rephrasing — or reach out to campus support.";
    case "other_harmful":
      return "If you or someone you know is struggling, campus counselling and helplines can help. You can still post, edit, or cancel.";
    default:
      return "This might come across as hurtful to someone. Would you like to rephrase before posting?";
  }
}
