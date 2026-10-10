import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Hash, Settings } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getServerContext } from "@/lib/queries/communities";
import { ChannelChat, type ChatMember, type ChatMessage } from "@/components/communities/channel-chat";
import { ChannelManager } from "@/components/communities/channel-manager";
import { ChannelSwitcher } from "@/components/communities/channel-switcher";
import { JoinServerPanel } from "@/components/communities/join-server-panel";
import { UserAvatar } from "@/components/common/user-avatar";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionButton } from "@/components/common/action-button";
import { leaveServer } from "@/lib/actions/communities";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/communities/[serverId]/[channelId]">): Promise<Metadata> {
  void params;
  return { title: "Community" };
}

export default async function ChannelPage({ params }: PageProps<"/communities/[serverId]/[channelId]">) {
  const { serverId, channelId } = await params;
  const v = await requireViewer();
  const ctx = await getServerContext(v, serverId);
  if (!ctx) notFound();
  if (!ctx.canRead) redirect(`/communities/${serverId}`);

  const [{ data: channels }, { data: members }, { data: messages }] = await Promise.all([
    v.supabase.from("channels").select("id, name, topic, position").eq("server_id", serverId).order("position"),
    v.supabase
      .from("server_members")
      .select("role, user_id, profile:profiles!server_members_user_id_fkey(id, handle, full_name, avatar_url)")
      .eq("server_id", serverId)
      .order("joined_at")
      .limit(300),
    v.supabase
      .from("messages")
      .select("id, body, author_id, reply_to, created_at, edited_at, deleted_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const channel = channels?.find((c) => c.id === channelId);
  if (!channel) notFound();

  const memberList: ChatMember[] = (members ?? [])
    .filter((m) => m.profile)
    .map((m) => ({ id: m.user_id, role: m.role, handle: m.profile!.handle, full_name: m.profile!.full_name, avatar_url: m.profile!.avatar_url }));
  const initial = ((messages ?? []) as ChatMessage[]).reverse();
  const roleOrder = { owner: 0, moderator: 1, member: 2 } as const;

  return (
    // Below lg the fixed bottom nav (~4rem) overlays the page, so reserve it as well as the topbar.
    <div className="-mx-4 -mt-6 -mb-24 flex h-[calc(100dvh-8rem)] md:-mx-6 lg:-mb-10 lg:h-[calc(100dvh-4rem)]">
      {/* Channel list */}
      <nav aria-label="Channels" className="hidden w-60 shrink-0 flex-col border-r bg-sidebar/60 md:flex">
        <div className="border-b p-4">
          <Link href="/communities" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> All communities</Link>
          <p className="flex items-center gap-2 font-semibold"><span aria-hidden>{ctx.server.icon}</span> <span className="truncate">{ctx.server.name}</span></p>
          <div className="mt-1 flex gap-1.5">
            <ToneBadge>{ctx.server.category}</ToneBadge>
            {ctx.server.visibility === "private" && <ToneBadge tone="warning">Private</ToneBadge>}
          </div>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {channels!.map((c) => (
            <li key={c.id}>
              <Link href={`/communities/${serverId}/${c.id}`} aria-current={c.id === channelId ? "page" : undefined}
                className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", c.id === channelId && "bg-muted text-foreground")}>
                <Hash className="size-4 shrink-0" /> <span className="truncate">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t p-3">
          {ctx.isStaff && <ChannelManager serverId={serverId} channel={channel} />}
          {ctx.isStaff && (
            <Link href={`/communities/${serverId}/settings`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <Settings className="size-4" /> Community settings
            </Link>
          )}
          {ctx.isMember && ctx.role !== "owner" && (
            <ActionButton action={leaveServer} input={{ serverId }} variant="ghost" size="sm" className="w-full justify-start text-muted-foreground"
              confirm={{ title: `Leave ${ctx.server.name}?`, description: ctx.server.visibility === "private" ? "You'll need a new invite or approval to rejoin." : undefined, confirmLabel: "Leave", destructive: true }}
              redirectTo="/communities">
              Leave community
            </ActionButton>
          )}
        </div>
      </nav>

      {/* Messages */}
      <section className="flex min-w-0 flex-1 flex-col" aria-label={`#${channel.name}`}>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <Link href="/communities" className="md:hidden" aria-label="Back to communities"><ArrowLeft className="size-4" /></Link>
          <Hash className="size-4 text-muted-foreground" />
          <h1 className="font-semibold">{channel.name}</h1>
          {channel.topic && <p className="hidden truncate border-l pl-3 text-sm text-muted-foreground sm:block">{channel.topic}</p>}
          <ChannelSwitcher serverId={serverId} channelId={channelId} channels={channels!.map((c) => ({ id: c.id, name: c.name }))} />
        </header>
        <ChannelChat
          channelId={channelId}
          channelName={channel.name}
          serverId={serverId}
          me={{ id: v.userId, full_name: v.profile.full_name, handle: v.profile.handle, avatar_url: v.profile.avatar_url, role: ctx.role ?? "member" }}
          members={memberList}
          initialMessages={initial}
          canPost={ctx.isMember}
          canModerate={ctx.isStaff || v.isModerator}
          joinSlot={!ctx.isMember ? <JoinServerPanel serverId={serverId} visibility={ctx.server.visibility} requestStatus={null} /> : null}
        />
      </section>

      {/* Members */}
      <aside aria-label="Members" className="hidden w-60 shrink-0 overflow-y-auto border-l p-3 xl:block">
        <p className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Members — {memberList.length}</p>
        <ul className="space-y-0.5">
          {[...memberList].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]).map((m) => (
            <li key={m.id}>
              <Link href={`/profile/${m.handle}`} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted">
                <UserAvatar name={m.full_name} src={m.avatar_url} size="xs" />
                <span className="truncate">{m.full_name}</span>
                {m.role !== "member" && <ToneBadge tone={m.role === "owner" ? "warning" : "primary"} className="ml-auto capitalize">{m.role}</ToneBadge>}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
