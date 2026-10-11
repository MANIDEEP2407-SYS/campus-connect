import { z } from "zod";
import { INCIDENT_CATEGORIES } from "@/lib/incidents";

// Shared by client forms (react-hook-form + zodResolver) and server actions (re-validation).

const tag = z.string().trim().min(1).max(40);
const tags = (max: number) => z.array(tag).max(max, `At most ${max} items`);
// Accepts "", null or undefined (blank) as well as text, and outputs text or null. Client forms send
// their already-parsed output to server actions, which re-validate it — so outputs must re-parse.
// (Zod 4: a union containing undefined doesn't make an object key optional — `.optional()` does.)
const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional().transform((v) => v || null);

/** Cover images: our public upload bucket, or the curated free-licence demo photo host. */
const COVER_PREFIXES = [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/`, "https://images.unsplash.com/photo-"];
export const isAllowedCover = (url: string) => COVER_PREFIXES.some((p) => url.startsWith(p));
const coverUrl = z
  .union([z.string().trim().max(500).refine((u) => u === "" || isAllowedCover(u), "Upload the cover image here"), z.null()])
  .optional()
  .transform((v) => v || null);

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
  cover_url: coverUrl,
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
  cover_url: coverUrl,
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
    cover_url: coverUrl,
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

export const incidentSchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES),
  subject_name: z.string().trim().min(2, "Who is this about?").max(120),
  department: z.string().trim().min(2, "Choose the department").max(80),
  title: z.string().trim().min(5, "At least 5 characters").max(120),
  description: z.string().trim().min(30, "Describe what happened (30+ characters)").max(4000),
  occurred_on: z.iso.date("Choose the date"),
  location: optionalText(120),
  context: optionalText(120),
  witnesses: optionalText(500),
  declaration: z.literal(true, "You must confirm the declaration"),
});
export type IncidentInput = z.input<typeof incidentSchema>;

export const flagSchema = z.object({
  target_type: z.enum(["post", "comment", "message", "direct_message", "server", "profile"]),
  target_id: z.uuid(),
  category: z.enum(["harassment", "threat", "hate", "sexual_harassment", "personal_info", "self_harm", "spam", "other"]).optional(),
  reason: z.string().trim().min(5, "Tell moderators what's wrong").max(1000),
});

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
