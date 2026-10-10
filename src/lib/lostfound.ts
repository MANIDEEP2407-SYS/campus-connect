// Lost & Found matching. Scores are suggestions only — a match is never "confirmed" without the
// private claim review workflow.

export const LF_CATEGORIES = ["id_card", "wallet", "keys", "books", "bag", "electronics", "clothing", "other"] as const;
export type LfCategory = (typeof LF_CATEGORIES)[number];

export const LF_CATEGORY_META: Record<LfCategory, { label: string; emoji: string; sensitive: boolean }> = {
  id_card: { label: "Student ID card", emoji: "🪪", sensitive: true },
  wallet: { label: "Wallet / purse", emoji: "👛", sensitive: true },
  keys: { label: "Keys", emoji: "🔑", sensitive: false },
  books: { label: "Books & notebooks", emoji: "📚", sensitive: false },
  bag: { label: "Bag", emoji: "🎒", sensitive: false },
  electronics: { label: "Phone & electronics", emoji: "📱", sensitive: true },
  clothing: { label: "Clothing", emoji: "🧥", sensitive: false },
  other: { label: "Other belongings", emoji: "📦", sensitive: false },
};

export const LF_STATUS_META = {
  open: { label: "Open", tone: "primary" },
  claimed: { label: "Claim approved", tone: "warning" },
  returned: { label: "Returned", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  removed: { label: "Removed", tone: "danger" },
} as const;

export const CLAIM_STATUS_META = {
  pending: { label: "Pending review", tone: "info" },
  approved: { label: "Approved — arrange handover", tone: "warning" },
  rejected: { label: "Not approved", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  disputed: { label: "Disputed — moderator review", tone: "warning" },
  completed: { label: "Returned", tone: "success" },
} as const;

export interface MatchableItem {
  id: string;
  kind: "lost" | "found";
  category: LfCategory;
  title: string;
  description: string;
  location_label: string;
  occurred_on: string; // YYYY-MM-DD
}

export interface MatchResult {
  score: number; // 0..100
  reasons: string[];
  breakdown: { text: number; location: number; date: number };
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "at", "near", "with", "my", "is", "it", "to", "for", "was", "found",
  "lost", "this", "that", "i", "have", "has", "from", "by", "some", "one", "colour", "color",
]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map((w) => (w.endsWith("s") && w.length > 4 ? w.slice(0, -1) : w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86_400_000;
}

/**
 * Score how plausibly a lost report and a found report describe the same item.
 * Requires opposite kinds and the same category; otherwise returns null.
 */
export function scoreMatch(a: MatchableItem, b: MatchableItem): MatchResult | null {
  if (a.kind === b.kind || a.category !== b.category || a.id === b.id) return null;
  const [lost, found] = a.kind === "lost" ? [a, b] : [b, a];
  const days = daysBetween(lost.occurred_on, found.occurred_on);
  // Found before it was lost (beyond a 1-day reporting slack) is implausible.
  const foundBeforeLost = Date.parse(found.occurred_on) + 86_400_000 < Date.parse(lost.occurred_on);
  if (days > 21 || foundBeforeLost) return null;

  const ta = tokenize(`${lost.title} ${lost.description}`);
  const tb = tokenize(`${found.title} ${found.description}`);
  const text = jaccard(ta, tb);
  const shared = [...ta].filter((w) => tb.has(w));

  const la = tokenize(lost.location_label);
  const lb = tokenize(found.location_label);
  const location = lost.location_label.trim().toLowerCase() === found.location_label.trim().toLowerCase() ? 1 : jaccard(la, lb) > 0 ? 0.6 : 0;

  const date = days <= 1 ? 1 : days <= 3 ? 0.75 : days <= 7 ? 0.5 : 0.2;

  const score = Math.round(100 * (0.55 * Math.min(1, text * 2.2) + 0.25 * location + 0.2 * date));
  const reasons = [`Same category (${LF_CATEGORY_META[a.category].label})`];
  if (shared.length) reasons.push(`Shared description words: ${shared.slice(0, 5).join(", ")}`);
  if (location === 1) reasons.push(`Same location: ${found.location_label}`);
  else if (location > 0) reasons.push(`Nearby locations: ${lost.location_label} / ${found.location_label}`);
  reasons.push(days < 1 ? "Reported on the same day" : `Dates ${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"} apart`);
  return { score, reasons, breakdown: { text, location, date } };
}

export function rankMatches(item: MatchableItem, candidates: MatchableItem[], minScore = 25) {
  return candidates
    .map((c) => ({ item: c, match: scoreMatch(item, c) }))
    .filter((r): r is { item: MatchableItem; match: MatchResult } => r.match !== null && r.match.score >= minScore)
    .sort((x, y) => y.match.score - x.match.score);
}
