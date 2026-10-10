import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Siren, ThumbsUp } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { TimeAgo } from "@/components/common/time-ago";
import { selectClass } from "@/components/common/form-field";
import { CampusMap, type MapPoint } from "@/components/pulse/campus-map";
import { CategoryLabel, PulseStatusBadge, SeverityBadge } from "@/components/pulse/pulse-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { daysAgoIso } from "@/lib/time";
import { CATEGORY_META, PULSE_CATEGORIES, PULSE_SEVERITIES, PULSE_STATUSES, SAFETY_NOTICE, SEVERITY_META, STATUS_META, type PulseCategory, type PulseSeverity, type PulseStatus } from "@/lib/pulse";

export const metadata: Metadata = { title: "CampusPulse" };

const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;

export default async function PulsePage({ searchParams }: PageProps<"/pulse">) {
  const sp = await searchParams;
  const pick = <T extends string>(val: unknown, allowed: readonly T[]) => (typeof val === "string" && (allowed as readonly string[]).includes(val) ? (val as T) : undefined);
  const category = pick(sp.category, PULSE_CATEGORIES);
  const status = pick(sp.status, [...PULSE_STATUSES, "active"] as const);
  const severity = pick(sp.severity, PULSE_SEVERITIES);
  const range = pick(sp.range, ["24h", "7d", "30d"] as const);
  const mine = sp.mine === "1";
  const v = await requireViewer();

  let q = v.supabase.from("pulse_feed").select("*").order("created_at", { ascending: false }).limit(150);
  if (category) q = q.eq("category", category);
  if (status === "active") q = q.in("status", ["submitted", "under_review", "verified", "assigned", "in_progress"]);
  else if (status) q = q.eq("status", status);
  if (severity) q = q.eq("severity", severity);
  if (range) q = q.gte("created_at", daysAgoIso(RANGES[range]));
  if (mine) q = q.eq("is_mine", true);
  const { data: reports, error } = await q;
  const list = reports ?? [];
  const warnings = list.filter((r) => r.is_active_warning && r.status !== "submitted" && r.status !== "under_review");

  const points: MapPoint[] = list
    .filter((r) => r.approx_lat !== null && r.approx_lng !== null)
    .map((r) => ({
      id: r.id!,
      lat: Number(r.approx_lat),
      lng: Number(r.approx_lng),
      color: r.status === "resolved" || r.status === "closed" || r.status === "rejected" ? "#64748b" : SEVERITY_META[r.severity as PulseSeverity].color,
      label: `${CATEGORY_META[r.category as PulseCategory].emoji} ${r.title}`,
      sublabel: `${STATUS_META[r.status as PulseStatus].label} · near ${r.location_label}`,
      href: `/pulse/${r.id}`,
      pulse: Boolean(r.is_active_warning),
    }));

  return (
    <div>
      <PageHeader
        title="CampusPulse"
        description="Report and track campus utility, infrastructure and safety issues. Locations are approximate; reporter identities are never shown publicly."
        actions={
          <>
            {v.isResponder && <Link href="/pulse/responder" className={buttonVariants({ variant: "outline" })}><ClipboardList /> Responder desk</Link>}
            <Link href="/pulse/new" className={buttonVariants()}><Siren /> Report an issue</Link>
          </>
        }
      />

      {warnings.length > 0 && (
        <section className="mb-6 space-y-2" aria-label="Active safety warnings">
          {warnings.map((w) => (
            <Link key={w.id} href={`/pulse/${w.id}`} className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 hover:bg-destructive/15">
              <Siren className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">{w.alert_message ?? `${CATEGORY_META[w.category as PulseCategory].label}: ${w.title}`}</p>
                <p className="text-xs text-muted-foreground">Near {w.location_label} (approx.) · {SAFETY_NOTICE.split(".")[0]}.</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      <form className="mb-4 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]" aria-label="Filter reports">
        <label className="sr-only" htmlFor="pf-cat">Category</label>
        <select id="pf-cat" name="category" defaultValue={category ?? ""} className={selectClass}>
          <option value="">All categories</option>
          {PULSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].emoji} {CATEGORY_META[c].label}</option>)}
        </select>
        <label className="sr-only" htmlFor="pf-status">Status</label>
        <select id="pf-status" name="status" defaultValue={status ?? ""} className={selectClass}>
          <option value="">Any status</option>
          <option value="active">Active (not resolved)</option>
          {PULSE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <label className="sr-only" htmlFor="pf-sev">Severity</label>
        <select id="pf-sev" name="severity" defaultValue={severity ?? ""} className={selectClass}>
          <option value="">Any severity</option>
          {PULSE_SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
        </select>
        <label className="sr-only" htmlFor="pf-range">Date</label>
        <select id="pf-range" name="range" defaultValue={range ?? ""} className={selectClass}>
          <option value="">Any time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm whitespace-nowrap">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="accent-[var(--primary)]" /> My reports
        </label>
        <Button type="submit" variant="secondary" className="h-9">Apply</Button>
      </form>

      {error && <p role="alert" className="mb-4 text-sm text-destructive">Could not load reports: {error.message}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-20 xl:self-start">
          <CampusMap points={points} height={460} />
          <p className="mt-2 text-xs text-muted-foreground">
            Markers show approximate positions (~100 m). Colour = severity; grey = closed. Public view includes verified reports and your own submissions.
          </p>
        </div>
        <section aria-label="Reports">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{list.length} report{list.length === 1 ? "" : "s"}</h2>
          {!list.length ? (
            <EmptyState icon={Siren} title="No reports match these filters" description="All clear — or try widening the filters." />
          ) : (
            <ul className="space-y-2">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={`/pulse/${r.id}`} className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground">{r.ref_code}</span>
                      <PulseStatusBadge status={r.status as PulseStatus} />
                      <SeverityBadge severity={r.severity as PulseSeverity} />
                      {r.is_mine && <span className="text-[11px] text-primary">Your report</span>}
                      {r.is_demo && <span className="text-[11px] text-muted-foreground">· Fictional demo</span>}
                    </div>
                    <p className="mt-2 font-medium">{r.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <CategoryLabel category={r.category as PulseCategory} subcategory={r.subcategory} />
                      <span className="text-xs text-muted-foreground">📍 {r.location_label}</span>
                      <TimeAgo date={r.created_at!} className="text-xs text-muted-foreground" />
                      {(r.confirmations_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><ThumbsUp className="size-3" /> {r.confirmations_count}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
