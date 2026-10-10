import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkMicrosoftIdentity, microsoftConfig } from "@/lib/microsoft";

/**
 * OAuth / email-link callback. Exchanges the authorization code (PKCE) for a session, then — for
 * Microsoft sign-ins — verifies the account belongs to the approved Amrita tenant. Fails closed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next") ?? "/home";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";
  const fail = (code: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(code)}`);

  // Errors reported by Microsoft or Supabase Auth (e.g. user cancelled, provider disabled).
  const providerError = searchParams.get("error");
  if (providerError) {
    const desc = (searchParams.get("error_description") ?? "").toLowerCase();
    if (providerError === "access_denied") return fail("access_denied");
    if (desc.includes("issuer") || desc.includes("tenant")) return fail("wrong_tenant");
    if (desc.includes("not enabled") || desc.includes("unsupported provider")) return fail("provider_disabled");
    return fail("server_error");
  }

  const code = searchParams.get("code");
  if (!code) return fail("link_invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("link_invalid");

  const provider = data.user.app_metadata?.provider;
  const usedMicrosoft = provider === "azure" || (data.user.identities ?? []).some((i) => i.provider === "azure" && i.last_sign_in_at && Date.now() - Date.parse(i.last_sign_in_at) < 60_000);
  if (usedMicrosoft) {
    const check = checkMicrosoftIdentity(data.user.identities, microsoftConfig().tenantId);
    if (!check.ok) {
      await supabase.auth.signOut();
      return fail(check.reason);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
