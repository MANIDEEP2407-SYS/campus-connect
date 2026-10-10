import "server-only";
// CampusShield orchestration (server only):
//   moderationService  → scanContent / processPendingScans / checkDraft (this file)
//   moderationProvider → providers.ts
//   moderationPolicy   → policy.ts
//   moderationQueue    → moderation_jobs + moderation_cases (DB, via shield_ingest_scan)
//   moderationAudit    → moderation_events + audit_logs (DB)
// Failures never block publishing and never produce fabricated classifications.

import { getAdminClient } from "@/lib/supabase/admin";
import { evaluate, redactForProvider } from "@/lib/shield/policy";
import { getModerationProvider, providerLabel, ProviderError, type ModerationProvider } from "@/lib/shield/providers";
import type { ShieldContentType } from "@/lib/shield/types";

const TIMEOUT_MS = Number(process.env.MODERATION_TIMEOUT_MS) || 5000;

export type ScanOutcome =
  | { status: "ok"; caseId: string | null; risk: string; category: string; isMock: boolean }
  | { status: "error"; error: string }
  | { status: "skipped"; reason: string };

async function loadText(type: ShieldContentType, id: string): Promise<string | null> {
  const db = getAdminClient();
  if (!db) return null;
  const table = type === "post" ? "posts" : type === "comment" ? "comments" : type === "message" ? "messages" : "direct_messages";
  const { data } = await db.from(table).select("body").eq("id", id).maybeSingle();
  return (data as { body: string } | null)?.body ?? null;
}

/** Scan one content item and record the result. Safe to call in `after()`; never throws. */
export async function scanContent(type: ShieldContentType, id: string, provider: ModerationProvider = getModerationProvider()): Promise<ScanOutcome> {
  try {
    const db = getAdminClient();
    if (!db) return { status: "skipped", reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };
    const text = await loadText(type, id);
    if (text === null) {
      // Content was deleted before it could be scanned: drop the job so it isn't retried forever.
      await db.from("moderation_jobs").delete().eq("content_type", type).eq("content_id", id);
      return { status: "skipped", reason: "content not found" };
    }

    let result;
    try {
      result = await provider.classify(redactForProvider(text), { timeoutMs: TIMEOUT_MS });
    } catch (e) {
      const msg = e instanceof ProviderError ? `${e.kind}: ${e.message}` : "unexpected provider failure";
      // Record the failure (no scores, no category) so moderators can see unscanned content.
      await db.rpc("shield_ingest_scan", {
        p_type: type, p_id: id, p_provider: provider.name, p_model: provider.model, p_status: "error",
        p_flagged: null as unknown as boolean, p_provider_scores: null as unknown as never, p_mapped: null as unknown as never,
        p_category: null as unknown as never, p_risk: null as unknown as never, p_explanation: null as unknown as string,
        p_error: msg, p_latency: null as unknown as number,
      });
      return { status: "error", error: msg };
    }

    const policy = evaluate(result.scores, text, { providerLabel: providerLabel(provider) });
    const { data, error } = await db.rpc("shield_ingest_scan", {
      p_type: type, p_id: id, p_provider: result.provider, p_model: result.model, p_status: "ok",
      p_flagged: result.flagged, p_provider_scores: result.scores as never, p_mapped: policy.mapped as never,
      p_category: policy.category, p_risk: policy.risk, p_explanation: policy.explanation, p_error: null as unknown as string,
      p_latency: result.latencyMs,
    });
    if (error) return { status: "error", error: `ingest failed: ${error.message}` };
    const out = data as { case_id: string | null; category?: string } | null;
    return { status: "ok", caseId: out?.case_id ?? null, risk: policy.risk, category: out?.category ?? policy.category, isMock: result.isMock };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "scan failed" };
  }
}

/** Process queued scan jobs (pending, or errored with < 5 attempts). */
export async function processPendingScans(limit = 20): Promise<{ processed: number; errors: number; skipped?: string }> {
  const db = getAdminClient();
  if (!db) return { processed: 0, errors: 0, skipped: "SUPABASE_SERVICE_ROLE_KEY not configured" };
  const { data: jobs } = await db
    .from("moderation_jobs")
    .select("content_type, content_id, attempts, status")
    .neq("status", "done")
    .lt("attempts", 5)
    .order("created_at")
    .limit(limit);
  const provider = getModerationProvider();
  let errors = 0;
  for (const j of jobs ?? []) {
    const r = await scanContent(j.content_type, j.content_id, provider);
    if (r.status !== "ok") errors++;
  }
  return { processed: jobs?.length ?? 0, errors };
}

export type DraftCheck =
  | { status: "ok"; risk: "low" | "review" | "high" | "critical"; category: string; isMock: boolean }
  | { status: "unavailable" };

/** Pre-publish suggestion. Nothing is stored. Unavailability never blocks posting. */
export async function checkDraftText(text: string): Promise<DraftCheck> {
  const provider = getModerationProvider();
  try {
    const result = await provider.classify(redactForProvider(text), { timeoutMs: Math.min(TIMEOUT_MS, 3000) });
    const policy = evaluate(result.scores, text, { providerLabel: providerLabel(provider) });
    return { status: "ok", risk: policy.risk, category: policy.category, isMock: result.isMock };
  } catch {
    return { status: "unavailable" };
  }
}

export function moderationProviderStatus() {
  const p = getModerationProvider();
  return { name: p.name, model: p.model, isMock: p.isMock, configured: p.model !== "unconfigured", label: providerLabel(p) };
}
