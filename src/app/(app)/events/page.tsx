import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarDays, MapPin, Users } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { CoverImage } from "@/components/common/cover-image";
import { formatDateTime } from "@/components/common/time-ago";
import { ClubTabs } from "@/components/clubs/club-tabs";
import { EventFormDialog } from "@/components/clubs/event-form-dialog";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : "";
  const mine = sp.mine === "1";
  const past = sp.past === "1";
  const v = await requireViewer();
  // Opportunistically queue in-app reminders for the viewer's events in the next 24h (idempotent).
  await v.supabase.rpc("send_event_reminders");

  const now = new Date().toISOString();
  let q = v.supabase
    .from("events")
    .select("id, title, category, venue, starts_at, ends_at, capacity, is_cancelled, registration_deadline, cover_url, club:clubs(name, slug, is_official, logo, cover_url)")
    .order("starts_at", { ascending: !past })
    .limit(60);
  q = past ? q.lt("ends_at", now) : q.gte("ends_at", now);
  if (category) q = q.eq("category", category);
  const [{ data: events }, { data: regs }] = await Promise.all([
    q,
    v.supabase.from("event_registrations").select("event_id").eq("user_id", v.userId).eq("status", "registered"),
  ]);
  const registered = new Set((regs ?? []).map((r) => r.event_id));
  const list = (events ?? []).filter((e) => !mine || registered.has(e.id));
  const { data: counts } = list.length ? await v.supabase.rpc("event_counts", { ids: list.map((e) => e.id) }) : { data: [] };
  const seats = new Map((counts ?? []).map((c) => [c.event_id, c.registered]));

  const chip = (label: string, params: Record<string, string>, active: boolean) => (
    <Link href={`/events?${new URLSearchParams(params)}`} aria-current={active ? "true" : undefined}
      className={cn("rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground", active && "border-primary bg-primary/10 text-primary")}>
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader title="Clubs & Events" description="Workshops, competitions, talks and cultural activities across campus." actions={<EventFormDialog />} />
      <ClubTabs active="events" />
      <div className="mb-6 flex flex-wrap gap-1.5">
        {chip("Upcoming", {}, !past && !mine && !category)}
        {chip("My registrations", { mine: "1" }, mine)}
        {chip("Past", { past: "1" }, past)}
        <span className="mx-1 w-px bg-border" aria-hidden />
        {EVENT_CATEGORIES.map((c) => chip(c, { category: c, ...(past ? { past: "1" } : {}) }, category === c))}
      </div>

      {!list.length ? (
        <EmptyState icon={CalendarDays} title={mine ? "You haven't registered for anything yet" : "No events here"} description="Check back soon, or browse clubs to find activities." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((e) => {
            const taken = seats.get(e.id) ?? 0;
            const full = e.capacity !== null && taken >= e.capacity;
            const d = new Date(e.starts_at);
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40">
                  <div className="relative overflow-hidden">
                    <CoverImage src={e.cover_url ?? e.club?.cover_url} emoji={e.club?.logo ?? "📅"} width={720} className={cn("h-36 w-full transition-transform duration-300 group-hover:scale-105", e.is_cancelled && "grayscale")} />
                  </div>
                  <div className="flex flex-1 gap-4 p-4">
                  <div className="-mt-10 flex w-14 shrink-0 flex-col items-center justify-center self-start rounded-lg border bg-card py-2 text-center shadow-sm">
                    <span className="text-[11px] font-medium text-primary uppercase">{new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(d)}</span>
                    <span className="text-xl font-semibold tabular-nums">{new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(d)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      <ToneBadge>{e.category}</ToneBadge>
                      {e.club ? (e.club.is_official ? <ToneBadge tone="primary"><BadgeCheck className="size-3" /> {e.club.name}</ToneBadge> : <ToneBadge>{e.club.name}</ToneBadge>) : <ToneBadge tone="warning">Community event</ToneBadge>}
                      {e.is_cancelled && <ToneBadge tone="danger">Cancelled</ToneBadge>}
                      {registered.has(e.id) && <ToneBadge tone="success">Registered</ToneBadge>}
                    </div>
                    <p className="mt-2 font-medium">{e.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> {formatDateTime(e.starts_at)}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" /> {e.venue}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3.5" /> {e.capacity ? `${taken}/${e.capacity} registered` : `${taken} registered`}
                      {full && !e.is_cancelled && <ToneBadge tone="danger" className="ml-1">Full</ToneBadge>}
                    </p>
                  </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
