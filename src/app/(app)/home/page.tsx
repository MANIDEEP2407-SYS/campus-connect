import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Newspaper } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getFeed, type FeedTab } from "@/lib/queries/feed";
import { Composer } from "@/components/feed/composer";
import { PostCard } from "@/components/feed/post-card";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { formatDateTime } from "@/components/common/time-ago";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

const TABS: { id: FeedTab; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "following", label: "Following" },
  { id: "announcements", label: "Announcements" },
  { id: "saved", label: "Saved" },
];

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.id === sp.tab)?.id ?? "all") as FeedTab;
  const before = typeof sp.before === "string" ? sp.before : undefined;
  const v = await requireViewer();

  const [feed, { data: myClubs }, { data: events }] = await Promise.all([
    getFeed(v, { tab, before }),
    v.supabase.from("club_members").select("role, club:clubs(id, name)").eq("user_id", v.userId).eq("status", "approved"),
    v.supabase.from("events").select("id, title, starts_at, venue, club:clubs(name)").gte("starts_at", new Date().toISOString()).eq("is_cancelled", false).order("starts_at").limit(4),
  ]);
  const clubOf = (m: { club: { id: string; name: string } | null }) => m.club;
  const isClub = (c: { id: string; name: string } | null): c is { id: string; name: string } => Boolean(c);
  const memberClubs = (myClubs ?? []).map(clubOf).filter(isClub);
  const coordinatorClubs = (myClubs ?? []).filter((m) => m.role === "coordinator").map(clubOf).filter(isClub);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Good to see you, {v.profile.full_name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">What&apos;s happening across campus.</p>
        </div>
        <Composer userId={v.userId} name={v.profile.full_name} avatar={v.profile.avatar_url} clubs={coordinatorClubs} memberClubs={memberClubs} hasDepartment={Boolean(v.profile.department)} />
        <nav aria-label="Feed filters" className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "all" ? "/home" : `/home?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn("rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground", tab === t.id && "bg-muted font-medium text-foreground")}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {feed.posts.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title={tab === "following" ? "Nothing from people you follow yet" : tab === "saved" ? "No saved posts" : "No posts yet"}
            description={tab === "following" ? "Find classmates and mentors in Discover to fill this feed." : "Be the first to share something with campus."}
            action={tab === "following" ? <Link href="/discover" className={buttonVariants({ variant: "outline" })}>Discover people</Link> : undefined}
          />
        ) : (
          <div className="space-y-4">
            {feed.posts.map((p) => (
              <PostCard key={p.id} post={p} canModerate={v.isModerator} />
            ))}
            {feed.nextCursor && (
              <div className="flex justify-center">
                <Link href={`/home?${new URLSearchParams({ ...(tab !== "all" ? { tab } : {}), before: feed.nextCursor })}`} className={buttonVariants({ variant: "outline" })}>
                  Older posts
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-4" aria-label="Campus at a glance">
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-primary" /> Upcoming events
            </h2>
            <Link href="/events" className="text-xs text-primary hover:underline">All events</Link>
          </div>
          {events?.length ? (
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className="block text-sm font-medium hover:underline">{e.title}</Link>
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.starts_at)} · {e.venue}</p>
                  {e.club && <ToneBadge className="mt-1">{e.club.name}</ToneBadge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          )}
        </section>
        <section className="rounded-xl border bg-card p-4 text-sm">
          <h2 className="mb-2 font-semibold">Need to report an incident?</h2>
          <p className="mb-3 text-muted-foreground">Report misconduct involving a teacher or student confidentially. It goes only to the department concerned.</p>
          <Link href="/incidents/new" className={buttonVariants({ size: "sm" })}>Report an incident</Link>
        </section>
      </aside>
    </div>
  );
}
