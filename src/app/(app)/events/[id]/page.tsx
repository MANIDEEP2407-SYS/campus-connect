import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { CoverImage } from "@/components/common/cover-image";
import { UserAvatar } from "@/components/common/user-avatar";
import { ActionButton } from "@/components/common/action-button";
import { formatDateTime } from "@/components/common/time-ago";
import { EventFormDialog } from "@/components/clubs/event-form-dialog";
import { cancelEvent, cancelRegistration, registerForEvent } from "@/lib/actions/clubs";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const v = await requireViewer();
  const { data: e } = await v.supabase
    .from("events")
    .select("*, club:clubs(id, name, slug, is_official, logo, cover_url), organizer:profiles!events_organizer_id_fkey(handle, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!e) notFound();

  const [{ data: canManage }, { data: counts }, { data: mine }] = await Promise.all([
    v.supabase.rpc("can_manage_event", { eid: id }),
    v.supabase.rpc("event_counts", { ids: [id] }),
    v.supabase.from("event_registrations").select("status").eq("event_id", id).eq("user_id", v.userId).maybeSingle(),
  ]);
  const { data: participants } = canManage
    ? await v.supabase.from("event_registrations").select("user_id, created_at, profile:profiles!event_registrations_user_id_fkey(handle, full_name, avatar_url, department)").eq("event_id", id).eq("status", "registered").order("created_at")
    : { data: null };

  const taken = counts?.[0]?.registered ?? 0;
  const deadline = new Date(e.registration_deadline ?? e.starts_at);
  const closed = deadline < new Date();
  const full = e.capacity !== null && taken >= e.capacity;
  const isRegistered = mine?.status === "registered";
  const pct = e.capacity ? Math.min(100, Math.round((taken / e.capacity) * 100)) : 0;

  return (
    <div className="max-w-4xl">
      {(e.cover_url ?? e.club?.cover_url) && (
        <CoverImage src={e.cover_url ?? e.club?.cover_url} width={1400} priority className={`mb-6 h-44 w-full rounded-xl md:h-64${e.is_cancelled ? " grayscale" : ""}`} />
      )}
      <PageHeader
        back={{ href: "/events", label: "All events" }}
        eyebrow={
          <>
            <ToneBadge>{e.category}</ToneBadge>
            {e.club ? (
              e.club.is_official ? <ToneBadge tone="primary"><BadgeCheck className="size-3" /> Official club event</ToneBadge> : <ToneBadge>Student club event</ToneBadge>
            ) : (
              <ToneBadge tone="warning">Community event (unofficial)</ToneBadge>
            )}
            {e.is_cancelled && <ToneBadge tone="danger">Cancelled</ToneBadge>}
          </>
        }
        title={e.title}
        actions={
          canManage && !e.is_cancelled ? (
            <>
              <EventFormDialog
                clubId={e.club_id ?? undefined}
                existing={{ id: e.id, title: e.title, description: e.description ?? "", category: e.category, venue: e.venue, starts_at: e.starts_at, ends_at: e.ends_at, capacity: e.capacity ?? "", registration_deadline: e.registration_deadline ?? "", club_id: e.club_id, cover_url: e.cover_url ?? "" }}
              />
              <ActionButton action={cancelEvent} input={{ eventId: e.id }} variant="destructive" size="sm"
                confirm={{ title: "Cancel this event?", description: "All registrants will be notified. This cannot be undone.", confirmLabel: "Cancel event", destructive: true }}>
                Cancel event
              </ActionButton>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-2 font-semibold">About this event</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{e.description || "No description provided."}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Organised by {e.organizer ? <Link href={`/profile/${e.organizer.handle}`} className="text-foreground hover:underline">{e.organizer.full_name}</Link> : "a member"}
              {e.club && <> for <Link href={`/clubs/${e.club.slug}`} className="text-foreground hover:underline">{e.club.name}</Link></>}
            </p>
          </section>

          {canManage && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-3 font-semibold">Participants ({participants?.length ?? 0})</h2>
              {!participants?.length ? (
                <p className="text-sm text-muted-foreground">No registrations yet.</p>
              ) : (
                <ol className="divide-y">
                  {participants.map((p, i) => (
                    <li key={p.user_id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-6 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                      <UserAvatar name={p.profile?.full_name ?? "Member"} src={p.profile?.avatar_url} size="xs" />
                      <span className="flex-1 truncate">{p.profile?.full_name ?? "Member"}</span>
                      <span className="hidden truncate text-xs text-muted-foreground sm:block">{p.profile?.department}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-xl border bg-card p-5 text-sm">
            <p className="flex gap-2"><CalendarDays className="size-4 shrink-0 text-primary" /> {formatDateTime(e.starts_at)} – {formatDateTime(e.ends_at)}</p>
            <p className="flex gap-2"><MapPin className="size-4 shrink-0 text-primary" /> {e.venue}</p>
            <p className="flex gap-2"><Clock className="size-4 shrink-0 text-primary" /> Registration {closed ? "closed" : "closes"} {formatDateTime(deadline)}</p>
            <div>
              <p className="flex gap-2"><Users className="size-4 shrink-0 text-primary" /> {e.capacity ? `${taken} of ${e.capacity} places taken` : `${taken} registered · no limit`}</p>
              {e.capacity && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Capacity used">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
            <div className="pt-2">
              {e.is_cancelled ? (
                <p className="text-destructive">This event was cancelled.</p>
              ) : isRegistered ? (
                <div className="space-y-2">
                  <p className="font-medium text-success">You&apos;re registered ✓</p>
                  <p className="text-xs text-muted-foreground">You&apos;ll get an in-app reminder within 24 hours of the start.</p>
                  <ActionButton action={cancelRegistration} input={{ eventId: e.id }} variant="outline" className="w-full" confirm={{ title: "Cancel your registration?", description: "Your place may be taken by someone else.", confirmLabel: "Cancel registration" }}>
                    Cancel registration
                  </ActionButton>
                </div>
              ) : closed ? (
                <p className="text-muted-foreground">Registration is closed.</p>
              ) : full ? (
                <p className="text-muted-foreground">This event is full.</p>
              ) : (
                <ActionButton action={registerForEvent} input={{ eventId: e.id }} className="h-9 w-full">Register</ActionButton>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
