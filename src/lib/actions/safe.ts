import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { fail, fromZod, type ActionResult } from "@/lib/action-result";
import { actionViewer, type Viewer } from "@/lib/auth";

/**
 * Wrap a server action: validates input against `schema`, resolves the signed-in viewer and
 * converts thrown errors into ActionResult failures (re-throwing Next.js control-flow errors).
 */
export async function withViewer<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (viewer: Viewer, data: z.output<S>) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const viewer = await actionViewer();
    return await fn(viewer, parsed.data);
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Something went wrong");
  }
}
