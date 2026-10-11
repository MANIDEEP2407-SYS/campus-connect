import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Flag, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { TimeAgo } from "@/components/common/time-ago";
import { selectClass } from "@/components/common/form-field";
import { ActionButton } from "@/components/common/action-button";
import { LiveRefresh } from "@/components/common/live-refresh";
import { Button } from "@/components/ui/button";
import { runPendingScans } from "@/lib/actions/shield";
import { moderationProviderStatus } from "@/lib/shield/service";
import { getAdminClient } from "@/lib/supabase/admin";
import { daysAgoIso } from "@/lib/time";
import { CATEGORY_LABELS, DECISION_LABELS, RISK_META, SHIELD_CATEGORIES, SHIELD_RISKS, type ShieldCategory, type ShieldDecision, type ShieldRisk } from "@/lib/shield/types";
import type { Enums } from "@/lib/database.types";

export const metadata: Metadata = { title: "CampusShield" };

const STATUS = { active: "Needs review", open: "Open", in_review: "In review", escalated: "Escalated", resolved: "Resolved", dismissed: "Dismissed", all: "All" } as const;
const TYPES = { post: "Posts", comment: "Comments", message: "Community messages", direct_message: "Reported DMs" } as const;

export default async function ShieldQueue({ searchParams }: PageProps<"/shield">) {
  const v = await requireViewer();
  if (!v.isModerator) redirect("/home");
  const sp = await searchParams;
  const pick = <T extends string>(val: unknown, allowed: readonly T[]) => (typeof val === "string" && (allowed as readonly string[]).includes(val) ? (val as T) : undefined);
  const status = pick(sp.status, Object.keys(STATUS) as (keyof typeof STATUS)[]) ?? "active";
  const risk = pick(sp.risk, SHIELD_RISKS);
  const category = pick(sp.category, SHIELD_CATEGORIES);
  const type = pick(sp.type, Object.keys(TYPES) as (keyof typeof TYPES)[]);
  const range = pick(sp.range, ["1", "7", "30"] as const);

  let q = v.supabase
    .from("moderation_cases")
    .select("id, content_type, category, risk_level, priority, source, report_count, review_status, decision, content_excerpt, model_provider, created_at, pattern_evidence")
    .order(status === "resolved" || status === "dismissed" ? "updated_at" : "priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (status === "active") q = q.in("review_status", ["open", "in_review", "escalated"]);
  else if (status !== "all") q = q.eq("review_status", status as Enums<"shield_case_status">);
  if (risk) q = q.eq("risk_level", risk);
  if (category) q = q.eq("category", category);
  if (type) q = q.eq("content_type", type);
  if (range) q = q.gte("created_at", daysAgoIso(Number(range)));

  const admin = getAdminClient();
  const [{ data: cases, error }, { data: active }, { count: openAppeals }, pending] = await Promise.all([
    q,
    v.supabase.from("moderation_cases").select("risk_level").in("review_status", ["open", "in_review", "escalated"]),
    v.supabase.from("moderation_appeals").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin ? admin.from("moderation_jobs").select("id", { count: "exact", head: true }).neq("status", "done") : Promise.resolve({ count: null }),
  ]);
  const provider = moderationProviderStatus();
  const countRisk = (r: ShieldRisk) => (active ?? []).filter((c) => c.risk_level === r).length;

  return (
    <div>
      <LiveRefresh table="moderation_cases" />
      <PageHeader
        title={<span className="flex items-center gap-2"><ShieldCheck className="size-6 text-primary" /> CampusShield</span>}
        description="AI-assisted queue of potentially harmful content. Model scores describe text, not people — review the context and record a decision."
        actions={<ActionButton action={runPendingScans} input={{}} variant="outline" size="sm"><Bot /> Process pending scans{pending.count ? ` (${pending.count})` : ""}</ActionButton>}
      />

      <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${provider.isMock ? "border-warning/40 bg-warning/10" : provider.configured ? "bg-card" : "border-destructive/40 bg-destructive/10"}`}>
        Moderation engine: <strong>{provider.configured ? provider.label : "Not configured"}</strong>
        {provider.isMock && " — scores come from a keyword heuristic for development. They are not AI classifications."}
        {!provider.configured && " — new content is queued but cannot be scanned. User reports still create cases."}
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Needs review", value: active?.length ?? 0 },
          { label: "Critical", value: countRisk("critical") },
          { label: "High priority", value: countRisk("high") },
          { label: "Open appeals", value: openAppeals ?? 0 },
          { label: "Unscanned items", value: pending.count ?? "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <form className="mb-4 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]" aria-label="Filter cases">
        <select name="status" defaultValue={status} className={selectClass} aria-label="Review status">
          {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select name="risk" defaultValue={risk ?? ""} className={selectClass} aria-label="Risk level">
          <option value="">Any risk</option>
          {SHIELD_RISKS.filter((r) => r !== "low").map((r) => <option key={r} value={r}>{RISK_META[r].label}</option>)}
        </select>
        <select name="category" defaultValue={category ?? ""} className={selectClass} aria-label="Category">
          <option value="">Any category</option>
          {SHIELD_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select name="type" defaultValue={type ?? ""} className={selectClass} aria-label="Content type">
          <option value="">Any content</option>
          {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select name="range" defaultValue={range ?? ""} className={selectClass} aria-label="Date">
          <option value="">Any time</option>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <Button type="submit" variant="secondary" className="h-9">Apply</Button>
      </form>

      {error && <p role="alert" className="mb-4 text-sm text-destructive">Could not load the queue: {error.message}</p>}
      {!cases?.length ? (
        <EmptyState icon={ShieldCheck} title="Queue is clear" description="No cases match these filters." />
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => {
            const r = RISK_META[c.risk_level as ShieldRisk];
            const repeated = c.category === "repeated_bullying";
            return (
              <li key={c.id}>
                <Link href={`/shield/${c.id}`} className={`block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 ${c.risk_level === "critical" ? "border-destructive/40" : ""}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ToneBadge tone={r.tone} dot>{r.label}</ToneBadge>
                    <ToneBadge tone={repeated ? "warning" : "neutral"}>{CATEGORY_LABELS[c.category as ShieldCategory]}</ToneBadge>
                    <ToneBadge>{TYPES[c.content_type as keyof typeof TYPES]}</ToneBadge>
                    {c.source !== "report" && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Bot className="size-3" /> {c.model_provider === "mock" ? "mock" : "AI"}</span>}
                    {c.report_count > 0 && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Flag className="size-3" /> {c.report_count} report{c.report_count > 1 ? "s" : ""}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{c.decision ? DECISION_LABELS[c.decision as ShieldDecision] : STATUS[c.review_status as keyof typeof STATUS]} · <TimeAgo date={c.created_at} /></span>
                  </div>
                  {c.content_excerpt && <p className="mt-2 line-clamp-2 text-sm">{c.content_excerpt}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
