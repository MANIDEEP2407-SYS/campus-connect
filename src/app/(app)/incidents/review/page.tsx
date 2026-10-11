import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { TimeAgo } from "@/components/common/time-ago";
import { LiveRefresh } from "@/components/common/live-refresh";
import { IncidentStatusBadge } from "@/components/incidents/incident-badges";
import { CATEGORY_META, DIRECTION_META, type IncidentCategory, type IncidentDirection, type IncidentStatus } from "@/lib/incidents";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Incident review desk" };

const QUEUES = {
  open: { label: "Open", statuses: ["submitted", "under_review"] },
  closed: { label: "Closed", statuses: ["action_taken", "unsubstantiated", "false_report", "withdrawn"] },
} as const;

export default async function ReviewDesk({ searchParams }: PageProps<"/incidents/review">) {
  const v = await requireViewer();
  if (!v.isReviewer) redirect("/incidents");
  const sp = await searchParams;
  const queue = (typeof sp.q === "string" && sp.q in QUEUES ? sp.q : "open") as keyof typeof QUEUES;

  // RLS limits rows to the reviewer's department (Administration reviewers and admins see all).
  const { data: rows } = await v.supabase
    .from("incidents")
    .select("id, ref_code, title, category, direction, subject_name, department, status, created_at, reporter_id")
    .in("status", [...QUEUES[queue].statuses])
    .neq("reporter_id", v.userId)
    .order("created_at", { ascending: queue === "open" })
    .limit(200);
  const scope = v.isAdmin || v.profile.department === "Administration" ? "all departments" : (v.profile.department ?? "your department");

  return (
    <div>
      <LiveRefresh table="incidents" />
      <PageHeader
        back={{ href: "/incidents", label: "Incident reports" }}
        title="Incident review desk"
        description={`Confidential reports for ${scope}. Review each fairly, record the outcome, and only mark a report false when the investigation establishes it.`}
      />

      <nav aria-label="Queues" className="mb-4 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {(Object.keys(QUEUES) as (keyof typeof QUEUES)[]).map((k) => (
          <Link key={k} href={`/incidents/review?q=${k}`} aria-current={queue === k ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground", queue === k && "bg-muted font-medium text-foreground")}>
            {QUEUES[k].label}
          </Link>
        ))}
      </nav>

      {!rows?.length ? (
        <EmptyState icon={ClipboardList} title="Queue is empty" description="No reports need attention here right now." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Report</th>
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 font-medium">Department</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className={cn("hover:bg-muted/40", r.category === "sexual_harassment" || r.category === "threat_or_violence" ? "bg-destructive/5" : "")}>
                  <td className="px-4 py-3">
                    <Link href={`/incidents/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">{r.ref_code}</span> · {CATEGORY_META[r.category as IncidentCategory].label} · {r.subject_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{DIRECTION_META[r.direction as IncidentDirection].label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.department}</td>
                  <td className="px-4 py-3"><IncidentStatusBadge status={r.status as IncidentStatus} /></td>
                  <td className="px-4 py-3 text-muted-foreground"><TimeAgo date={r.created_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
