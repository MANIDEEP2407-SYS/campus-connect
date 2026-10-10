import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Search, Users } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { selectClass } from "@/components/common/form-field";
import { ClubTabs } from "@/components/clubs/club-tabs";
import { ClubFormDialog } from "@/components/clubs/club-form-dialog";
import { Button } from "@/components/ui/button";
import { CLUB_CATEGORIES } from "@/lib/constants";

export const metadata: Metadata = { title: "Clubs" };

export default async function ClubsPage({ searchParams }: PageProps<"/clubs">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%,()]/g, "").slice(0, 60) : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const official = sp.official === "1";
  const v = await requireViewer();

  let query = v.supabase.from("clubs").select("id, slug, name, tagline, category, logo, is_official, membership_policy, club_members(count), events(count)").order("is_official", { ascending: false }).order("name");
  if (q) query = query.or(`name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%`);
  if (category) query = query.eq("category", category);
  if (official) query = query.eq("is_official", true);
  const [{ data: clubs }, { data: mine }] = await Promise.all([
    query,
    v.supabase.from("club_members").select("club_id, status").eq("user_id", v.userId),
  ]);
  const status = new Map((mine ?? []).map((m) => [m.club_id, m.status]));

  return (
    <div>
      <PageHeader
        title="Clubs & Events"
        description="Explore student organisations across campus. Verified official clubs carry a badge; others are student-created."
        actions={<ClubFormDialog />}
      />
      <ClubTabs active="clubs" />
      <form className="mb-6 flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="club-q" className="sr-only">Search clubs</label>
          <input id="club-q" name="q" defaultValue={q} placeholder="Search clubs…" className="h-9 w-full rounded-lg border border-input bg-input/30 pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <label htmlFor="club-cat" className="sr-only">Category</label>
        <select id="club-cat" name="category" defaultValue={category} className={`${selectClass} sm:w-44`}>
          <option value="">All categories</option>
          {CLUB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
          <input type="checkbox" name="official" value="1" defaultChecked={official} className="accent-[var(--primary)]" /> Official only
        </label>
        <Button type="submit" variant="secondary" className="h-9">Filter</Button>
      </form>

      {!clubs?.length ? (
        <EmptyState icon={Users} title="No clubs match" description="Try another category or start a new student club." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {clubs.map((c) => {
            const st = status.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/clubs/${c.slug}`} className="flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-2xl" aria-hidden>{c.logo}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {c.is_official ? <ToneBadge tone="primary"><BadgeCheck className="size-3" /> Official</ToneBadge> : <ToneBadge>Student-created</ToneBadge>}
                        <ToneBadge>{c.category}</ToneBadge>
                      </div>
                    </div>
                  </div>
                  {c.tagline && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{c.tagline}</p>}
                  <div className="mt-auto flex items-center gap-4 pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="size-3.5" /> {c.club_members[0]?.count ?? 0}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> {c.events[0]?.count ?? 0} events</span>
                    {st === "approved" && <span className="ml-auto text-primary">Member</span>}
                    {st === "pending" && <span className="ml-auto">Request pending</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
