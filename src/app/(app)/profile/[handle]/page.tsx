import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Lock, Pencil, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getFeed } from "@/lib/queries/feed";
import { UserAvatar } from "@/components/common/user-avatar";
import { ToneBadge } from "@/components/common/tone-badge";
import { EmptyState } from "@/components/common/empty-state";
import { FollowButton } from "@/components/profile/follow-button";
import { MessageButton } from "@/components/profile/message-button";
import { FlagButton } from "@/components/common/flag-button";
import { PostCard } from "@/components/feed/post-card";
import { RoleManager } from "@/components/admin/role-manager";
import { BlockControls } from "@/components/shield/block-controls";
import { microsoftConfig } from "@/lib/microsoft";
import { buttonVariants } from "@/components/ui/button";
import { AFFILIATION_LABELS, ROLE_LABELS } from "@/lib/constants";

export async function generateMetadata({ params }: PageProps<"/profile/[handle]">): Promise<Metadata> {
  return { title: `@${(await params).handle}` };
}

export default async function ProfilePage({ params }: PageProps<"/profile/[handle]">) {
  const { handle } = await params;
  const v = await requireViewer();
  const { data: p } = await v.supabase.from("profile_cards").select("*").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!p || !p.id) notFound();
  const isMe = p.id === v.userId;

  const msTenant = microsoftConfig().tenantId;
  const { data: block } = isMe ? { data: null } : await v.supabase.from("user_blocks").select("kind").eq("blocker_id", v.userId).eq("blocked_id", p.id).maybeSingle();
  const [{ count: followers }, { count: followingCount }, { data: amFollowing }, { data: roles }, { data: clubs }, feed] = await Promise.all([
    v.supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", p.id),
    v.supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
    v.supabase.from("follows").select("followee_id").eq("follower_id", v.userId).eq("followee_id", p.id).maybeSingle(),
    v.supabase.from("user_roles").select("role").eq("user_id", p.id),
    v.supabase.from("club_members").select("role, club:clubs(slug, name, logo, is_official)").eq("user_id", p.id).eq("status", "approved"),
    getFeed(v, { tab: "all", authorId: p.id, limit: 10 }),
  ]);
  const restricted = !isMe && p.visibility === "connections" && p.bio === null && p.skills?.length === 0;
  const roleList = (roles ?? []).map((r) => r.role);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="rounded-xl border bg-card p-5">
          <UserAvatar name={p.full_name!} src={p.avatar_url} size="xl" />
          <h1 className="mt-4 text-xl font-semibold">{p.full_name}</h1>
          <p className="text-sm text-muted-foreground">@{p.handle}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {msTenant && p.ms_tenant_id === msTenant ? (
              <ToneBadge tone="primary"><BadgeCheck className="size-3" /> Verified Amrita Microsoft account</ToneBadge>
            ) : null}
            <ToneBadge>{AFFILIATION_LABELS[p.affiliation!]} (self-declared)</ToneBadge>
            {roleList.map((r) => (
              <ToneBadge key={r} tone={r === "faculty" ? "primary" : "warning"}>
                {r === "faculty" ? <BadgeCheck className="size-3" /> : <ShieldCheck className="size-3" />} {ROLE_LABELS[r]}
              </ToneBadge>
            ))}
          </div>
          {(p.department || p.program) && (
            <p className="mt-3 text-sm">
              {p.program}
              {p.program && p.department && " · "}
              {p.department}
              {p.year_of_study && ` · Year ${p.year_of_study}`}
            </p>
          )}
          {p.bio && <p className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">{p.bio}</p>}
          <dl className="mt-4 flex gap-5 text-sm">
            <div><dt className="text-xs text-muted-foreground">Followers</dt><dd className="font-semibold tabular-nums">{followers ?? 0}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Following</dt><dd className="font-semibold tabular-nums">{followingCount ?? 0}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {isMe ? (
              <Link href="/profile/edit" className={buttonVariants({ variant: "outline", size: "sm" })}><Pencil /> Edit profile</Link>
            ) : (
              <>
                <FollowButton userId={p.id} following={Boolean(amFollowing)} />
                {p.allow_dms && <MessageButton userId={p.id} />}
                <FlagButton targetType="profile" targetId={p.id} iconOnly />
                <BlockControls userId={p.id} name={p.full_name!} state={(block?.kind as "block" | "mute" | undefined) ?? null} />
              </>
            )}
          </div>
        </section>

        {restricted ? (
          <section className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            <Lock className="mb-2 size-4" /> {p.full_name} shares profile details only with people they follow.
          </section>
        ) : (
          <>
            {(p.interests?.length ?? 0) > 0 && <TagSection title="Interests" tags={p.interests!} link />}
            {(p.skills?.length ?? 0) > 0 && <TagSection title="Skills" tags={p.skills!} link />}
            {(p.goals?.length ?? 0) > 0 && <TagSection title="Looking for" tags={p.goals!} />}
          </>
        )}

        {(clubs?.length ?? 0) > 0 && (
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Clubs</h2>
            <ul className="space-y-2">
              {clubs!.filter((c) => c.club).map((c) => (
                <li key={c.club!.slug}>
                  <Link href={`/clubs/${c.club!.slug}`} className="flex items-center gap-2 text-sm hover:underline">
                    <span aria-hidden>{c.club!.logo}</span> {c.club!.name}
                    {c.role === "coordinator" && <ToneBadge tone="primary">Coordinator</ToneBadge>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {v.isAdmin && !isMe && <RoleManager userId={p.id} roles={roleList} />}
      </aside>

      <section className="min-w-0 space-y-4">
        <h2 className="text-base font-semibold">Posts</h2>
        {feed.posts.length === 0 ? (
          <EmptyState title={isMe ? "You haven't posted yet" : "No posts yet"} description={isMe ? "Share a project or achievement from the Home feed." : undefined} />
        ) : (
          feed.posts.map((post) => <PostCard key={post.id} post={post} canModerate={v.isModerator} />)
        )}
      </section>
    </div>
  );
}

function TagSection({ title, tags, link }: { title: string; tags: string[]; link?: boolean }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <li key={t}>
            {link ? (
              <Link href={`/discover?interest=${encodeURIComponent(t)}`} className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs hover:text-primary">{t}</Link>
            ) : (
              <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs">{t}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
