// Who can see a post. The database (posts_select RLS) is authoritative; these drive the UI.

export const POST_AUDIENCES = ["campus", "followers", "club", "department", "interests"] as const;
export type PostAudience = (typeof POST_AUDIENCES)[number];

export const AUDIENCE_META: Record<PostAudience, { label: string; hint: string }> = {
  campus: { label: "Everyone", hint: "Everyone on campus" },
  followers: { label: "My followers", hint: "Only people who follow you" },
  club: { label: "Club members", hint: "Only approved members of a club you belong to" },
  department: { label: "My department", hint: "Only people in your department" },
  interests: { label: "Interested people", hint: "Only people whose profile interests match the topics you pick" },
};

/** Short "who can see this" label shown on a post. */
export function audienceLabel(a: { audience: PostAudience; clubName?: string | null; department?: string | null; tags?: string[] }): string | null {
  switch (a.audience) {
    case "campus": return null;
    case "followers": return "Followers only";
    case "club": return a.clubName ? `${a.clubName} members` : "Club members";
    case "department": return a.department ?? "My department";
    case "interests": return `Interested in ${a.tags?.join(", ") || "selected topics"}`;
  }
}
