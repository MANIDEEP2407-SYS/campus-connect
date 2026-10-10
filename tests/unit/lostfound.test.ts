import { describe, expect, it } from "vitest";
import { jaccard, rankMatches, scoreMatch, tokenize, type MatchableItem } from "@/lib/lostfound";

const lostBottle: MatchableItem = {
  id: "l1", kind: "lost", category: "other", title: "Blue steel water bottle with planet stickers",
  description: "Lost my blue steel water bottle with planet stickers on the second floor", location_label: "Central Library", occurred_on: "2026-10-09",
};
const foundBottle: MatchableItem = {
  id: "f1", kind: "found", category: "other", title: "Blue water bottle with stickers",
  description: "Found a blue steel bottle with space stickers on a reading table", location_label: "Central Library", occurred_on: "2026-10-10",
};

describe("Lost & Found matching", () => {
  it("tokenizes, drops stopwords and stems plurals", () => {
    const t = tokenize("Found the Blue bottles near the Library!");
    expect(t.has("blue")).toBe(true);
    expect(t.has("bottle")).toBe(true);
    expect(t.has("the")).toBe(false);
    expect(t.has("found")).toBe(false);
  });

  it("computes Jaccard similarity", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
  });

  it("scores a strong lost/found pair highly with explanations", () => {
    const m = scoreMatch(lostBottle, foundBottle)!;
    expect(m).not.toBeNull();
    expect(m.score).toBeGreaterThanOrEqual(60);
    expect(m.reasons.join(" ")).toMatch(/Same category/);
    expect(m.reasons.join(" ")).toMatch(/Same location/);
    expect(m.reasons.join(" ")).toMatch(/blue|bottle|sticker/);
  });

  it("is symmetric in argument order", () => {
    expect(scoreMatch(foundBottle, lostBottle)!.score).toBe(scoreMatch(lostBottle, foundBottle)!.score);
  });

  it("never matches same kind, different category, or itself", () => {
    expect(scoreMatch(lostBottle, { ...foundBottle, kind: "lost" })).toBeNull();
    expect(scoreMatch(lostBottle, { ...foundBottle, category: "keys" })).toBeNull();
    expect(scoreMatch(lostBottle, lostBottle)).toBeNull();
  });

  it("does not treat a shared category alone as a confirmed match", () => {
    const unrelated: MatchableItem = { ...foundBottle, id: "f2", title: "Umbrella", description: "Black folding umbrella left at the gate", location_label: "Main Gate", occurred_on: "2026-09-25" };
    const m = scoreMatch(lostBottle, unrelated);
    expect(m === null || m.score < 25).toBe(true);
  });

  it("rejects found-before-lost and far-apart dates", () => {
    expect(scoreMatch(lostBottle, { ...foundBottle, occurred_on: "2026-10-01" })).toBeNull();
    expect(scoreMatch(lostBottle, { ...foundBottle, occurred_on: "2026-11-30" })).toBeNull();
  });

  it("ranks candidates by score and filters weak ones", () => {
    const weak: MatchableItem = { ...foundBottle, id: "f3", title: "Bottle", description: "Plastic container found", location_label: "Sports Complex", occurred_on: "2026-10-20" };
    const ranked = rankMatches(lostBottle, [weak, foundBottle]);
    expect(ranked[0]!.item.id).toBe("f1");
    expect(ranked.every((r) => r.match.score >= 25)).toBe(true);
  });
});
