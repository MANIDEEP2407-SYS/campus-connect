import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, FlaskConical, Plus, Search } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { TimeAgo } from "@/components/common/time-ago";
import { selectClass } from "@/components/common/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { RESEARCH_AREAS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Research & consultancy" };

export default async function ResearchPage({ searchParams }: PageProps<"/research">) {
  const sp = await searchParams;
  const kind = sp.kind === "consultancy" ? "consultancy" : "research";
  const area = typeof sp.area === "string" ? sp.area : "";
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%,()]/g, "").slice(0, 60) : "";
  const showClosed = sp.closed === "1";
  const v = await requireViewer();
  const canPublish = v.roles.has("faculty") || v.isAdmin || v.profile.affiliation === "phd_scholar";

  let query = v.supabase
    .from("research_projects")
    .select("id, title, abstract, area, department, required_skills, commitment, positions, status, created_at, lead:profiles!research_projects_lead_id_fkey(full_name, handle)")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(60);
  if (!showClosed) query = query.eq("status", "open");
  if (area) query = query.eq("area", area);
  if (q) query = query.or(`title.ilike.%${q}%,abstract.ilike.%${q}%`);
  const [{ data: projects }, { data: myApps }] = await Promise.all([
    query,
    v.supabase.from("research_applications").select("project_id, status").eq("applicant_id", v.userId),
  ]);
  const applied = new Map((myApps ?? []).map((a) => [a.project_id, a.status]));
  const mySkills = new Set(v.profile.skills.map((s) => s.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Research & consultancy"
        description="Faculty and doctoral scholars publish opportunities; students apply with a short statement. Decisions are tracked here with notifications."
        actions={canPublish ? <Link href={`/research/new?kind=${kind}`} className={buttonVariants()}><Plus /> Publish {kind === "consultancy" ? "listing" : "project"}</Link> : undefined}
      />
      <nav aria-label="Listing type" className="mb-4 inline-flex rounded-lg border bg-card p-1">
        {(["research", "consultancy"] as const).map((k) => (
          <Link key={k} href={`/research?kind=${k}`} aria-current={kind === k ? "page" : undefined}
            className={cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground", kind === k && "bg-muted font-medium text-foreground")}>
            {k === "research" ? <FlaskConical className="size-4" /> : <Briefcase className="size-4" />} {k === "research" ? "Research projects" : "Consultancy"}
          </Link>
        ))}
      </nav>
      <form className="mb-6 flex flex-col gap-2 sm:flex-row" role="search">
        <input type="hidden" name="kind" value={kind} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="rq" className="sr-only">Search projects</label>
          <input id="rq" name="q" defaultValue={q} placeholder="Search by title or topic…" className="h-9 w-full rounded-lg border border-input bg-input/30 pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <label htmlFor="rarea" className="sr-only">Area</label>
        <select id="rarea" name="area" defaultValue={area} className={`${selectClass} sm:w-56`}>
          <option value="">All areas</option>
          {RESEARCH_AREAS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm whitespace-nowrap">
          <input type="checkbox" name="closed" value="1" defaultChecked={showClosed} className="accent-[var(--primary)]" /> Include closed
        </label>
        <Button type="submit" variant="secondary" className="h-9">Filter</Button>
      </form>
      {kind === "consultancy" && (
        <p className="mb-4 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          Consultancy listings show scope and required expertise only. Budgets, agreements and confidential documents stay restricted to the project lead and administrators, subject to institutional approval.
        </p>
      )}

      {!projects?.length ? (
        <EmptyState icon={FlaskConical} title="No open listings" description={canPublish ? "Publish the first one." : "Check back soon — faculty post new opportunities regularly."} />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const st = applied.get(p.id);
            return (
              <li key={p.id}>
                <Link href={`/research/${p.id}`} className="block rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ToneBadge tone="primary">{p.area}</ToneBadge>
                    {p.status !== "open" && <ToneBadge>{p.status}</ToneBadge>}
                    {st && <ToneBadge tone={st === "accepted" ? "success" : st === "rejected" ? "danger" : "info"}>Application: {st}</ToneBadge>}
                  </div>
                  <p className="mt-2 text-lg font-medium">{p.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.abstract}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Required skills">
                    {p.required_skills.map((s) => (
                      <li key={s} className={cn("rounded-md px-2 py-0.5 text-xs", mySkills.has(s.toLowerCase()) ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{s}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Led by {p.lead?.full_name ?? "—"} · {p.commitment} · {p.positions} position{p.positions > 1 ? "s" : ""} · <TimeAgo date={p.created_at} />
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
