"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";
import { claimSchema, lfItemSchema } from "@/lib/validation";

export async function createLfItem(input: unknown) {
  return withViewer(lfItemSchema, input, async (v, { secret_details, ...d }) => {
    if (d.image_path && !d.image_path.startsWith(`${v.userId}/`)) return fromPg({ message: "Invalid image", code: "P0001" });
    const { data, error } = await v.supabase
      .from("lost_found_items")
      .insert({ ...d, image_path: d.image_path ?? null, owner_id: v.userId })
      .select("id")
      .single();
    if (error) return fromPg(error);
    if (secret_details) {
      const { error: sErr } = await v.supabase.from("lost_found_secrets").insert({ item_id: data.id, details: secret_details });
      if (sErr) return ok({ id: data.id }, "Listing posted, but private details could not be saved.");
    }
    return ok({ id: data.id }, "Listing posted");
  });
}

export async function closeLfItem(input: unknown) {
  return withViewer(z.object({ itemId: z.uuid() }), input, async (v, { itemId }) => {
    const { data, error } = await v.supabase.from("lost_found_items").update({ status: "closed" }).eq("id", itemId).eq("owner_id", v.userId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "Only the poster can close this listing.", code: "P0001" });
    refresh();
    return ok(null, "Listing closed");
  });
}

export async function deleteLfItem(input: unknown) {
  return withViewer(z.object({ itemId: z.uuid() }), input, async (v, { itemId }) => {
    const { data, error } = await v.supabase.from("lost_found_items").delete().eq("id", itemId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "This listing can't be deleted (it may have an active claim).", code: "P0001" });
    return ok(null, "Listing deleted");
  });
}

export async function submitClaim(input: unknown) {
  return withViewer(claimSchema, input, async (v, d) => {
    const { error } = await v.supabase.rpc("lf_submit_claim", {
      p_item: d.item_id,
      p_details: d.details,
      p_lost_item: d.lost_item_id ?? undefined,
    });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Claim sent privately to the finder");
  });
}

export async function reviewClaim(input: unknown) {
  return withViewer(z.object({ claimId: z.uuid(), approve: z.boolean(), note: z.string().trim().max(1000).optional() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("lf_review_claim", { p_claim: d.claimId, p_approve: d.approve, p_note: d.note || undefined });
    if (error) return fromPg(error);
    refresh();
    return ok(null, d.approve ? "Claim approved — arrange the handover" : "Claim declined");
  });
}

export async function completeHandover(input: unknown) {
  return withViewer(z.object({ claimId: z.uuid() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("lf_complete_handover", { p_claim: d.claimId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Marked as returned");
  });
}

export async function withdrawClaim(input: unknown) {
  return withViewer(z.object({ claimId: z.uuid() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("lf_withdraw_claim", { p_claim: d.claimId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Claim withdrawn");
  });
}

export async function disputeClaim(input: unknown) {
  return withViewer(z.object({ claimId: z.uuid(), reason: z.string().trim().min(10).max(1000) }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("lf_dispute_claim", { p_claim: d.claimId, p_reason: d.reason });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Dispute sent to moderators");
  });
}

export async function moderateLfItem(input: unknown) {
  return withViewer(
    z.object({ itemId: z.uuid(), action: z.enum(["remove", "restore", "expire", "resolve", "clear_flag"]), note: z.string().trim().max(500).optional() }),
    input,
    async (v, d) => {
      const { error } = await v.supabase.rpc("lf_moderate_item", { p_item: d.itemId, p_action: d.action, p_note: d.note || undefined });
      if (error) return fromPg(error);
      refresh();
      return ok(null, "Listing updated");
    },
  );
}
