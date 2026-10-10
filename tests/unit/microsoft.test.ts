import { describe, expect, it } from "vitest";
import { checkMicrosoftIdentity, devLoginAllowed, microsoftConfig, tenantFromIssuer } from "@/lib/microsoft";

// Synthetic tenant ids — not real tenants.
const APPROVED = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";
const iss = (t: string) => `https://login.microsoftonline.com/${t}/v2.0`;

describe("Microsoft identity checks", () => {
  it("extracts the tenant from a verified Entra issuer only", () => {
    expect(tenantFromIssuer(iss(APPROVED))).toBe(APPROVED);
    expect(tenantFromIssuer(iss(APPROVED.toUpperCase()))).toBe(APPROVED);
    expect(tenantFromIssuer("https://login.microsoftonline.com/common/v2.0")).toBeNull();
    expect(tenantFromIssuer(`https://evil.example.com/${APPROVED}/v2.0`)).toBeNull();
    expect(tenantFromIssuer(undefined)).toBeNull();
  });

  it("accepts the approved tenant and rejects others — never by email domain", () => {
    expect(checkMicrosoftIdentity([{ provider: "azure", identity_data: { iss: iss(APPROVED) } }], APPROVED)).toEqual({ ok: true, tenantId: APPROVED });
    expect(checkMicrosoftIdentity([{ provider: "azure", identity_data: { iss: iss(OTHER), email: "someone@amrita.edu" } }], APPROVED)).toEqual({ ok: false, reason: "wrong_tenant" });
    expect(checkMicrosoftIdentity([{ provider: "email", identity_data: { email: "student@cb.students.amrita.edu" } }], APPROVED)).toEqual({ ok: false, reason: "no_microsoft_identity" });
  });

  it("fails closed when no tenant is configured", () => {
    expect(checkMicrosoftIdentity([{ provider: "azure", identity_data: { iss: iss(APPROVED) } }], null)).toEqual({ ok: false, reason: "tenant_not_configured" });
    expect(microsoftConfig({ MICROSOFT_TENANT_ID: "not-a-guid" }).tenantId).toBeNull();
    expect(microsoftConfig({ MICROSOFT_TENANT_ID: ` ${APPROVED.toUpperCase()} ` }).tenantId).toBe(APPROVED);
  });

  it("allows development sign-in only outside production unless explicitly enabled", () => {
    expect(devLoginAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(devLoginAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(devLoginAllowed({ NODE_ENV: "production", ALLOW_DEV_LOGIN: "true" })).toBe(true);
  });
});
