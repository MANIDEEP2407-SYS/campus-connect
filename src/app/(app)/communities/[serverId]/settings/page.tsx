import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { getServerContext } from "@/lib/queries/communities";
import { PageHeader } from "@/components/common/page-header";
import { UserAvatar } from "@/components/common/user-avatar";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionButton } from "@/components/common/action-button";
import { TimeAgo } from "@/components/common/time-ago";
import { CreateServerDialog } from "@/components/communities/create-server-dialog";
import { InviteManager } from "@/components/communities/invite-manager";
import { decideServerRequest, deleteServer, removeServerMember, setServerMemberRole, transferServerOwnership } from "@/lib/actions/communities";

export const metadata: Metadata = { title: "Community settings" };

export default async function ServerSettings({ params }: PageProps<"/communities/[serverId]/settings">) {
  const { serverId } = await params;
  const v = await requireViewer();
  const ctx = await getServerContext(v, serverId);
  if (!ctx) notFound();
  if (!ctx.isStaff) redirect(`/communities/${serverId}`);
  const isOwner = ctx.role === "owner";

  const [{ data: requests }, { data: invites }, { data: members }] = await Promise.all([
    v.supabase.from("server_join_requests").select("user_id, message, created_at, profile:profiles!server_join_requests_user_id_fkey(handle, full_name, avatar_url)").eq("server_id", serverId).eq("status", "pending").order("created_at"),
    v.supabase.from("server_invites").select("id, code, uses, max_uses, expires_at").eq("server_id", serverId).order("created_at", { ascending: false }),
    v.supabase.from("server_members").select("user_id, role, joined_at, profile:profiles!server_members_user_id_fkey(handle, full_name, avatar_url)").eq("server_id", serverId).order("joined_at"),
  ]);
  const s = ctx.server;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: `/communities/${serverId}`, label: s.name }}
        title="Community settings"
        description={`You are ${isOwner ? "the owner" : "a moderator"} of ${s.name}.`}
        actions={<CreateServerDialog existing={{ id: s.id, name: s.name, description: s.description ?? "", icon: s.icon, category: s.category, visibility: s.visibility, cover_url: s.cover_url ?? "" }} />}
      />

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Join requests {requests?.length ? <ToneBadge tone="primary">{requests.length}</ToneBadge> : null}</h2>
        {!requests?.length ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="divide-y">
            {requests.map((r) => (
              <li key={r.user_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <UserAvatar name={r.profile?.full_name ?? "Member"} src={r.profile?.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.profile?.full_name ?? "Member"} <span className="text-xs font-normal text-muted-foreground">· <TimeAgo date={r.created_at} /></span></p>
                  {r.message && <p className="text-sm text-muted-foreground">“{r.message}”</p>}
                </div>
                <div className="flex gap-2">
                  <ActionButton action={decideServerRequest} input={{ serverId, userId: r.user_id, approve: true }} size="sm">Approve</ActionButton>
                  <ActionButton action={decideServerRequest} input={{ serverId, userId: r.user_id, approve: false }} size="sm" variant="outline">Decline</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InviteManager serverId={serverId} invites={invites ?? []} />

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Members ({members?.length ?? 0})</h2>
        <ul className="divide-y">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2.5">
              <UserAvatar name={m.profile?.full_name ?? "Member"} src={m.profile?.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.profile?.full_name ?? "Member"}</p>
                <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
              </div>
              {m.role !== "owner" && m.user_id !== v.userId && (
                <div className="flex flex-wrap gap-1.5">
                  {isOwner && (
                    <ActionButton action={setServerMemberRole} input={{ serverId, userId: m.user_id, role: m.role === "moderator" ? "member" : "moderator" }} size="sm" variant="outline">
                      {m.role === "moderator" ? "Remove moderator" : "Make moderator"}
                    </ActionButton>
                  )}
                  {isOwner && (
                    <ActionButton action={transferServerOwnership} input={{ serverId, userId: m.user_id }} size="sm" variant="ghost"
                      confirm={{ title: `Transfer ownership to ${m.profile?.full_name}?`, description: "You will become a moderator. This can only be undone by the new owner.", confirmLabel: "Transfer" }}>
                      Make owner
                    </ActionButton>
                  )}
                  {(isOwner || m.role === "member") && (
                    <ActionButton action={removeServerMember} input={{ serverId, userId: m.user_id }} size="sm" variant="destructive"
                      confirm={{ title: `Remove ${m.profile?.full_name}?`, confirmLabel: "Remove", destructive: true }}>
                      Remove
                    </ActionButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <section className="rounded-xl border border-destructive/30 p-5">
          <h2 className="font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">Deleting removes all channels and messages permanently.</p>
          <ActionButton action={deleteServer} input={{ serverId }} variant="destructive"
            confirm={{ title: `Delete ${s.name}?`, description: "This permanently deletes the community, its channels and message history.", confirmLabel: "Delete community", destructive: true }}
            redirectTo="/communities">
            Delete community
          </ActionButton>
        </section>
      )}
    </div>
  );
}
