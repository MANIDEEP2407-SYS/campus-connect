import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { TimeAgo } from "@/components/common/time-ago";
import { ActionButton } from "@/components/common/action-button";
import { MarkReadOnView } from "@/components/common/mark-read-on-view";
import { markNotificationsRead } from "@/lib/actions/social";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const GROUP: Record<string, string> = {
  dm: "Messages", follow: "Social", like: "Social", comment: "Social", "server.join": "Communities", "server.request": "Communities", "server.request.decided": "Communities",
  "club.request": "Clubs", "club.decided": "Clubs", "event.registered": "Events", "event.reminder": "Events", "event.updated": "Events",
  "research.application": "Research", "research.status": "Research", "pulse.new": "CampusPulse", "pulse.status": "CampusPulse", "pulse.assigned": "CampusPulse",
  "pulse.alert": "Safety alert", moderation: "Moderation", role: "Account",
};

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const sp = await searchParams;
  const unreadOnly = sp.unread === "1";
  const v = await requireViewer();
  let q = v.supabase.from("notifications").select("*").eq("user_id", v.userId).order("created_at", { ascending: false }).limit(100);
  if (unreadOnly) q = q.is("read_at", null);
  const { data: items } = await q;
  const unread = (items ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Updates on your messages, communities, events, applications, reports and listings."
        actions={unread > 0 ? <ActionButton action={markNotificationsRead} input={{}} variant="outline">Mark all as read</ActionButton> : undefined}
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/notifications" aria-current={!unreadOnly ? "page" : undefined} className={cn("rounded-full border px-3 py-1", !unreadOnly ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>All</Link>
        <Link href="/notifications?unread=1" aria-current={unreadOnly ? "page" : undefined} className={cn("rounded-full border px-3 py-1", unreadOnly ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>Unread</Link>
      </div>
      {!items?.length ? (
        <EmptyState icon={Bell} title={unreadOnly ? "You're all caught up" : "No notifications yet"} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {items.map((n) => {
            const alert = n.type === "pulse.alert";
            const body = (
              <div className={cn("flex gap-3 px-4 py-3", !n.read_at && "bg-primary/5", alert && "bg-destructive/10")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : alert ? "bg-destructive" : "bg-primary")} aria-label={n.read_at ? undefined : "Unread"} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{alert && <BellRing className="mr-1 inline size-3 text-destructive" />}{GROUP[n.type] ?? "Update"} · <TimeAgo date={n.created_at} /></p>
                  <p className={cn("text-sm", !n.read_at && "font-medium")}>{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-muted/40">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
      {/* Opening the page marks visible notifications read (after render, so they still show as new). */}
      {unread > 0 && <MarkReadOnView ids={(items ?? []).filter((n) => !n.read_at).map((n) => n.id)} />}
    </div>
  );
}
