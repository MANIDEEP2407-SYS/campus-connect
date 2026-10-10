"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";
import { checkDraftText, processPendingScans } from "@/lib/shield/service";
import { draftSuggestion } from "@/lib/shield/policy";
import { CATEGORY_LABELS } from "@/lib/shield/types";

type DraftResult = { show: false } | { show: true; label: string; message: string; isMock: boolean };

/** Pre-publish check: suggests edits; never blocks, never stores the draft. */
export async function checkDraft(input: unknown) {
  return withViewer(z.object({ text: z.string().trim().min(1).max(4000) }), input, async (v, { text }) => {
    const { error } = await v.supabase.rpc("shield_draft_quota");
    if (error) return ok<DraftResult>({ show: false }); // over quota → just let them post; the post is still scanned
    const res = await checkDraftText(text);
    if (res.status !== "ok" || res.risk === "low") return ok<DraftResult>({ show: false });
    return ok<DraftResult>({
      show: true,
      label: res.category === "none" ? "Potentially hurtful" : CATEGORY_LABELS[res.category as keyof typeof CATEGORY_LABELS],
      message: draftSuggestion(res.category as keyof typeof CATEGORY_LABELS),
      isMock: res.isMock,
    });
  });
}

const caseId = z.object({ caseId: z.uuid() });

export async function markCaseInReview(input: unknown) {
  return withViewer(caseId, input, async (v, d) => {
    const { error } = await v.supabase.rpc("shield_mark_in_review", { p_case: d.caseId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Marked as in review");
  });
}

export async function addCaseNote(input: unknown) {
  return withViewer(caseId.extend({ note: z.string().trim().min(2).max(2000) }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("shield_add_note", { p_case: d.caseId, p_note: d.note });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Internal note added");
  });
}

export async function decideCase(input: unknown) {
  return withViewer(
    caseId.extend({
      decision: z.enum(["no_action", "dismissed_false_positive", "warning", "edit_requested", "removed", "restricted", "escalated"]),
      reason: z.string().trim().max(1000).optional(),
      internalNote: z.string().trim().max(2000).optional(),
      restrictDays: z.number().int().min(1).max(30).optional(),
    }),
    input,
    async (v, d) => {
      // Authorisation is enforced inside shield_decide (moderators only).
      const { error } = await v.supabase.rpc("shield_decide", {
        p_case: d.caseId,
        p_decision: d.decision,
        p_reason: d.reason || undefined,
        p_internal_note: d.internalNote || undefined,
        p_restrict_days: d.restrictDays,
      });
      if (error) return fromPg(error);
      refresh();
      return ok(null, "Decision recorded");
    },
  );
}

export async function resolveAppeal(input: unknown) {
  return withViewer(z.object({ appealId: z.uuid(), overturn: z.boolean(), resolution: z.string().trim().min(10).max(1000) }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("shield_resolve_appeal", { p_appeal: d.appealId, p_overturn: d.overturn, p_resolution: d.resolution });
    if (error) return fromPg(error);
    refresh();
    return ok(null, d.overturn ? "Appeal accepted — action reversed" : "Appeal reviewed — decision upheld");
  });
}

export async function liftRestriction(input: unknown) {
  return withViewer(z.object({ id: z.uuid() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("shield_lift_restriction", { p_id: d.id });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Restriction lifted");
  });
}

export async function submitAppeal(input: unknown) {
  return withViewer(caseId.extend({ statement: z.string().trim().min(10, "Explain why this should be reviewed").max(2000) }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("shield_appeal", { p_case: d.caseId, p_statement: d.statement });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Appeal submitted — a moderator will review it");
  });
}

export async function runPendingScans(input: unknown) {
  return withViewer(z.object({}), input, async (v) => {
    if (!v.isModerator) return fail("Moderators only");
    const r = await processPendingScans(50);
    refresh();
    if (r.skipped) return fail(`Scanner unavailable: ${r.skipped}`);
    return ok(null, `Processed ${r.processed} item(s)${r.errors ? `, ${r.errors} failed (provider unavailable?)` : ""}`);
  });
}

export async function setBlock(input: unknown) {
  return withViewer(z.object({ userId: z.uuid(), kind: z.enum(["block", "mute"]).nullable() }), input, async (v, d) => {
    if (d.userId === v.userId) return fail("You can't block yourself");
    const q = d.kind
      ? v.supabase.from("user_blocks").upsert({ blocker_id: v.userId, blocked_id: d.userId, kind: d.kind })
      : v.supabase.from("user_blocks").delete().eq("blocker_id", v.userId).eq("blocked_id", d.userId);
    const { error } = await q;
    if (error) return fromPg(error);
    refresh();
    return ok(null, d.kind === "block" ? "Blocked — they can't message you or comment on your posts" : d.kind === "mute" ? "Muted — you won't see their posts" : "Unblocked");
  });
}
