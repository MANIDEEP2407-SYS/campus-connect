import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, FileWarning, Plus } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { TimeAgo } from "@/components/common/time-ago";
import { buttonVariants } from "@/components/ui/button";
import { IncidentDisclaimer, IncidentStatusBadge } from "@/components/incidents/incident-badges";
import { CATEGORY_META, isStaffAffiliation, type IncidentCategory, type IncidentStatus } from "@/lib/incidents";

export const metadata: Metadata = { title: "Incident reports" };

export default async function IncidentsPage() {
  const v = await requireViewer();
  const { data: mine } = await v.supabase
    .from("incidents")
    .select("id, ref_code, title, category, subject_name, department, status, created_at")
    .eq("reporter_id", v.userId)
    .order("created_at", { ascending: false });
  const staff = isStaffAffiliation(v.profile.affiliation);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Incident reports"
        description={
          staff
            ? "Report an incident involving a student during classes, labs or official work — including a student taking your ideas or work to another teacher. Reports go confidentially to the student's department."
            : "Report an incident involving a teacher or staff member during classes, labs or official work, or report another student for plagiarism or stealing your work. Reports go confidentially to the department concerned."
        }
        actions={
          <>
            {v.isReviewer && <Link href="/incidents/review" className={buttonVariants({ variant: "outline" })}><ClipboardList /> Review desk</Link>}
            <Link href="/incidents/new" className={buttonVariants()}><Plus /> Report an incident</Link>
          </>
        }
      />

      <IncidentDisclaimer compact className="mb-6" />

      <h2 className="mb-3 text-sm font-semibold">Your reports</h2>
      {!mine?.length ? (
        <EmptyState icon={FileWarning} title="You haven't reported anything" description="Reports you submit and their outcomes appear here." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {mine.map((r) => (
            <li key={r.id}>
              <Link href={`/incidents/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{r.ref_code}</span> · {CATEGORY_META[r.category as IncidentCategory].label} · {r.subject_name} · {r.department}
                  </p>
                </div>
                <IncidentStatusBadge status={r.status as IncidentStatus} />
                <span className="text-xs text-muted-foreground"><TimeAgo date={r.created_at} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
