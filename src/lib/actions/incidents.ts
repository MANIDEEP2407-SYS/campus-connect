"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";
import { INCIDENT_STATUSES } from "@/lib/incidents";
import { incidentSchema } from "@/lib/validation";

/** Submit a confidential incident report; it is routed to reviewers of the chosen department. */
export async function submitIncident(input: unknown) {
  return withViewer(incidentSchema.extend({ attachmentPaths: z.array(z.string().max(300)).max(3).default([]) }), input, async (v, d) => {
    const { data: id, error } = await v.supabase.rpc("incident_submit", {
      p_category: d.category,
      p_subject_name: d.subject_name,
      p_department: d.department,
      p_title: d.title,
      p_description: d.description,
      p_occurred_on: d.occurred_on,
      p_location: d.location ?? "",
      p_context: d.context ?? "",
      p_witnesses: d.witnesses ?? "",
      p_declaration: d.declaration,
    });
    if (error) return fromPg(error);
    const paths = d.attachmentPaths.filter((p) => p.startsWith(`${v.userId}/`));
    if (paths.length) {
      const { error: attErr } = await v.supabase
        .from("incident_attachments")
        .insert(paths.map((storage_path) => ({ incident_id: id, uploaded_by: v.userId, storage_path })));
      if (attErr) return ok({ id }, "Report submitted, but evidence could not be attached.");
    }
    return ok({ id }, `Report submitted to ${d.department}`);
  });
}

export async function transitionIncident(input: unknown) {
  return withViewer(
    z.object({ id: z.uuid(), to: z.enum(INCIDENT_STATUSES), note: z.string().trim().max(2000).optional() }),
    input,
    async (v, d) => {
      const { error } = await v.supabase.rpc("incident_transition", { p_id: d.id, p_to: d.to, p_note: d.note || undefined });
      if (error) return fromPg(error);
      refresh();
      return ok(null, "Status updated — the reporter has been notified");
    },
  );
}

export async function addIncidentNote(input: unknown) {
  return withViewer(z.object({ id: z.uuid(), note: z.string().trim().min(1).max(2000), internal: z.boolean() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("incident_add_note", { p_id: d.id, p_note: d.note, p_internal: d.internal });
    if (error) return fromPg(error);
    refresh();
    return ok(null, d.internal ? "Internal note added" : "Message added to the report");
  });
}

export async function withdrawIncident(input: unknown) {
  return withViewer(z.object({ id: z.uuid(), reason: z.string().trim().min(3).max(500) }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("incident_withdraw", { p_id: d.id, p_reason: d.reason });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Report withdrawn");
  });
}
