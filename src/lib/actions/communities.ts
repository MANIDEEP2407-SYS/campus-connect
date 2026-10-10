"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";
import { channelSchema, messageSchema, serverSchema } from "@/lib/validation";
import { scheduleScan } from "@/lib/shield/schedule";

const sid = z.object({ serverId: z.uuid() });

export async function createServer(input: unknown) {
  return withViewer(serverSchema, input, async (v, data) => {
    const { data: row, error } = await v.supabase
      .from("servers")
      .insert({ ...data, owner_id: v.userId })
      .select("id")
      .single();
    if (error) return fromPg(error);
    const { data: ch } = await v.supabase.from("channels").select("id").eq("server_id", row.id).eq("name", "general").single();
    return ok({ id: row.id, channelId: ch?.id ?? null }, "Community created");
  });
}

export async function updateServer(input: unknown) {
  return withViewer(serverSchema.extend({ serverId: z.uuid() }), input, async (v, { serverId, ...data }) => {
    const { data: rows, error } = await v.supabase.from("servers").update(data).eq("id", serverId).select("id");
    if (error) return fromPg(error);
    if (!rows?.length) return fromPg({ message: "Only owners and moderators can edit this community.", code: "P0001" });
    refresh();
    return ok(null, "Community updated");
  });
}

export async function deleteServer(input: unknown) {
  return withViewer(sid, input, async (v, { serverId }) => {
    const { data, error } = await v.supabase.from("servers").delete().eq("id", serverId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "Only the owner can delete this community.", code: "P0001" });
    return ok(null, "Community deleted");
  });
}

