import "server-only";
import type { Viewer } from "@/lib/auth";

export async function getServerContext(v: Viewer, serverId: string) {
  const [{ data: server }, { data: membership }] = await Promise.all([
    v.supabase.from("servers").select("*").eq("id", serverId).maybeSingle(),
    v.supabase.from("server_members").select("role").eq("server_id", serverId).eq("user_id", v.userId).maybeSingle(),
  ]);
  if (!server) return null;
  const role = membership?.role ?? null;
  const canRead = server.visibility === "public" || Boolean(role) || v.isModerator;
  return { server, role, isMember: Boolean(role), isStaff: role === "owner" || role === "moderator", canRead };
}
