import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Lock, MessagesSquare, Search, Users } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { CoverImage } from "@/components/common/cover-image";
import { selectClass } from "@/components/common/form-field";
import { CreateServerDialog } from "@/components/communities/create-server-dialog";
import { Button } from "@/components/ui/button";
import { SERVER_CATEGORIES } from "@/lib/constants";

export const metadata: Metadata = { title: "Communities" };

export default async function CommunitiesPage({ searchParams }: PageProps<"/communities">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const v = await requireViewer();

  let query = v.supabase.from("servers").select("id, name, description, icon, cover_url, category, visibility, server_members(count)").order("created_at", { ascending: false }).limit(60);
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,description.ilike.%${q.replace(/[%,()]/g, "")}%`);
  if (category) query = query.eq("category", category);

  const [{ data: servers }, { data: mine }, { data: pending }] = await Promise.all([
    query,
    v.supabase.from("server_members").select("role, server:servers(id, name, icon, cover_url, category, visibility)").eq("user_id", v.userId),
    v.supabase.from("server_join_requests").select("server_id").eq("user_id", v.userId).eq("status", "pending"),
  ]);
  const memberOf = new Set((mine ?? []).map((m) => m.server?.id));
  const pendingSet = new Set((pending ?? []).map((p) => p.server_id));

  return (
    <div>
      <PageHeader
        title="Communities"
        description="Student-created spaces for departments, electives, research areas and hobbies. Anyone can create one; official clubs are labelled separately."
        actions={<CreateServerDialog />}
      />

      {(mine?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold">Your communities</h2>
          <ul className="flex gap-3 overflow-x-auto pb-2">
            {mine!.filter((m) => m.server).map((m) => (
              <li key={m.server!.id} className="shrink-0">
                <Link href={`/communities/${m.server!.id}`} className="flex w-48 flex-col overflow-hidden rounded-xl border bg-card hover:border-primary/40">
                  <CoverImage src={m.server!.cover_url} emoji={m.server!.icon} width={400} className="h-20 w-full text-2xl" />
                  <span className="flex flex-col items-start gap-1 p-3">
                    <span className="line-clamp-1 text-sm font-medium">{m.server!.icon} {m.server!.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="cq" className="sr-only">Search communities</label>
          <input id="cq" name="q" defaultValue={q} placeholder="Search communities…" className="h-9 w-full rounded-lg border border-input bg-input/30 pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <label htmlFor="ccat" className="sr-only">Category</label>
        <select id="ccat" name="category" defaultValue={category} className={`${selectClass} sm:w-48`}>
          <option value="">All categories</option>
          {SERVER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Button type="submit" variant="secondary" className="h-9">Filter</Button>
      </form>

      {!servers?.length ? (
        <EmptyState icon={MessagesSquare} title="No communities found" description="Start one for your elective, project team or hobby." action={<CreateServerDialog />} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {servers.map((s) => (
            <li key={s.id}>
              <Link href={`/communities/${s.id}`} className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40">
                <div className="overflow-hidden">
                  <CoverImage src={s.cover_url} emoji={s.icon} width={640} className="h-28 w-full transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col p-4 pt-0">
                <div className="flex items-start gap-3">
                  <span className="-mt-5 grid size-11 shrink-0 place-items-center rounded-xl border-2 border-card bg-muted text-2xl shadow-sm" aria-hidden>{s.icon}</span>
                  <div className="min-w-0 flex-1 pt-2">
                    <p className="truncate font-medium">{s.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <ToneBadge>{s.category}</ToneBadge>
                      {s.visibility === "private" ? <ToneBadge tone="warning"><Lock className="size-3" /> Private</ToneBadge> : <ToneBadge tone="info"><Globe className="size-3" /> Public</ToneBadge>}
                    </div>
                  </div>
                </div>
                {s.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" /> {s.visibility === "private" && !memberOf.has(s.id) ? "Members only" : `${s.server_members[0]?.count ?? 0} members`}
                  </span>
                  {memberOf.has(s.id) ? <span className="text-primary">Joined</span> : pendingSet.has(s.id) ? <span>Request pending</span> : null}
                </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
