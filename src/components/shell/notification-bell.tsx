"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { getBrowserClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";

/** Bell with a live unread count (Supabase Realtime on the user's own notifications). */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const pathname = usePathname();

  const [prevInitial, setPrevInitial] = useState(initialUnread);
  if (initialUnread !== prevInitial) {
    setPrevInitial(initialUnread);
    setUnread(initialUnread);
  }

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setUnread((n) => n + 1);
          const n = payload.new as { title: string; body: string | null; link: string | null; type: string };
          // DMs are shown in the conversation itself; avoid duplicate toasts there.
          if (n.type === "dm" && n.link && window.location.pathname === n.link) return;
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.link ? { label: "Open", onClick: () => (window.location.href = n.link!) } : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href="/notifications"
      className="relative grid size-9 place-items-center rounded-lg hover:bg-muted"
      aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
      aria-current={pathname === "/notifications" ? "page" : undefined}
    >
      <Bell className="size-4.5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4.5 rounded-full bg-primary px-1 text-center text-[10px] leading-4.5 font-semibold text-primary-foreground tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
