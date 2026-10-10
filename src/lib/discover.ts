// Transparent, rules-based people recommendations (no external AI).

export interface DiscoverProfile {
  id: string;
  department: string | null;
  skills: string[];
  interests: string[];
  goals: string[];
}

export interface Recommendation {
  score: number;
  reasons: string[];
}

const norm = (xs: string[]) => new Set(xs.map((x) => x.trim().toLowerCase()).filter(Boolean));

function overlap(a: Set<string>, b: Set<string>) {
  return [...a].filter((x) => b.has(x));
}

/**
 * Score a candidate for the viewer:
 *  - shared interests (strongest signal)
 *  - complementary skills: candidate has skills matching the viewer's interests/goals
 *  - cross-disciplinary bonus when departments differ but interests overlap
 */
export function recommend(viewer: DiscoverProfile, candidate: DiscoverProfile): Recommendation {
  if (viewer.id === candidate.id) return { score: 0, reasons: [] };
  const vi = norm(viewer.interests);
  const vg = norm(viewer.goals);
  const vs = norm(viewer.skills);
  const ci = norm(candidate.interests);
  const cs = norm(candidate.skills);

  const sharedInterests = overlap(vi, ci);
  const complementary = overlap(new Set([...vi, ...vg]), cs).filter((s) => !vs.has(s));
  const theyNeedMe = overlap(norm(candidate.goals), vs);

  let score = sharedInterests.length * 3 + complementary.length * 2 + theyNeedMe.length;
  const reasons: string[] = [];
  if (sharedInterests.length) reasons.push(`Shared interests: ${sharedInterests.slice(0, 3).join(", ")}`);
  if (complementary.length) reasons.push(`Skilled in ${complementary.slice(0, 3).join(", ")}`);
  if (theyNeedMe.length) reasons.push(`Looking for your skills: ${theyNeedMe.slice(0, 2).join(", ")}`);
  if (sharedInterests.length && viewer.department && candidate.department && viewer.department !== candidate.department) {
    score += 2;
    reasons.push(`Cross-disciplinary: ${candidate.department}`);
  }
  return { score, reasons };
}
