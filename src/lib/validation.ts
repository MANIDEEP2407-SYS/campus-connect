import { z } from "zod";
import { PULSE_CATEGORIES, PULSE_SEVERITIES } from "@/lib/pulse";
import { LF_CATEGORIES } from "@/lib/lostfound";

// Shared by client forms (react-hook-form + zodResolver) and server actions (re-validation).

const tag = z.string().trim().min(1).max(40);
const tags = (max: number) => z.array(tag).max(max, `At most ${max} items`);
// Accepts "", null or undefined (blank) as well as text, and outputs text or null. Client forms send
// their already-parsed output to server actions, which re-validate it — so outputs must re-parse.
// (Zod 4: a union containing undefined doesn't make an object key optional — `.optional()` does.)
const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional().transform((v) => v || null);

/** Reject long digit runs that look like ID / phone / serial numbers in public text. */
const noSensitiveNumbers = (s: string) => !/\d[\d\s-]{5,}\d/.test(s);
const sensitiveMsg = "Don't include ID, phone or serial numbers in public text — add them as private verification details instead.";

export const signInSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Enter your name").max(80),
});

export const resetRequestSchema = z.object({ email: z.email("Enter a valid email") });
export const newPasswordSchema = z
  .object({ password: z.string().min(8, "At least 8 characters"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "3–24 lowercase letters, numbers or underscores"),
  affiliation: z.enum(["ug_student", "pg_student", "phd_scholar", "faculty", "staff"]),
  department: optionalText(80),
  program: optionalText(80),
  year_of_study: z.coerce.number().int().min(1).max(6).optional().nullable().or(z.literal("").transform(() => null)),
  bio: optionalText(500),
  skills: tags(20),
  interests: tags(20),
  goals: tags(10),
  visibility: z.enum(["campus", "connections", "hidden"]),
  allow_dms: z.boolean(),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const postSchema = z.object({
  body: z.string().trim().min(1, "Write something").max(2000),
  image_path: z.string().max(300).nullable().optional(),
  club_id: z.uuid().nullable().optional(),
  is_announcement: z.boolean().optional(),
});

export const commentSchema = z.object({ post_id: z.uuid(), body: z.string().trim().min(1).max(1000) });

export const serverSchema = z.object({
  name: z.string().trim().min(3, "At least 3 characters").max(60),
  description: optionalText(500),
  icon: z.string().trim().min(1).max(8),
  category: z.string().trim().min(1).max(40),
  visibility: z.enum(["public", "private"]),
});

export const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .transform((s) => s.toLowerCase().replace(/\s+/g, "-"))
    .pipe(z.string().regex(/^[a-z0-9-]{1,32}$/, "Lowercase letters, numbers and dashes")),
  topic: optionalText(200),
});

export const messageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export const clubSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,48}$/, "Lowercase letters, numbers and dashes"),
  tagline: optionalText(140),
  description: optionalText(3000),
  category: z.string().trim().min(1).max(40),
  logo: z.string().trim().min(1).max(8),
  membership_policy: z.enum(["open", "approval"]),
  requirements: optionalText(500),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: optionalText(4000),
    category: z.string().trim().min(1).max(40),
    venue: z.string().trim().min(2).max(120),
    starts_at: z.string().min(1, "Choose a start time"),
    ends_at: z.string().min(1, "Choose an end time"),
    capacity: z.coerce.number().int().min(1).max(10000).optional().nullable().or(z.literal("").transform(() => null)),
    registration_deadline: z.string().optional().nullable().transform((v) => v || null),
    club_id: z.uuid().nullable().optional().or(z.literal("").transform(() => null)),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: "End must be after start", path: ["ends_at"] })
  .refine((v) => !v.registration_deadline || new Date(v.registration_deadline) <= new Date(v.ends_at), {
    message: "Deadline must be before the event ends",
    path: ["registration_deadline"],
  });

export const projectSchema = z.object({
  kind: z.enum(["research", "consultancy"]),
  title: z.string().trim().min(5).max(160),
  abstract: z.string().trim().min(20, "At least 20 characters").max(600),
  description: optionalText(6000),
  area: z.string().trim().min(1).max(60),
  department: optionalText(80),
  required_skills: tags(15),
  commitment: z.string().trim().min(2).max(120),
  positions: z.coerce.number().int().min(1).max(50),
  budget_note: optionalText(1000),
});

export const applicationSchema = z.object({
  project_id: z.uuid(),
  statement: z.string().trim().min(30, "Tell the lead a bit more (30+ characters)").max(2000),
  relevant_skills: tags(15),
  availability: optionalText(120),
});

export const resourceSchema = z.object({
  kind: z.enum(["course", "elective", "material", "link", "form"]),
  title: z.string().trim().min(3).max(160),
  description: optionalText(2000),
  course_code: optionalText(20),
  department: optionalText(80),
  url: z.union([z.url({ protocol: /^https?$/ }), z.literal(""), z.null()]).optional().transform((v) => v || null),
  source_label: optionalText(120),
  tags: tags(10),
});

export const pulseReportSchema = z.object({
  category: z.enum(PULSE_CATEGORIES),
  subcategory: optionalText(60),
  title: z.string().trim().min(5, "At least 5 characters").max(120),
  description: z.string().trim().min(10, "Describe the issue (10+ characters)").max(2000),
  severity: z.enum(PULSE_SEVERITIES),
  location_label: z.string().trim().min(2, "Where is it?").max(120),
  lat: z.number().min(10.88).max(10.93).nullable(),
  lng: z.number().min(76.88).max(76.93).nullable(),
  force: z.boolean().optional(),
});
export type PulseReportInput = z.input<typeof pulseReportSchema>;

export const lfItemSchema = z.object({
  kind: z.enum(["lost", "found"]),
  category: z.enum(LF_CATEGORIES),
  title: z.string().trim().min(3).max(100).refine(noSensitiveNumbers, sensitiveMsg),
  description: z.string().trim().min(10, "Add a short description (10+ characters)").max(1500).refine(noSensitiveNumbers, sensitiveMsg),
  location_label: z.string().trim().min(2).max(120),
  occurred_on: z.iso.date("Choose a date"),
  contact_pref: z.enum(["in_app", "security_office"]),
  secret_details: optionalText(1000),
  image_path: z.string().max(300).nullable().optional(),
});
export type LfItemInput = z.input<typeof lfItemSchema>;

export const claimSchema = z.object({
  item_id: z.uuid(),
  details: z.string().trim().min(10, "Describe distinguishing details only the owner would know").max(1500),
  lost_item_id: z.uuid().nullable().optional().or(z.literal("").transform(() => null)),
});

export const flagSchema = z.object({
  target_type: z.enum(["post", "comment", "message", "direct_message", "server", "lf_item", "profile", "pulse_report", "resource"]),
  target_id: z.uuid(),
  category: z.enum(["harassment", "threat", "hate", "sexual_harassment", "personal_info", "self_harm", "spam", "other"]).optional(),
  reason: z.string().trim().min(5, "Tell moderators what's wrong").max(1000),
});

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
