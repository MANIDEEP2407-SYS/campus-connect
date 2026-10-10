import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { TimeAgo } from "@/components/common/time-ago";
import type { ConversationSummary } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";

export function ConversationList({ conversations, activeId }: { conversations: ConversationSummary[]; activeId?: string }) {
  if (!conversations.length)
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <MessageCircle className="mx-auto mb-2 size-5" />
        No conversations yet. Start one from someone&apos;s profile in Discover.
      </div>
    );
  return (
    <ul className="divide-y">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link href={`/messages/${c.id}`} aria-current={c.id === activeId ? "page" : undefined}
            className={cn("flex items-center gap-3 px-4 py-3 hover:bg-muted/50", c.id === activeId && "bg-muted")}>
            <UserAvatar name={c.other?.full_name ?? "Member"} src={c.other?.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.other?.full_name ?? "Member"}</p>
                <TimeAgo date={c.lastMessageAt} className="shrink-0 text-[11px] text-muted-foreground" />
              </div>
              <p className={cn("truncate text-xs", c.unread ? "text-foreground" : "text-muted-foreground")}>{c.preview ?? "No messages yet"}</p>
            </div>
            {c.unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}
