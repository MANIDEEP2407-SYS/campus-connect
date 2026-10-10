import type { z } from "zod";

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const ok = <T>(data: T, message?: string): ActionResult<T> => ({ ok: true, data, message });
export const fail = (error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult<never> => ({
  ok: false,
  error,
  fieldErrors,
});

export function fromZod(err: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(err.issues[0]?.message ?? "Invalid input", fieldErrors);
}

/** Translate PostgREST / Postgres errors into user-facing messages without leaking internals. */
export function fromPg(err: { message: string; code?: string } | null | undefined, fallback = "Something went wrong"): ActionResult<never> {
  if (!err) return fail(fallback);
  switch (err.code) {
    case "23505":
      return fail("That already exists.");
    case "42501":
      return fail(err.message?.startsWith("new row violates") ? "You don't have permission to do that." : err.message);
    case "23514":
    case "22P02":
      return fail("Some fields are invalid.");
    case "23503":
      return fail("A referenced record no longer exists.");
    case "PGRST116":
      return fail("Not found or you don't have access.");
    case "P0001":
    case "P0429":
      return fail(err.message);
    default:
      return fail(err.message?.length && err.message.length < 200 ? err.message : fallback);
  }
}
