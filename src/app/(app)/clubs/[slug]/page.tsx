import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, MessagesSquare } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getFeed } from "@/lib/queries/feed";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { CoverImage } from "@/components/common/cover-image";
import { UserAvatar } from "@/components/common/user-avatar";
import { ActionButton } from "@/components/common/action-button";
import { TimeAgo, formatDateTime } from "@/components/common/time-ago";
import { EmptyState } from "@/components/common/empty-state";
import { ClubFormDialog } from "@/components/clubs/club-form-dialog";
import { JoinClubButton } from "@/components/clubs/join-club-button";
import { EventFormDialog } from "@/components/clubs/event-form-dialog";
import { Composer } from "@/components/feed/composer";
import { PostCard } from "@/components/feed/post-card";
import { decideClubMember, leaveClub, setClubCoordinator, setClubOfficial } from "@/lib/actions/clubs";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]">): Promise<Metadata> {
  return { title: (await params).slug.replace(/-/g, " ") };
}

export default async function ClubPage({ params }: PageProps<"/clubs/[slug]">) {
  const { slug } = await params;
  const v = await requireViewer();
  const { data: club } = await v.supabase.from("clubs").select("*").eq("slug", slug).maybeSingle();
  if (!club) notFound();

  const [{ data: members }, { data: myRow }, { data: events }, feed] = await Promise.all([
    v.supabase.from("club_members").select("user_id, role, status, note, created_at, profile:profiles!club_members_user_id_fkey(handle, full_name, avatar_url)").eq("club_id", club.id).order("created_at"),
    v.supabase.from("club_members").select("role, status").eq("club_id", club.id).eq("user_id", v.userId).maybeSingle(),
    v.supabase.from("events").select("id, title, starts_at, venue, capacity, is_cancelled, cover_url").eq("club_id", club.id).gte("ends_at", new Date().toISOString()).order("starts_at").limit(10),
    getFeed(v, { tab: "all", clubId: club.id, limit: 10 }),
  ]);
  const isCoordinator = (myRow?.role === "coordinator" && myRow.status === "approved") || v.isAdmin;
  const approved = (members ?? []).filter((m) => m.status === "approved");
  const pending = (members ?? []).filter((m) => m.status === "pending");
  const coordinators = approved.filter((m) => m.role === "coordinator");

  return (
    <div>
      {club.cover_url && <CoverImage src={club.cover_url} width={1600} priority className="mb-6 h-40 w-full rounded-xl md:h-56" />}
      <PageHeader
        back={{ href: "/clubs", label: "All clubs" }}
        eyebrow={
          <>
            {club.is_official ? <ToneBadge tone="primary"><BadgeCheck className="size-3" /> Verified official club</ToneBadge> : <ToneBadge>Student-created club</ToneBadge>}
            <ToneBadge>{club.category}</ToneBadge>
          </>
        }
        title={<span className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-muted text-2xl" aria-hidden>{club.logo}</span>{club.name}</span>}
        description={club.tagline}
        actions={
          <>
            {v.isAdmin && (
              <ActionButton action={setClubOfficial} input={{ clubId: club.id, official: !club.is_official }} variant="outline">
                {club.is_official ? "Remove official status" : "Verify as official"}
              </ActionButton>
            )}
            {isCoordinator && <ClubFormDialog existing={{ id: club.id, name: club.name, slug: club.slug, tagline: club.tagline ?? "", description: club.description ?? "", category: club.category, logo: club.logo, membership_policy: club.membership_policy, requirements: club.requirements ?? "", cover_url: club.cover_url ?? "" }} />}
            {!myRow || myRow.status === "rejected" ? (
              <JoinClubButton clubId={club.id} policy={club.membership_policy} />
            ) : myRow.status === "pending" ? (
              <ToneBadge tone="info" className="h-8 px-3">Request pending</ToneBadge>
            ) : myRow.role === "member" ? (
              <ActionButton action={leaveClub} input={{ clubId: club.id }} variant="outline" confirm={{ title: `Leave ${club.name}?`, confirmLabel: "Leave" }}>Leave club</ActionButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {club.description && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-2 font-semibold">About</h2>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{club.description}</p>
              {club.requirements && (
                <p className="mt-3 text-sm"><span className="font-medium">Membership: </span><span className="text-muted-foreground">{club.requirements}</span></p>
              )}
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-primary" /> Upcoming events</h2>
              {isCoordinator && <EventFormDialog clubId={club.id} />}
            </div>
            {!events?.length ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No upcoming events.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/40">
                      <CoverImage src={e.cover_url ?? club.cover_url} emoji={club.logo} width={240} className="size-16 shrink-0 rounded-lg text-2xl" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(e.starts_at)} · {e.venue}</p>
                      </div>
                      {e.is_cancelled && <ToneBadge tone="danger">Cancelled</ToneBadge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold">Announcements</h2>
            {isCoordinator && <Composer userId={v.userId} name={club.name} avatar={null} fixedClubId={club.id} placeholder={`Post an announcement for ${club.name}…`} />}
            {feed.posts.length === 0 ? (
              <EmptyState title="No announcements yet" />
            ) : (
              feed.posts.map((p) => <PostCard key={p.id} post={p} canModerate={v.isModerator} />)
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {club.server_id && (
            <Link href={`/communities/${club.server_id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm hover:border-primary/40">
              <MessagesSquare className="size-5 text-primary" /> Club community chat
            </Link>
          )}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Coordinators</h2>
            <ul className="space-y-2">
              {coordinators.map((m) => (
                <li key={m.user_id}>
                  <Link href={`/profile/${m.profile?.handle}`} className="flex items-center gap-2 text-sm hover:underline">
                    <UserAvatar name={m.profile?.full_name ?? "Member"} src={m.profile?.avatar_url} size="xs" /> {m.profile?.full_name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {isCoordinator && (
            <section className="rounded-xl border border-primary/30 bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Membership requests ({pending.length})</h2>
              {!pending.length ? (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              ) : (
                <ul className="space-y-3">
                  {pending.map((m) => (
                    <li key={m.user_id} className="space-y-2">
                      <p className="text-sm font-medium">{m.profile?.full_name} <span className="text-xs font-normal text-muted-foreground">· <TimeAgo date={m.created_at} /></span></p>
                      {m.note && <p className="text-xs text-muted-foreground">“{m.note}”</p>}
                      <div className="flex gap-2">
                        <ActionButton action={decideClubMember} input={{ clubId: club.id, userId: m.user_id, approve: true }} size="sm">Approve</ActionButton>
                        <ActionButton action={decideClubMember} input={{ clubId: club.id, userId: m.user_id, approve: false }} size="sm" variant="outline">Decline</ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Members ({approved.length})</h2>
            <ul className="space-y-2">
              {approved.slice(0, 30).map((m) => (
                <li key={m.user_id} className="flex items-center gap-2 text-sm">
                  <UserAvatar name={m.profile?.full_name ?? "Member"} src={m.profile?.avatar_url} size="xs" />
                  <Link href={`/profile/${m.profile?.handle}`} className="truncate hover:underline">{m.profile?.full_name ?? "Member"}</Link>
                  {isCoordinator && m.user_id !== v.userId && (
                    <ActionButton action={setClubCoordinator} input={{ clubId: club.id, userId: m.user_id, coordinator: m.role !== "coordinator" }} size="xs" variant="ghost" className="ml-auto">
                      {m.role === "coordinator" ? "Remove coordinator" : "Make coordinator"}
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
