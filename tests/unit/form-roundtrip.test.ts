// Client forms (react-hook-form + zodResolver) send the schema's *output* to server actions, which
// validate it again with the same schema. Every schema's output must therefore re-parse — including
// when optional fields are left blank.
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  applicationSchema, channelSchema, claimSchema, clubSchema, eventSchema, lfItemSchema, postSchema,
  profileSchema, projectSchema, pulseReportSchema, resourceSchema, serverSchema,
} from "@/lib/validation";

const UUID = "11111111-2222-4333-8444-555555555555";
const day = "2026-10-20";

// Inputs shaped like the forms' default values, with every optional field left blank ("").
const cases: [string, z.ZodType, unknown][] = [
  ["profile", profileSchema, { full_name: "Test User", handle: "test_user", affiliation: "ug_student", department: "", program: "", year_of_study: "", bio: "", skills: [], interests: [], goals: [], visibility: "campus", allow_dms: true }],
  ["server", serverSchema, { name: "Study group", description: "", icon: "💬", category: "General", visibility: "public" }],
  ["channel", channelSchema, { name: "General Chat", topic: "" }],
  ["club", clubSchema, { name: "Test Club", slug: "test-club", tagline: "", description: "", category: "Technical", logo: "✨", membership_policy: "open", requirements: "" }],
  ["event", eventSchema, { title: "Workshop", description: "", category: "Workshop", venue: "AB2", starts_at: `${day}T10:30:00.000Z`, ends_at: `${day}T12:30:00.000Z`, capacity: "", registration_deadline: "", club_id: "" }],
  ["project", projectSchema, { kind: "research", title: "A research project", abstract: "An abstract that is long enough to pass.", description: "", area: "Other", department: "", required_skills: [], commitment: "4 hrs/week", positions: "2", budget_note: "" }],
  ["application", applicationSchema, { project_id: UUID, statement: "I would like to join because I have relevant experience.", relevant_skills: [], availability: "" }],
  ["resource", resourceSchema, { kind: "material", title: "Notes", description: "", course_code: "", department: "", url: "", source_label: "", tags: [] }],
  ["pulse", pulseReportSchema, { category: "other", subcategory: "", title: "Broken bench", description: "A bench is broken near AB1", severity: "low", location_label: "AB1", lat: null, lng: null }],
  ["lost&found", lfItemSchema, { kind: "lost", category: "keys", title: "Keys", description: "A set of keys on a ring", location_label: "AB1", occurred_on: day, contact_pref: "in_app", secret_details: "", image_path: null }],
  ["claim", claimSchema, { item_id: UUID, details: "Blue sticker on the back", lost_item_id: "" }],
  ["post", postSchema, { body: "Hello", image_path: null, club_id: null, is_announcement: false }],
];

describe("form schemas survive the client → server round trip", () => {
  for (const [name, schema, input] of cases) {
    it(`${name}: blank optional fields`, () => {
      const client = schema.safeParse(input);
      expect(client.success, `${name} client parse: ${JSON.stringify(client.error?.issues)}`).toBe(true);
      const server = schema.safeParse(client.data);
      expect(server.success, `${name} server re-parse: ${JSON.stringify(server.error?.issues)}`).toBe(true);
      expect(server.data).toEqual(client.data);
    });
  }
});
