"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";
import { PULSE_STATUSES } from "@/lib/pulse";
import { pulseReportSchema } from "@/lib/validation";

export type SimilarReport = {
  id: string;
  ref_code: string;
  title: string;
  status: string;
  location_label: string;
  distance_m: number;
};

/**
 * Submit a report. Unless `force` is set, nearby active reports in the same category are returned
 * first so the reporter can confirm an existing one instead of creating a duplicate.
 */
export async function submitPulseReport(input: unknown) {
  return withViewer(pulseReportSchema.extend({ attachmentPaths: z.array(z.string().max(300)).max(3).default([]) }), input, async (v, d) => {
    if (!d.force && d.lat != null && d.lng != null) {
      const { data: similar } = await v.supabase.rpc("pulse_find_similar", { p_category: d.category, p_lat: d.lat, p_lng: d.lng });
      if (similar?.length) {
        return ok({ id: null as string | null, similar: similar as SimilarReport[] });
      }
    }
    const { data: id, error } = await v.supabase.rpc("pulse_submit", {
      p_category: d.category,
      p_subcategory: d.subcategory ?? "",
      p_title: d.title,
      p_description: d.description,
      p_severity: d.severity,
      p_lat: d.lat as number,
      p_lng: d.lng as number,
      p_location_label: d.location_label,
    });
    if (error) return fromPg(error);
    const paths = d.attachmentPaths.filter((p) => p.startsWith(`${v.userId}/`));
    if (paths.length) {
      const { error: attErr } = await v.supabase
        .from("report_attachments")
        .insert(paths.map((storage_path) => ({ report_id: id as string, uploaded_by: v.userId, storage_path, purpose: "evidence" })));
      if (attErr) return ok({ id: id as string, similar: [] as SimilarReport[] }, "Report submitted, but a photo could not be attached.");
    }
    return ok({ id: id as string, similar: [] as SimilarReport[] }, "Report submitted — responders have been notified");
  });
}

export async function confirmPulseReport(input: unknown) {
  return withViewer(z.object({ reportId: z.uuid() }), input, async (v, { reportId }) => {
    const { error } = await v.supabase.rpc("pulse_confirm", { rid: reportId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Thanks — your confirmation raises this report's priority");
  });
}

export async function transitionPulseReport(input: unknown) {
  return withViewer(
    z.object({
      reportId: z.uuid(),
      to: z.enum(PULSE_STATUSES),
      note: z.string().trim().max(2000).optional(),
      assignee: z.uuid().optional().nullable(),
      resolutionPaths: z.array(z.string().max(300)).max(3).default([]),
    }),
    input,
    async (v, d) => {
      const { error } = await v.supabase.rpc("pulse_transition", {
        rid: d.reportId,
        p_to: d.to,
        p_note: d.note || undefined,
        p_assignee: d.assignee || undefined,
      });
      if (error) return fromPg(error);
      const paths = d.resolutionPaths.filter((p) => p.startsWith(`${v.userId}/`));
      if (paths.length) {
        await v.supabase
          .from("report_attachments")
          .insert(paths.map((storage_path) => ({ report_id: d.reportId, uploaded_by: v.userId, storage_path, purpose: "resolution" })));
      }
      refresh();
      return ok(null, "Status updated");
    },
  );
}

export async function addPulseNote(input: unknown) {
  return withViewer(z.object({ reportId: z.uuid(), note: z.string().trim().min(1).max(2000), internal: z.boolean() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("pulse_add_note", { rid: d.reportId, p_note: d.note, p_internal: d.internal });
    if (error) return fromPg(error);
    refresh();
    return ok(null, d.internal ? "Internal note added" : "Public update posted");
  });
}

export async function issuePulseAlert(input: unknown) {
  return withViewer(z.object({ reportId: z.uuid(), message: z.string().trim().min(10).max(300), hours: z.number().int().min(1).max(48) }), input, async (v, d) => {
    const { data, error } = await v.supabase.rpc("pulse_issue_alert", { rid: d.reportId, p_message: d.message, p_hours: d.hours });
    if (error) return fromPg(error);
    refresh();
    return ok(null, `Alert sent to ${data} people`);
  });
}

export async function markPulseDuplicate(input: unknown) {
  return withViewer(z.object({ reportId: z.uuid(), ofRef: z.string().trim().min(3).max(20) }), input, async (v, d) => {
    const { data: target } = await v.supabase.from("reports").select("id").eq("ref_code", d.ofRef.toUpperCase()).maybeSingle();
    if (!target) return fromPg({ message: `No report ${d.ofRef} found`, code: "P0001" });
    const { error } = await v.supabase.rpc("pulse_mark_duplicate", { rid: d.reportId, p_of: target.id });
    if (error) return fromPg(error);
    refresh();
    return ok(null, `Merged into ${d.ofRef.toUpperCase()}`);
  });
}

/** Signed URLs for a report's private attachments (RLS + storage policies decide access). */
export async function getAttachmentUrls(input: unknown) {
  return withViewer(z.object({ reportId: z.uuid() }), input, async (v, { reportId }) => {
    const { data: rows } = await v.supabase.from("report_attachments").select("id, storage_path, purpose").eq("report_id", reportId);
    if (!rows?.length) return ok([] as { id: string; url: string; purpose: string }[]);
    const { data: signed } = await v.supabase.storage.from("pulse-evidence").createSignedUrls(rows.map((r) => r.storage_path), 600);
    return ok(
      rows
        .map((r, i) => ({ id: r.id, purpose: r.purpose, url: signed?.[i]?.signedUrl ?? "" }))
        .filter((r) => r.url),
    );
  });
}
