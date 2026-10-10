import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { TimeAgo } from "@/components/common/time-ago";
import { ActionButton } from "@/components/common/action-button";
import { ModerationActions } from "@/components/admin/moderation-actions";
import { moderateLfItem, reviewClaim } from "@/lib/actions/lostfound";
import { runMaintenance } from "@/lib/actions/admin";
import { setClubOfficial } from "@/lib/actions/clubs";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin & moderation" };

const TABS = { moderation: "Flagged content", lostfound: "Lost & Found", clubs: "Club verification", roles: "Roles", audit: "Audit log" } as const;
type Tab = keyof typeof TABS;

function targetHref(type: string, id: string) {
  switch (type) {
    case "post": return `/home#post-${id}`;
    case "server": return `/communities/${id}`;
    case "lf_item": return `/lost-found/${id}`;
    case "pulse_report": return `/pulse/${id}`;
    case "resource": return "/resources";
    default: return null;
  }
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const v = await requireViewer();
  if (!v.isModerator) redirect("/home");
  const sp = await searchParams;
  const allowed: Tab[] = v.isAdmin ? ["moderation", "lostfound", "clubs", "roles", "audit"] : ["moderation", "lostfound"];
  const tab = (typeof sp.tab === "string" && (allowed as string[]).includes(sp.tab) ? sp.tab : "moderation") as Tab;

  return (
    <div>
      <PageHeader title="Admin & moderation" description="Review flagged content, Lost & Found disputes and verification requests. Every action here is recorded in the audit log."
        actions={<ActionButton action={runMaintenance} input={{}} variant="outline" size="sm">Run expiry maintenance</ActionButton>} />
      <nav aria-label="Admin sections" className="mb-6 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {allowed.map((t) => (
          <Link key={t} href={`/admin?tab=${t}`} aria-current={tab === t ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground", tab === t && "bg-muted font-medium text-foreground")}>
            {TABS[t]}
          </Link>
        ))}
      </nav>
      {tab === "moderation" && <ModerationTab />}
      {tab === "lostfound" && <LostFoundTab />}
      {tab === "clubs" && <ClubsTab />}
      {tab === "roles" && <RolesTab q={typeof sp.q === "string" ? sp.q : ""} />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

async function ModerationTab() {
  const v = await requireViewer();
  const { data: reports } = await v.supabase
    .from("moderation_reports")
    .select("id, target_type, target_id, reason, status, created_at, reporter:profiles!moderation_reports_reporter_id_fkey(full_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  const ids = (t: string) => (reports ?? []).filter((r) => r.target_type === t).map((r) => r.target_id);
  const [{ data: posts }, { data: comments }, { data: messages }, { data: profiles }] = await Promise.all([
    ids("post").length ? v.supabase.from("posts").select("id, body").in("id", ids("post")) : Promise.resolve({ data: [] }),
    ids("comment").length ? v.supabase.from("comments").select("id, body").in("id", ids("comment")) : Promise.resolve({ data: [] }),
    ids("message").length ? v.supabase.from("messages").select("id, body, server_id, channel_id").in("id", ids("message")) : Promise.resolve({ data: [] }),
    ids("profile").length ? v.supabase.from("profiles").select("id, handle, full_name").in("id", ids("profile")) : Promise.resolve({ data: [] }),
  ]);
  const preview = new Map<string, { text: string; href?: string }>([
    ...(posts ?? []).map((p) => [p.id, { text: p.body }] as const),
    ...(comments ?? []).map((c) => [c.id, { text: c.body }] as const),
    ...(messages ?? []).map((m) => [m.id, { text: m.body, href: `/communities/${m.server_id}/${m.channel_id}` }] as const),
    ...(profiles ?? []).map((p) => [p.id, { text: `${p.full_name} (@${p.handle})`, href: `/profile/${p.handle}` }] as const),
  ]);

  if (!reports?.length) return <EmptyState title="No open reports" description="Flagged posts, messages, listings and profiles appear here." />;
  return (
    <ul className="space-y-3">
      {reports.map((r) => {
        const pv = preview.get(r.target_id);
        const href = pv?.href ?? targetHref(r.target_type, r.target_id);
        const removable = ["post", "comment", "message", "lf_item", "resource", "server"].includes(r.target_type);
        return (
          <li key={r.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone="warning" className="capitalize">{r.target_type.replace("_", " ")}</ToneBadge>
              <span className="text-xs text-muted-foreground">Reported by {r.reporter?.full_name ?? "member"} · <TimeAgo date={r.created_at} /></span>
              {href && <Link href={href} className="ml-auto text-xs text-primary hover:underline">Open target</Link>}
            </div>
            <p className="mt-2 text-sm"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
            {pv && <blockquote className="mt-2 line-clamp-3 border-l-2 pl-3 text-sm text-muted-foreground">{pv.text}</blockquote>}
            <ModerationActions reportId={r.id} removable={removable} />
          </li>
        );
      })}
    </ul>
  );
}

async function LostFoundTab() {
  const v = await requireViewer();
  const [{ data: flagged }, { data: disputes }, { data: expired }] = await Promise.all([
    v.supabase.from("lost_found_items").select("id, title, kind, status, created_at").eq("flagged", true).neq("status", "removed").order("created_at", { ascending: false }),
    v.supabase.from("lost_found_claims").select("id, details, dispute_reason, created_at, item:lost_found_items!lost_found_claims_item_id_fkey(id, title), claimant:profiles!lost_found_claims_claimant_id_fkey(full_name)").eq("status", "disputed"),
    v.supabase.from("lost_found_items").select("id, title, kind, expires_at").eq("status", "open").lt("expires_at", new Date().toISOString()).limit(50),
  ]);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 font-semibold">Claim disputes ({disputes?.length ?? 0})</h2>
        {!disputes?.length ? <p className="text-sm text-muted-foreground">No disputes.</p> : (
          <ul className="space-y-3">
            {disputes.map((d) => (
              <li key={d.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
                <p><Link href={`/lost-found/${d.item?.id}`} className="font-medium hover:underline">{d.item?.title}</Link> <span className="text-xs text-muted-foreground">· claimant {d.claimant?.full_name} · <TimeAgo date={d.created_at} /></span></p>
                <p className="text-muted-foreground"><span className="text-foreground">Claim:</span> {d.details}</p>
                <p className="text-warning">Dispute: {d.dispute_reason}</p>
                <div className="flex gap-2">
                  <ActionButton action={reviewClaim} input={{ claimId: d.id, approve: true, note: "Approved by moderator after review" }} size="sm">Uphold claim</ActionButton>
                  <ActionButton action={reviewClaim} input={{ claimId: d.id, approve: false, note: "Dispute reviewed by moderator: not approved" }} size="sm" variant="outline">Reject</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Flagged listings ({flagged?.length ?? 0})</h2>
        {!flagged?.length ? <p className="text-sm text-muted-foreground">Nothing flagged.</p> : (
          <ul className="divide-y rounded-xl border bg-card">
            {flagged.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Link href={`/lost-found/${i.id}`} className="font-medium hover:underline">{i.title}</Link>
                <ToneBadge>{i.kind}</ToneBadge>
                <div className="ml-auto flex gap-2">
                  <ActionButton action={moderateLfItem} input={{ itemId: i.id, action: "clear_flag" }} size="sm" variant="outline">Clear flag</ActionButton>
                  <ActionButton action={moderateLfItem} input={{ itemId: i.id, action: "remove", note: "Removed after review" }} size="sm" variant="destructive">Remove</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Past expiry ({expired?.length ?? 0})</h2>
        {!expired?.length ? <p className="text-sm text-muted-foreground">No stale listings. Run expiry maintenance to sweep automatically.</p> : (
          <ul className="divide-y rounded-xl border bg-card">
            {expired.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Link href={`/lost-found/${i.id}`} className="hover:underline">{i.title}</Link>
                <ActionButton action={moderateLfItem} input={{ itemId: i.id, action: "expire" }} size="sm" variant="ghost" className="ml-auto">Mark expired</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function ClubsTab() {
  const v = await requireViewer();
  const { data: clubs } = await v.supabase.from("clubs").select("id, slug, name, category, is_official, created_at").order("is_official").order("created_at", { ascending: false });
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {(clubs ?? []).map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <Link href={`/clubs/${c.slug}`} className="font-medium hover:underline">{c.name}</Link>
          <ToneBadge>{c.category}</ToneBadge>
          {c.is_official && <ToneBadge tone="primary">Official</ToneBadge>}
          <ActionButton action={setClubOfficial} input={{ clubId: c.id, official: !c.is_official }} size="sm" variant={c.is_official ? "ghost" : "outline"} className="ml-auto">
            {c.is_official ? "Remove official" : "Verify official"}
          </ActionButton>
        </li>
      ))}
    </ul>
  );
}

async function RolesTab({ q }: { q: string }) {
  const v = await requireViewer();
  const { data: roles } = await v.supabase.from("user_roles").select("user_id, role, created_at, profile:profiles!user_roles_user_id_fkey(handle, full_name)").order("created_at");
  const { data: found } = q.length >= 2 ? await v.supabase.rpc("search_people", { q, p_limit: 20 }) : { data: [] };
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-1 font-semibold">Grant a role</h2>
        <p className="mb-3 text-xs text-muted-foreground">Roles can only be changed here by platform administrators (enforced in the database). Open a profile to toggle roles.</p>
        <form className="flex gap-2">
          <input type="hidden" name="tab" value="roles" />
          <label htmlFor="role-q" className="sr-only">Find a person</label>
          <input id="role-q" name="q" defaultValue={q} placeholder="Find a person…" className="h-9 flex-1 rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring" />
          <button className="h-9 rounded-lg bg-secondary px-3 text-sm">Search</button>
        </form>
        {(found?.length ?? 0) > 0 && (
          <ul className="mt-3 divide-y">
            {found!.map((p) => (
              <li key={p.id} className="py-2 text-sm"><Link href={`/profile/${p.handle}`} className="hover:underline">{p.full_name}</Link> <span className="text-xs text-muted-foreground">@{p.handle}</span></li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Current privileged roles</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {(roles ?? []).map((r) => (
            <li key={`${r.user_id}-${r.role}`} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Link href={`/profile/${r.profile?.handle}`} className="font-medium hover:underline">{r.profile?.full_name}</Link>
              <ToneBadge tone="warning">{ROLE_LABELS[r.role]}</ToneBadge>
              <span className="ml-auto text-xs text-muted-foreground">since <TimeAgo date={r.created_at} /></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function AuditTab() {
  const v = await requireViewer();
  const { data: logs } = await v.supabase.from("audit_logs").select("id, action, target_type, target_id, details, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)").order("created_at", { ascending: false }).limit(200);
  if (!logs?.length) return <EmptyState title="No audit entries yet" />;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr><th scope="col" className="px-4 py-2.5 font-medium">When</th><th scope="col" className="px-4 py-2.5 font-medium">Actor</th><th scope="col" className="px-4 py-2.5 font-medium">Action</th><th scope="col" className="px-4 py-2.5 font-medium">Target</th><th scope="col" className="px-4 py-2.5 font-medium">Details</th></tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground"><TimeAgo date={l.created_at} /></td>
              <td className="px-4 py-2.5">{l.actor?.full_name ?? "System"}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.target_type} {l.target_id?.slice(0, 8)}</td>
              <td className="max-w-xs truncate px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{JSON.stringify(l.details)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
