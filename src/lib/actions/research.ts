"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";
import { applicationSchema, projectSchema } from "@/lib/validation";

export async function createProject(input: unknown) {
  return withViewer(projectSchema, input, async (v, { budget_note, ...d }) => {
    const { data, error } = await v.supabase
      .from("research_projects")
      .insert({ ...d, lead_id: v.userId })
      .select("id")
      .single();
    if (error) return fromPg(error);
    if (budget_note) {
      await v.supabase.from("project_private_details").insert({ project_id: data.id, budget_note });
    }
    return ok({ id: data.id }, d.kind === "consultancy" ? "Consultancy listing published" : "Project published");
  });
}

export async function setProjectStatus(input: unknown) {
  return withViewer(z.object({ projectId: z.uuid(), status: z.enum(["open", "closed", "completed"]) }), input, async (v, d) => {
    const { data, error } = await v.supabase.from("research_projects").update({ status: d.status }).eq("id", d.projectId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "Only the project lead can change status.", code: "P0001" });
    refresh();
    return ok(null, "Status updated");
  });
}

export async function applyToProject(input: unknown) {
  return withViewer(applicationSchema, input, async (v, d) => {
    const { error } = await v.supabase.rpc("apply_to_project", {
      pid: d.project_id,
      p_statement: d.statement,
      p_skills: d.relevant_skills,
      p_availability: d.availability ?? "",
    });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Application sent — you'll be notified when the lead responds");
  });
}

export async function reviewApplication(input: unknown) {
  return withViewer(
    z.object({ applicationId: z.uuid(), status: z.enum(["shortlisted", "accepted", "rejected"]), note: z.string().trim().max(1000).optional() }),
    input,
    async (v, d) => {
      const { error } = await v.supabase.rpc("review_application", { aid: d.applicationId, p_status: d.status, p_note: d.note || undefined });
      if (error) return fromPg(error);
      refresh();
      return ok(null, `Applicant ${d.status}`);
    },
  );
}

export async function withdrawApplication(input: unknown) {
  return withViewer(z.object({ applicationId: z.uuid() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("withdraw_application", { aid: d.applicationId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Application withdrawn");
  });
}
