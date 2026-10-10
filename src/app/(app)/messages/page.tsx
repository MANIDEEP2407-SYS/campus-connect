import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getConversations } from "@/lib/queries/messages";
import { ConversationList } from "@/components/messages/conversation-list";
import { PageHeader } from "@/components/common/page-header";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const v = await requireViewer();
  const conversations = await getConversations(v);
  return (
    <div>
      <PageHeader title="Messages" description="Private one-to-one conversations. Only participants can read them." />
      <div className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[320px_1fr]">
        <div className="md:border-r">
          <ConversationList conversations={conversations} />
        </div>
        <div className="hidden min-h-96 place-items-center text-sm text-muted-foreground md:grid">
          <div className="text-center">
            <MessageCircle className="mx-auto mb-2 size-6" />
            Select a conversation
          </div>
        </div>
      </div>
    </div>
  );
}
