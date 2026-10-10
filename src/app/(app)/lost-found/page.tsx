import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Search } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { selectClass } from "@/components/common/form-field";
import { formatDate } from "@/components/common/time-ago";
import { Button, buttonVariants } from "@/components/ui/button";
import { LF_CATEGORIES, LF_CATEGORY_META, LF_STATUS_META, type LfCategory } from "@/lib/lostfound";
import { CAMPUS_LOCATIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Lost & Found" };

export default async function LostFoundPage({ searchParams }: PageProps<"/lost-found">) {
  const sp = await searchParams;
  const kind = sp.kind === "lost" || sp.kind === "found" ? sp.kind : undefined;
  const category = typeof sp.category === "string" && (LF_CATEGORIES as readonly string[]).includes(sp.category) ? (sp.category as LfCategory) : undefined;
  const status = sp.status === "all" ? "all" : sp.status === "returned" ? "returned" : "open";
  const location = typeof sp.location === "string" ? sp.location.replace(/[%,()]/g, "").slice(0, 60) : "";
  const since = typeof sp.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.since) ? sp.since : "";
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%,()]/g, "").slice(0, 60) : "";
  const mine = sp.mine === "1";
  const v = await requireViewer();

  let query = v.supabase
    .from("lost_found_items")
    .select("id, kind, category, title, description, location_label, occurred_on, status, is_sensitive, is_demo, owner_id, created_at")
    .order("created_at", { ascending: false })
    .limit(90);
  if (kind) query = query.eq("kind", kind);
  if (category) query = query.eq("category", category);
  if (status === "open") query = query.in("status", ["open", "claimed"]);
  else if (status === "returned") query = query.eq("status", "returned");
  else query = query.neq("status", "removed");
  if (location) query = query.ilike("location_label", `%${location}%`);
  if (since) query = query.gte("occurred_on", since);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (mine) query = query.eq("owner_id", v.userId);
  const { data: items, error } = await query;

  const tab = (label: string, k?: string) => (
    <Link href={k ? `/lost-found?kind=${k}` : "/lost-found"} aria-current={kind === k ? "page" : undefined}
      className={cn("rounded-md px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground", kind === k && "bg-muted font-medium text-foreground")}>
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="Lost & Found"
        description="Post lost or found belongings. Matches are suggested automatically; ownership is verified privately before any handover."
        actions={
          <>
            <Link href="/lost-found/new?kind=found" className={buttonVariants({ variant: "outline" })}>I found something</Link>
            <Link href="/lost-found/new?kind=lost" className={buttonVariants()}>I lost something</Link>
          </>
        }
      />
      <nav aria-label="Listing type" className="mb-4 inline-flex rounded-lg border bg-card p-1">
        {tab("All")}
        {tab("Lost", "lost")}
        {tab("Found", "found")}
      </nav>

      <form className="mb-6 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr_auto]" aria-label="Filter listings">
        {kind && <input type="hidden" name="kind" value={kind} />}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="lf-q" className="sr-only">Search</label>
          <input id="lf-q" name="q" defaultValue={q} placeholder="e.g. blue water bottle" className="h-9 w-full rounded-lg border border-input bg-input/30 pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <label htmlFor="lf-cat" className="sr-only">Category</label>
        <select id="lf-cat" name="category" defaultValue={category ?? ""} className={selectClass}>
          <option value="">All categories</option>
          {LF_CATEGORIES.map((c) => <option key={c} value={c}>{LF_CATEGORY_META[c].emoji} {LF_CATEGORY_META[c].label}</option>)}
        </select>
        <label htmlFor="lf-loc" className="sr-only">Location</label>
        <input id="lf-loc" name="location" list="lf-locs" defaultValue={location} placeholder="Any location" className={selectClass} />
        <datalist id="lf-locs">{CAMPUS_LOCATIONS.map((l) => <option key={l.label} value={l.label} />)}</datalist>
        <label htmlFor="lf-status" className="sr-only">Status</label>
        <select id="lf-status" name="status" defaultValue={status} className={selectClass}>
          <option value="open">Open</option>
          <option value="returned">Returned</option>
          <option value="all">All</option>
        </select>
        <label htmlFor="lf-since" className="sr-only">Since date</label>
        <input id="lf-since" type="date" name="since" defaultValue={since} className={selectClass} aria-label="Since" />
        <Button type="submit" variant="secondary" className="h-9">Filter</Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2 lg:col-span-6">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="accent-[var(--primary)]" /> Only my listings
        </label>
      </form>

      {error && <p role="alert" className="mb-4 text-sm text-destructive">Could not load listings: {error.message}</p>}

      {!items?.length ? (
        <EmptyState icon={PackageSearch} title="No listings match" description="Try other filters — or post what you lost or found." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => {
            const meta = LF_CATEGORY_META[i.category as LfCategory];
            const st = LF_STATUS_META[i.status as keyof typeof LF_STATUS_META];
            return (
              <li key={i.id}>
                <Link href={`/lost-found/${i.id}`} className="flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-xl" aria-hidden>{meta.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        <ToneBadge tone={i.kind === "lost" ? "warning" : "info"}>{i.kind === "lost" ? "Lost" : "Found"}</ToneBadge>
                        <ToneBadge tone={st.tone}>{st.label}</ToneBadge>
                        {i.is_sensitive && <ToneBadge tone="danger">Sensitive item</ToneBadge>}
                      </div>
                      <p className="mt-1.5 truncate font-medium">{i.title}</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{i.description}</p>
                  <p className="mt-auto pt-3 text-xs text-muted-foreground">
                    📍 {i.location_label} · {formatDate(i.occurred_on)}
                    {i.owner_id === v.userId && <span className="ml-1 text-primary">· Yours</span>}
                    {i.is_demo && <span> · Fictional demo</span>}
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
