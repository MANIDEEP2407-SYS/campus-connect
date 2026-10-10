// Microsoft Entra ID (Amrita Microsoft 365) sign-in configuration and identity checks.
// Supabase Auth's `azure` provider performs the OAuth 2.0 / OIDC authorization-code flow (PKCE),
// verifies the ID token and — when configured with a tenant-specific URL — rejects other tenants.
// These helpers add a defence-in-depth check on the verified `iss` claim it stores.

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AZURE_ISSUER = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0\/?$/i;

export function microsoftConfig(env: Record<string, string | undefined> = process.env) {
  const tenantId = env.MICROSOFT_TENANT_ID?.trim().toLowerCase() || null;
  return {
    /** UI flag (public): show the Microsoft button as active. */
    enabled: env.NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED === "true",
    /** Approved Amrita tenant (server-only). Sign-in fails closed when this is missing or malformed. */
    tenantId: tenantId && GUID.test(tenantId) ? tenantId : null,
  };
}

export function tenantFromIssuer(iss: unknown): string | null {
  if (typeof iss !== "string") return null;
  return AZURE_ISSUER.exec(iss)?.[1]?.toLowerCase() ?? null;
}

type Identity = { provider: string; identity_data?: Record<string, unknown> | null };

/**
 * Decide whether a freshly authenticated user holds a Microsoft identity from the approved tenant.
 * Never based on the email domain — only on the verified issuer recorded by the auth server.
 */
export function checkMicrosoftIdentity(identities: Identity[] | undefined | null, approvedTenant: string | null):
  | { ok: true; tenantId: string }
  | { ok: false; reason: "no_microsoft_identity" | "tenant_not_configured" | "wrong_tenant" } {
  const azure = (identities ?? []).find((i) => i.provider === "azure");
  if (!azure) return { ok: false, reason: "no_microsoft_identity" };
  if (!approvedTenant) return { ok: false, reason: "tenant_not_configured" };
  const tid = tenantFromIssuer(azure.identity_data?.iss);
  if (!tid || tid !== approvedTenant) return { ok: false, reason: "wrong_tenant" };
  return { ok: true, tenantId: tid };
}

/** Email/password sign-in exists for development and demos only. */
export function devLoginAllowed(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== "production" || env.ALLOW_DEV_LOGIN === "true";
}

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Microsoft sign-in was cancelled or permission was not granted.",
  wrong_tenant: "That Microsoft account isn't part of the approved Amrita tenant. Sign in with your official college account.",
  tenant_not_configured: "Amrita Microsoft sign-in isn't configured on this server yet. Ask an administrator.",
  no_microsoft_identity: "We couldn't confirm a Microsoft identity for this sign-in.",
  provider_disabled: "Microsoft sign-in is not enabled yet — it is awaiting university configuration.",
  dev_login_disabled: "Email and password sign-in is disabled on this deployment. Use your Amrita Microsoft account.",
  expired: "Your session expired. Please sign in again.",
  link_invalid: "That sign-in link is invalid or has expired.",
  server_error: "The sign-in service had a problem. Please try again.",
};
