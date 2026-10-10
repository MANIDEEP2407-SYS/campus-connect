import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarDays, FlaskConical, MessagesSquare, Search, User, Users } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

export const metadata: Metadata = { title: "Search" };

const KINDS = {
  person: { label: "People", icon: User },
  community: { label: "Communities", icon: MessagesSquare },
  club: { label: "Clubs", icon: Users },
  event: { label: "Events", icon: CalendarDays },
  project: { label: "Research & consultancy", icon: FlaskConical },
  resource: { label: "Academic resources", icon: BookOpen },
} as const;

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const v = await requireViewer();
  // Server-side search; each branch is filtered by the caller's RLS (SECURITY INVOKER).
  const { data, error } = q.length >= 2 ? await v.supabase.rpc("global_search", { q }) : { data: [], error: null };
  const groups = (Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => ({ kind: k, items: (data ?? []).filter((r) => r.kind === k) })).filter((g) => g.items.length);

  return (
    <div className="max-w-3xl">
      <PageHeader title={q ? `Results for “${q}”` : "Search"} description="People, communities, clubs, events, research and academic resources." />
      <form className="relative mb-6" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="sq" className="sr-only">Search</label>
        <input id="sq" name="q" defaultValue={q} autoFocus className="h-10 w-full rounded-lg border border-input bg-input/30 pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Search everything…" />
      </form>
      {error && <p role="alert" className="text-sm text-destructive">Search failed: {error.message}</p>}
      {q.length < 2 ? (
        <EmptyState icon={Search} title="Type at least 2 characters" />
      ) : !groups.length ? (
        <EmptyState icon={Search} title="No results" description="Try a different keyword, or browse Discover and Communities." />
      ) : (
        <div className="space-y-6">
          {groups.map(({ kind, items }) => {
            const { label, icon: Icon } = KINDS[kind];
            return (
              <section key={kind}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Icon className="size-4" /> {label}</h2>
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {items.map((r) => (
                    <li key={`${kind}-${r.id}`}>
                      <Link href={r.href} className="block px-4 py-3 hover:bg-muted/40">
                        <p className="text-sm font-medium">{r.title}</p>
                        {r.subtitle && <p className="text-xs text-muted-foreground capitalize">{r.subtitle}</p>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
