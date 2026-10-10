"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fail, fromZod, ok, type ActionResult } from "@/lib/action-result";
import { newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from "@/lib/validation";
import { AUTH_ERROR_MESSAGES, devLoginAllowed, microsoftConfig } from "@/lib/microsoft";

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

/**
 * Start the Microsoft Entra ID (Amrita Microsoft 365) authorization-code flow via Supabase Auth.
 * The PKCE verifier is stored in a cookie; /auth/callback exchanges the code and checks the tenant.
 */
export async function signInWithMicrosoft(next?: string): Promise<ActionResult> {
  const cfg = microsoftConfig();
  if (!cfg.enabled) return fail(AUTH_ERROR_MESSAGES.provider_disabled!);
  if (!cfg.tenantId) return fail(AUTH_ERROR_MESSAGES.tenant_not_configured!);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      // Supabase requires the `email` scope for Azure; openid/profile give the verified identity.
      scopes: "openid email profile",
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return fail(error?.message.includes("not enabled") ? AUTH_ERROR_MESSAGES.provider_disabled! : AUTH_ERROR_MESSAGES.server_error!);
  redirect(data.url);
}

export async function signIn(input: unknown, next?: string): Promise<ActionResult> {
  if (!devLoginAllowed()) return fail(AUTH_ERROR_MESSAGES.dev_login_disabled!);
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
  redirect(safeNext(next));
}

export async function signUp(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  if (!devLoginAllowed()) return fail(AUTH_ERROR_MESSAGES.dev_login_disabled!);
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await origin()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return fail(error.message);
  if (!data.session) return ok({ needsConfirmation: true }, "Check your email to confirm your account.");
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  if (!devLoginAllowed()) return fail(AUTH_ERROR_MESSAGES.dev_login_disabled!);
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/auth/reset-password`,
  });
  // Don't reveal whether the account exists.
  if (error && error.status !== 400) return fail("Could not send the reset email. Try again shortly.");
  return ok(null, "If an account exists for that email, a reset link is on its way.");
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);
  redirect("/home");
}
