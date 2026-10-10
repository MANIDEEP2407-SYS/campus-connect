import { describe, expect, it } from "vitest";
import { recommend } from "@/lib/discover";
import { eventSchema, lfItemSchema, pulseReportSchema, profileSchema } from "@/lib/validation";

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
  it("rejects ID/phone-like numbers in public Lost & Found text", () => {
    const base = { kind: "found", category: "id_card", title: "ID card", description: "Found a card", location_label: "Main Canteen", occurred_on: "2026-10-10", contact_pref: "in_app" };
    expect(lfItemSchema.safeParse({ ...base, description: "Card number 2023 4567 8901 found" }).success).toBe(false);
    expect(lfItemSchema.safeParse({ ...base, description: "Call me at 98765 43210 please" }).success).toBe(false);
    expect(lfItemSchema.safeParse({ ...base, description: "Blue lanyard, found near billing" }).success).toBe(true);
  });

  it("keeps CampusPulse coordinates inside the campus box and images optional", () => {
    const base = { category: "wildlife", title: "Snake near walkway", description: "Seen crossing the path", severity: "high", location_label: "Library Walkway" };
    expect(pulseReportSchema.safeParse({ ...base, lat: 10.903, lng: 76.901 }).success).toBe(true);
    expect(pulseReportSchema.safeParse({ ...base, lat: 13.08, lng: 80.27 }).success).toBe(false);
    expect(pulseReportSchema.safeParse({ ...base, lat: null, lng: null }).success).toBe(true);
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
