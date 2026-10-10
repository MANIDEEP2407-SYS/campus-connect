import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Search, Sparkles } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { recommend } from "@/lib/discover";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PersonCard, type PersonCardData } from "@/components/profile/person-card";
import { selectClass } from "@/components/common/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { AFFILIATION_LABELS, DEPARTMENTS } from "@/lib/constants";
import type { Enums } from "@/lib/database.types";

export const metadata: Metadata = { title: "Discover people" };

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const department = typeof sp.department === "string" ? sp.department : "";
  const affiliation = typeof sp.affiliation === "string" && sp.affiliation in AFFILIATION_LABELS ? (sp.affiliation as Enums<"affiliation">) : undefined;
  const interest = typeof sp.interest === "string" ? sp.interest : "";
  const filtering = Boolean(q || department || affiliation || interest);
  const v = await requireViewer();

  const [{ data: people, error }, { data: follows }] = await Promise.all([
    v.supabase.rpc("search_people", {
      q: q || undefined,
      p_department: department || undefined,
      p_affiliation: affiliation,
      p_interest: interest || undefined,
      p_limit: filtering ? 60 : 200,
    }),
    v.supabase.from("follows").select("followee_id").eq("follower_id", v.userId),
  ]);
  const following = new Set((follows ?? []).map((f) => f.followee_id));
  const list = (people ?? []) as unknown as PersonCardData[];

  const me = { id: v.userId, department: v.profile.department, skills: v.profile.skills, interests: v.profile.interests, goals: v.profile.goals };
  const recommended = filtering
    ? []
    : list
        .map((p) => ({ p, r: recommend(me, { id: p.id, department: p.department, skills: p.skills, interests: p.interests, goals: [] }) }))
        .filter((x) => x.r.score > 0 && !following.has(x.p.id))
        .sort((a, b) => b.r.score - a.r.score)
        .slice(0, 6);
  const popularInterests = Object.entries(
    list.flatMap((p) => p.interests).reduce<Record<string, number>>((acc, t) => ((acc[t] = (acc[t] ?? 0) + 1), acc), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([t]) => t);

  return (
    <div>
      <PageHeader title="Discover people" description="Find classmates, mentors and collaborators across departments by interests, skills and goals." />

      <form className="mb-6 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_200px_170px_auto]" role="search" aria-label="Filter people">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="q" className="sr-only">Name, skill or interest</label>
          <input id="q" name="q" defaultValue={q} placeholder="Name, skill or interest…" className="h-9 w-full rounded-lg border border-input bg-input/30 pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <label className="sr-only" htmlFor="department">Department</label>
        <select id="department" name="department" defaultValue={department} className={selectClass}>
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="sr-only" htmlFor="affiliation">Affiliation</label>
        <select id="affiliation" name="affiliation" defaultValue={affiliation ?? ""} className={selectClass}>
          <option value="">Anyone</option>
          {Object.entries(AFFILIATION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <Button type="submit" className="h-9">Search</Button>
        {interest && <input type="hidden" name="interest" value={interest} />}
      </form>

      {popularInterests.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Browse by interest:</span>
          {popularInterests.map((t) => (
            <Link key={t} href={interest === t ? "/discover" : `/discover?interest=${encodeURIComponent(t)}`} aria-current={interest === t ? "true" : undefined}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${interest === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </Link>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mb-4 text-sm text-destructive">Search failed: {error.message}</p>}

      {!filtering && recommended.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold"><Sparkles className="size-4 text-primary" /> Suggested for you</h2>
          <p className="mb-3 text-xs text-muted-foreground">Based on shared interests and complementary skills from your profile — no AI, just transparent rules.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recommended.map(({ p, r }) => <PersonCard key={p.id} person={p} following={false} reasons={r.reasons} />)}
          </div>
        </section>
      )}
      {!filtering && recommended.length === 0 && v.profile.interests.length === 0 && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          Add interests and skills to your profile to get personalised suggestions.{" "}
          <Link href="/profile/edit" className="font-medium text-primary hover:underline">Edit profile</Link>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold">{filtering ? `${list.length} result${list.length === 1 ? "" : "s"}` : "Everyone on campus"}</h2>
        {list.length === 0 ? (
          <EmptyState icon={Compass} title="No one matches those filters" description="Try a broader search or another department." action={<Link href="/discover" className={buttonVariants({ variant: "outline" })}>Clear filters</Link>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => <PersonCard key={p.id} person={p} following={following.has(p.id)} />)}
          </div>
        )}
      </section>
    </div>
  );
}
