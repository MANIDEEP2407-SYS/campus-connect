import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";

export type Role = Enums<"app_role">;

export interface Viewer {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
  profile: Tables<"profiles">;
  roles: Set<Role>;
  isAdmin: boolean;
  isReviewer: boolean;
  isModerator: boolean;
}

/** Resolve the signed-in user once per request. Returns null when signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Session data is per-request (and the auth client reads the clock for token expiry).
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile) return null;
  const roles = new Set((roleRows ?? []).map((r) => r.role));
  const isAdmin = roles.has("platform_admin");
  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    profile,
    roles,
    isAdmin,
    isReviewer: isAdmin || roles.has("incident_reviewer"),
    isModerator: isAdmin || roles.has("moderator"),
  };
});

/** For pages: redirect to sign-in (or onboarding) when needed. */
export async function requireViewer(opts: { allowUnonboarded?: boolean } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!opts.allowUnonboarded && !viewer.profile.onboarded) redirect("/onboarding");
  return viewer;
}

/** For server actions: throw instead of redirecting. */
export async function actionViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("You need to sign in again.");
  return viewer;
}