export async function joinServer(input: unknown) {
  return withViewer(sid, input, async (v, { serverId }) => {
    const { error } = await v.supabase.rpc("join_public_server", { sid: serverId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Joined");
  });
}

export async function requestServerAccess(input: unknown) {
  return withViewer(sid.extend({ message: z.string().trim().max(300).optional() }), input, async (v, { serverId, message }) => {
    const { error } = await v.supabase.rpc("request_server_access", { sid: serverId, p_message: message ?? undefined });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Request sent to the community owner");
  });
}

export async function decideServerRequest(input: unknown) {
  return withViewer(sid.extend({ userId: z.uuid(), approve: z.boolean() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("decide_server_request", { sid: d.serverId, p_user: d.userId, p_approve: d.approve });
    if (error) return fromPg(error);
    refresh();
    return ok(null, d.approve ? "Request approved" : "Request declined");
  });
}

export async function leaveServer(input: unknown) {
  return withViewer(sid, input, async (v, { serverId }) => {
    const { error } = await v.supabase.rpc("remove_server_member", { sid: serverId, p_user: v.userId });
    if (error) return fromPg(error);
    return ok(null, "You left the community");
  });
}

export async function removeServerMember(input: unknown) {
  return withViewer(sid.extend({ userId: z.uuid() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("remove_server_member", { sid: d.serverId, p_user: d.userId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Member removed");
  });
}

export async function setServerMemberRole(input: unknown) {
  return withViewer(sid.extend({ userId: z.uuid(), role: z.enum(["moderator", "member"]) }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("set_server_member_role", { sid: d.serverId, p_user: d.userId, p_role: d.role });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Role updated");
  });
}

export async function transferServerOwnership(input: unknown) {
  return withViewer(sid.extend({ userId: z.uuid() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("transfer_server_ownership", { sid: d.serverId, p_user: d.userId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Ownership transferred");
  });
}

export async function createInvite(input: unknown) {
  return withViewer(sid.extend({ days: z.number().int().min(1).max(30).default(7), maxUses: z.number().int().min(1).max(500).default(25) }), input, async (v, d) => {
    const { data, error } = await v.supabase
      .from("server_invites")
      .insert({
        server_id: d.serverId,
        created_by: v.userId,
        max_uses: d.maxUses,
        expires_at: new Date(Date.now() + d.days * 86_400_000).toISOString(),
      })
      .select("code")
      .single();
    if (error) return fromPg(error);
    refresh();
    return ok({ code: data.code }, "Invite created");
  });
}

export async function revokeInvite(input: unknown) {
  return withViewer(z.object({ id: z.uuid() }), input, async (v, { id }) => {
    const { error } = await v.supabase.from("server_invites").delete().eq("id", id);
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Invite revoked");
  });
}

export async function redeemInvite(input: unknown) {
  return withViewer(z.object({ code: z.string().trim().min(4).max(40) }), input, async (v, { code }) => {
    const { data, error } = await v.supabase.rpc("redeem_server_invite", { p_code: code });
    if (error) return fromPg(error);
    return ok({ serverId: data as string }, "Welcome!");
  });
}

export async function createChannel(input: unknown) {
  return withViewer(channelSchema.extend({ serverId: z.uuid() }), input, async (v, d) => {
    const { data: count } = await v.supabase.from("channels").select("position").eq("server_id", d.serverId).order("position", { ascending: false }).limit(1);
    const { data, error } = await v.supabase
      .from("channels")
      .insert({ server_id: d.serverId, name: d.name, topic: d.topic, position: (count?.[0]?.position ?? 0) + 1 })
      .select("id")
      .single();
    if (error?.code === "42501") return fromPg({ message: "Only owners and moderators can create channels.", code: "P0001" });
    if (error) return fromPg(error);
    refresh();
    return ok({ id: data.id }, `#${d.name} created`);
  });
}

export async function updateChannel(input: unknown) {
  return withViewer(channelSchema.extend({ channelId: z.uuid() }), input, async (v, d) => {
    const { data, error } = await v.supabase.from("channels").update({ name: d.name, topic: d.topic }).eq("id", d.channelId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "Only owners and moderators can rename channels.", code: "P0001" });
    refresh();
    return ok(null, "Channel updated");
  });
}

export async function deleteChannel(input: unknown) {
  return withViewer(z.object({ channelId: z.uuid() }), input, async (v, { channelId }) => {
    const { data, error } = await v.supabase.from("channels").delete().eq("id", channelId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "Only owners and moderators can delete channels.", code: "P0001" });
    refresh();
    return ok(null, "Channel deleted");
  });
}

export async function sendMessage(input: unknown) {
  return withViewer(messageSchema.extend({ channelId: z.uuid(), replyTo: z.uuid().nullable().optional() }), input, async (v, d) => {
    const { data, error } = await v.supabase
      .from("messages")
      // server_id is derived from the channel by a trigger; the placeholder satisfies the type.
      .insert({ channel_id: d.channelId, author_id: v.userId, body: d.body, reply_to: d.replyTo ?? null, server_id: "00000000-0000-0000-0000-000000000000" })
      .select("id")
      .single();
    if (error?.code === "42501") return fromPg({ message: "You can't send messages here (join the community first, or your posting is temporarily restricted).", code: "P0001" });
    if (error) return fromPg(error);
    scheduleScan("message", data.id);
    return ok({ id: data.id });
  });
}

export async function editMessage(input: unknown) {
  return withViewer(messageSchema.extend({ id: z.uuid() }), input, async (v, d) => {
    const { data, error } = await v.supabase.from("messages").update({ body: d.body }).eq("id", d.id).eq("author_id", v.userId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "You can only edit your own messages.", code: "P0001" });
    scheduleScan("message", d.id);
    return ok(null);
  });
}

export async function deleteMessage(input: unknown) {
  return withViewer(z.object({ id: z.uuid() }), input, async (v, { id }) => {
    const { error } = await v.supabase.rpc("moderate_delete_message", { mid: id });
    if (error) return fromPg(error);
    return ok(null);
  });
}

// --- Direct messages ---------------------------------------------------------

export async function startConversation(input: unknown) {
  return withViewer(z.object({ userId: z.uuid() }), input, async (v, { userId }) => {
    const { data, error } = await v.supabase.rpc("start_conversation", { p_other: userId });
    if (error) return fromPg(error);
    return ok({ id: data as string });
  });
}

export async function sendDirectMessage(input: unknown) {
  return withViewer(messageSchema.extend({ conversationId: z.uuid() }), input, async (v, d) => {
    const { data, error } = await v.supabase
      .from("direct_messages")
      .insert({ conversation_id: d.conversationId, sender_id: v.userId, body: d.body })
      .select("id")
      .single();
    if (error?.code === "42501") return fromPg({ message: "This message can't be sent (you're not in this conversation, or one of you has blocked the other).", code: "P0001" });
    if (error) return fromPg(error);
    return ok({ id: data.id });
  });
}

export async function markConversationRead(input: unknown) {
  return withViewer(z.object({ conversationId: z.uuid() }), input, async (v, { conversationId }) => {
    await v.supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", v.userId);
    return ok(null);
  });
}
