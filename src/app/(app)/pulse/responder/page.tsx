import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, ThumbsUp } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { TimeAgo } from "@/components/common/time-ago";
import { ActionButton } from "@/components/common/action-button";
import { CategoryLabel, PulseStatusBadge, SeverityBadge } from "@/components/pulse/pulse-badges";
import { LiveRefresh } from "@/components/pulse/live-refresh";
import { runMaintenance } from "@/lib/actions/admin";
import { STATUS_META, type PulseCategory, type PulseSeverity, type PulseStatus } from "@/lib/pulse";
import { cn } from "@/lib/utils";
import { daysAgoIso } from "@/lib/time";

export const metadata: Metadata = { title: "Responder desk" };

const QUEUES = {
  triage: { label: "Needs triage", statuses: ["submitted", "under_review"] },
  active: { label: "Active", statuses: ["verified", "assigned", "in_progress"] },
  mine: { label: "Assigned to me", statuses: ["assigned", "in_progress"] },
  done: { label: "Resolved & closed", statuses: ["resolved", "rejected", "closed"] },
} as const;

export default async function ResponderDesk({ searchParams }: PageProps<"/pulse/responder">) {
  const v = await requireViewer();
  if (!v.isResponder) redirect("/pulse");
  const sp = await searchParams;
  const queue = (typeof sp.q === "string" && sp.q in QUEUES ? sp.q : "triage") as keyof typeof QUEUES;

  let q = v.supabase
    .from("reports")
    .select("id, ref_code, title, category, subcategory, severity, status, priority, location_label, confirmations_count, created_at, updated_at, is_safety, assigned_to, assignee:profiles!reports_assigned_to_fkey(full_name)")
    .in("status", [...QUEUES[queue].statuses])
    .order(queue === "done" ? "updated_at" : "priority", { ascending: false })
    .order("created_at", { ascending: queue === "done" ? false : true })
    .limit(100);
  if (queue === "mine") q = q.eq("assigned_to", v.userId);

  const [{ data: reports }, { data: all }] = await Promise.all([
    q,
    v.supabase.from("reports").select("status, created_at, updated_at").gte("created_at", daysAgoIso(30)),
  ]);
  const counts = (all ?? []).reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
  const resolved = (all ?? []).filter((r) => r.status === "resolved");
  const avgHours = resolved.length ? Math.round(resolved.reduce((s, r) => s + (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()), 0) / resolved.length / 36e5) : null;

  return (
    <div>
      <LiveRefresh table="reports" />
      <PageHeader
        back={{ href: "/pulse", label: "CampusPulse" }}
        title="Responder desk"
        description="Verify, assign and resolve campus reports. Sorted by priority (severity, safety category and confirmations)."
        actions={<ActionButton action={runMaintenance} input={{}} variant="outline" size="sm">Expire stale warnings</ActionButton>}
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Awaiting triage", value: (counts.submitted ?? 0) + (counts.under_review ?? 0) },
          { label: "In progress", value: (counts.verified ?? 0) + (counts.assigned ?? 0) + (counts.in_progress ?? 0) },
          { label: "Resolved (30 days)", value: counts.resolved ?? 0 },
          { label: "Avg. time to resolve", value: avgHours === null ? "—" : `${avgHours} h` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Queues" className="mb-4 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {(Object.keys(QUEUES) as (keyof typeof QUEUES)[]).map((k) => (
          <Link key={k} href={`/pulse/responder?q=${k}`} aria-current={queue === k ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground", queue === k && "bg-muted font-medium text-foreground")}>
            {QUEUES[k].label}
          </Link>
        ))}
      </nav>

      {!reports?.length ? (
        <EmptyState icon={ClipboardList} title="Queue is empty" description="Nothing needs attention here right now." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Report</th>
                <th scope="col" className="px-4 py-3 font-medium">Severity</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Assignee</th>
                <th scope="col" className="px-4 py-3 font-medium">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map((r) => (
                <tr key={r.id} className={cn("hover:bg-muted/40", r.is_safety && !["resolved", "rejected", "closed"].includes(r.status) && "bg-destructive/5")}>
                  <td className="px-4 py-3">
                    <Link href={`/pulse/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-mono">{r.ref_code}</span>
                      <CategoryLabel category={r.category as PulseCategory} />
                      <span>📍 {r.location_label}</span>
                      {r.confirmations_count > 0 && <span className="flex items-center gap-0.5"><ThumbsUp className="size-3" />{r.confirmations_count}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={r.severity as PulseSeverity} /></td>
                  <td className="px-4 py-3"><PulseStatusBadge status={r.status as PulseStatus} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.assignee?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground"><TimeAgo date={r.created_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Statuses: {Object.values(STATUS_META).map((s) => s.label).join(" → ")}. Illegal transitions are rejected by the database.</p>
    </div>
  );
}
