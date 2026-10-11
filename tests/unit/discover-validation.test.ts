import { describe, expect, it } from "vitest";
import { recommend } from "@/lib/discover";
import { clubSchema, eventSchema, incidentSchema, profileSchema } from "@/lib/validation";

describe("People recommendations", () => {
  const me = { id: "me", department: "Computer Science & Engineering", skills: ["Python"], interests: ["Healthcare Innovation", "Machine Learning"], goals: ["Biomedical Devices"] };

  it("rewards shared interests, complementary skills and cross-disciplinary overlap", () => {
    const bme = { id: "b", department: "Biomedical Engineering", skills: ["Biomedical Devices"], interests: ["Healthcare Innovation"], goals: [] };
    const r = recommend(me, bme);
    expect(r.score).toBe(3 + 2 + 2);
    expect(r.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/Shared interests/), expect.stringMatching(/Skilled in/), expect.stringMatching(/Cross-disciplinary/)]));
  });

  it("is case-insensitive and ignores the viewer themselves", () => {
    expect(recommend(me, { ...me, id: "x", department: me.department, interests: ["machine learning"], skills: [] }).score).toBe(3);
    expect(recommend(me, me).score).toBe(0);
  });
});

describe("Validation schemas", () => {
  it("only accepts cover images from our upload bucket or the curated photo host", () => {
    const base = { name: "Test Club", slug: "test-club", category: "Technical", logo: "✨", membership_policy: "open" };
    const bucket = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/u/1.jpg`;
    expect(clubSchema.safeParse({ ...base, cover_url: bucket }).success).toBe(true);
    expect(clubSchema.safeParse({ ...base, cover_url: "https://images.unsplash.com/photo-1532186773960-85649e5cb70b?w=1200" }).success).toBe(true);
    expect(clubSchema.safeParse({ ...base, cover_url: "https://tracker.example.com/pixel.gif" }).success).toBe(false);
    expect(clubSchema.safeParse({ ...base, cover_url: "" }).data?.cover_url).toBeNull();
  });

  it("requires the truthfulness declaration and a real date on incident reports", () => {
    const base = { category: "verbal_abuse", subject_kind: "staff", subject_name: "Lab instructor", department: "Physics", title: "Shouting in lab", description: "The instructor shouted insults at the batch during the lab session.", occurred_on: "2026-10-10" };
    expect(incidentSchema.safeParse({ ...base, declaration: true }).success).toBe(true);
    expect(incidentSchema.safeParse({ ...base, declaration: false }).success).toBe(false);
    expect(incidentSchema.safeParse({ ...base, declaration: true, occurred_on: "yesterday" }).success).toBe(false);
    expect(incidentSchema.safeParse({ ...base, declaration: true, description: "Too short" }).success).toBe(false);
  });

  it("validates event ordering and deadlines", () => {
    const base = { title: "Workshop", category: "Workshop", venue: "AB2", capacity: "" };
    expect(eventSchema.safeParse({ ...base, starts_at: "2026-10-12T10:00:00Z", ends_at: "2026-10-12T09:00:00Z" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, starts_at: "2026-10-12T10:00:00Z", ends_at: "2026-10-12T12:00:00Z", registration_deadline: "2026-10-13T00:00:00Z" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, starts_at: "2026-10-12T10:00:00Z", ends_at: "2026-10-12T12:00:00Z" }).success).toBe(true);
  });

  it("does not let profiles carry role fields", () => {
    const parsed = profileSchema.parse({ full_name: "Test User", handle: "Test_User", affiliation: "ug_student", skills: [], interests: [], goals: [], visibility: "campus", allow_dms: true, role: "platform_admin" });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed.handle).toBe("test_user");
  });
});
