import { notFound, redirect } from "next/navigation";
import { Lock, Users } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getServerContext } from "@/lib/queries/communities";
import { JoinServerPanel } from "@/components/communities/join-server-panel";
import { PageHeader } from "@/components/common/page-header";

export default async function ServerIndex({ params }: PageProps<"/communities/[serverId]">) {
  const { serverId } = await params;
  const v = await requireViewer();
  const ctx = await getServerContext(v, serverId);
  if (!ctx) notFound();

  if (ctx.canRead) {
    const { data: ch } = await v.supabase.from("channels").select("id").eq("server_id", serverId).order("position").limit(1).maybeSingle();
    if (ch) redirect(`/communities/${serverId}/${ch.id}`);
  }

  const { data: request } = await v.supabase.from("server_join_requests").select("status").eq("server_id", serverId).eq("user_id", v.userId).maybeSingle();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: "/communities", label: "Communities" }} title={<span className="flex items-center gap-3"><span aria-hidden>{ctx.server.icon}</span>{ctx.server.name}</span>} />
      <div className="rounded-xl border bg-card p-6">
        <p className="mb-2 flex items-center gap-2 text-sm text-warning"><Lock className="size-4" /> Private community</p>
        {ctx.server.description && <p className="text-sm text-muted-foreground">{ctx.server.description}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" /> Channels, members and messages are visible to members only</p>
        <div className="mt-5">
          <JoinServerPanel serverId={serverId} visibility={ctx.server.visibility} requestStatus={request?.status ?? null} />
        </div>
      </div>
    </div>
  );
}
