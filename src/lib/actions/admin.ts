"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";

export async function setUserRole(input: unknown) {
  return withViewer(
    z.object({ userId: z.uuid(), role: z.enum(["platform_admin", "safety_responder", "moderator", "faculty"]), grant: z.boolean() }),
    input,
    async (v, d) => {
      // Authorisation is enforced inside admin_set_role (platform_admin only).
      const { error } = await v.supabase.rpc("admin_set_role", { p_user: d.userId, p_role: d.role, p_grant: d.grant });
      if (error) return fromPg(error);
      refresh();
      return ok(null, d.grant ? "Role granted" : "Role revoked");
    },
  );
}

export async function resolveModerationReport(input: unknown) {
  return withViewer(
    z.object({ id: z.uuid(), status: z.enum(["actioned", "dismissed"]), note: z.string().trim().max(500).optional(), removeContent: z.boolean().default(false) }),
    input,
    async (v, d) => {
      const { error } = await v.supabase.rpc("mod_resolve_report", {
        p_id: d.id,
        p_status: d.status,
        p_note: d.note || undefined,
        p_remove_content: d.removeContent,
      });
      if (error) return fromPg(error);
      refresh();
      return ok(null, d.status === "dismissed" ? "Report dismissed" : d.removeContent ? "Content removed" : "Marked as actioned");
    },
  );
}

export async function runMaintenance(input: unknown) {
  return withViewer(z.object({}), input, async (v) => {
    if (!v.isModerator && !v.isResponder) return fromPg({ message: "Not allowed", code: "P0001" });
    const pulse = await v.supabase.rpc("pulse_expire_stale");
    refresh();
    return ok(null, `Expired ${pulse.data ?? 0} stale warnings`);
  });
}
