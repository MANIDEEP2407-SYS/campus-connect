// Client forms (react-hook-form + zodResolver) send the schema's *output* to server actions, which
// validate it again with the same schema. Every schema's output must therefore re-parse — including
// when optional fields are left blank.
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  applicationSchema, channelSchema, clubSchema, eventSchema, postSchema,
  incidentSchema, profileSchema, projectSchema, serverSchema,
} from "@/lib/validation";

const UUID = "11111111-2222-4333-8444-555555555555";
const day = "2026-10-20";

// Inputs shaped like the forms' default values, with every optional field left blank ("").
const cases: [string, z.ZodType, unknown][] = [
  ["profile", profileSchema, { full_name: "Test User", handle: "test_user", affiliation: "ug_student", department: "", program: "", year_of_study: "", bio: "", skills: [], interests: [], goals: [], visibility: "campus", allow_dms: true }],
  ["server", serverSchema, { name: "Study group", description: "", icon: "💬", category: "General", visibility: "public", cover_url: "" }],
  ["channel", channelSchema, { name: "General Chat", topic: "" }],
  ["club", clubSchema, { name: "Test Club", slug: "test-club", tagline: "", description: "", category: "Technical", logo: "✨", membership_policy: "open", requirements: "", cover_url: "" }],
  ["event", eventSchema, { title: "Workshop", description: "", category: "Workshop", venue: "AB2", starts_at: `${day}T10:30:00.000Z`, ends_at: `${day}T12:30:00.000Z`, capacity: "", registration_deadline: "", club_id: "", cover_url: "" }],
  ["project", projectSchema, { kind: "research", title: "A research project", abstract: "An abstract that is long enough to pass.", description: "", area: "Other", department: "", required_skills: [], commitment: "4 hrs/week", positions: "2", budget_note: "" }],
  ["application", applicationSchema, { project_id: UUID, statement: "I would like to join because I have relevant experience.", relevant_skills: [], availability: "" }],
  ["incident", incidentSchema, { category: "other", subject_kind: "staff", subject_name: "A teacher", department: "Mathematics", title: "Incident in class", description: "A description of what happened that is long enough.", occurred_on: day, location: "", context: "", witnesses: "", declaration: true }],
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
