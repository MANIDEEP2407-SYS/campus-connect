import "server-only";
import type { Viewer } from "@/lib/auth";

export interface ConversationSummary {
  id: string;
  lastMessageAt: string;
  unread: boolean;
  other: { id: string; handle: string; full_name: string; avatar_url: string | null } | null;
  preview: string | null;
}

export async function getConversations(v: Viewer): Promise<ConversationSummary[]> {
  const { data: mine } = await v.supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at, conversations(last_message_at)")
    .eq("user_id", v.userId);
  const ids = (mine ?? []).map((m) => m.conversation_id);
  if (!ids.length) return [];
  const [{ data: others }, { data: latest }] = await Promise.all([
    v.supabase
      .from("conversation_members")
      .select("conversation_id, profile:profiles!conversation_members_user_id_fkey(id, handle, full_name, avatar_url)")
      .in("conversation_id", ids)
      .neq("user_id", v.userId),
    v.supabase.from("direct_messages").select("conversation_id, body, created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(300),
  ]);
  const previews = new Map<string, string>();
  for (const m of latest ?? []) if (!previews.has(m.conversation_id)) previews.set(m.conversation_id, m.body);
  return (mine ?? [])
    .map((m) => ({
      id: m.conversation_id,
      lastMessageAt: m.conversations?.last_message_at ?? m.last_read_at,
      unread: Boolean(m.conversations && m.conversations.last_message_at > m.last_read_at),
      other: others?.find((o) => o.conversation_id === m.conversation_id)?.profile ?? null,
      preview: previews.get(m.conversation_id) ?? null,
    }))
    .filter((c) => c.preview !== null || c.other)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}
