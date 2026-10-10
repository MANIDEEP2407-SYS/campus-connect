import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getConversations } from "@/lib/queries/messages";
import { ConversationList } from "@/components/messages/conversation-list";
import { DirectThread } from "@/components/messages/direct-thread";
import { UserAvatar } from "@/components/common/user-avatar";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: PageProps<"/messages/[conversationId]">) {
  const { conversationId } = await params;
  const v = await requireViewer();
  // RLS: non-participants get no rows, so this doubles as the authorisation check.
  const { data: conv } = await v.supabase.from("conversations").select("id").eq("id", conversationId).maybeSingle();
  if (!conv) notFound();

  const [conversations, { data: messages }] = await Promise.all([
    getConversations(v),
    v.supabase.from("direct_messages").select("id, sender_id, body, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(100),
  ]);
  await v.supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", v.userId);
  const other = conversations.find((c) => c.id === conversationId)?.other ?? null;

  return (
    <div className="grid h-[calc(100dvh-12rem)] overflow-hidden rounded-xl border bg-card md:grid-cols-[320px_1fr] lg:h-[calc(100dvh-7rem)]">
      <div className="hidden overflow-y-auto border-r md:block">
        <ConversationList conversations={conversations} activeId={conversationId} />
      </div>
      <section className="flex min-h-0 flex-col" aria-label={`Conversation with ${other?.full_name ?? "member"}`}>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Link href="/messages" className="md:hidden" aria-label="Back to messages"><ArrowLeft className="size-4" /></Link>
          <UserAvatar name={other?.full_name ?? "Member"} src={other?.avatar_url} size="sm" />
          {other ? <Link href={`/profile/${other.handle}`} className="font-medium hover:underline">{other.full_name}</Link> : <span className="font-medium">Member</span>}
        </header>
        <DirectThread conversationId={conversationId} meId={v.userId} otherName={other?.full_name ?? "Member"} initial={(messages ?? []).reverse()} />
      </section>
    </div>
  );
}
