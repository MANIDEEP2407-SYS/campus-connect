import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { TimeAgo, formatDate } from "@/components/common/time-ago";
import { IncidentDisclaimer, IncidentStatusBadge } from "@/components/incidents/incident-badges";
import { ReporterActions, ReviewPanel } from "@/components/incidents/incident-actions";
import { CATEGORY_META, DIRECTION_META, STATUS_META, isOpen, type IncidentCategory, type IncidentDirection, type IncidentStatus } from "@/lib/incidents";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Incident report" };

export default async function IncidentPage({ params }: PageProps<"/incidents/[id]">) {
  const { id } = await params;
  const v = await requireViewer();
  // RLS: only the reporter and reviewers for the department can read the report.
  const { data: r } = await v.supabase
    .from("incidents")
    .select("*, reporter:profiles!incidents_reporter_id_fkey(full_name, handle)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const isMine = r.reporter_id === v.userId;
  const status = r.status as IncidentStatus;

  const [{ data: timeline }, { data: attachments }] = await Promise.all([
    v.supabase.from("incident_timeline").select("*").eq("incident_id", id).order("created_at"),
    v.supabase.from("incident_attachments").select("id, storage_path").eq("incident_id", id),
  ]);
  const { data: signed } = attachments?.length
    ? await v.supabase.storage.from("incident-evidence").createSignedUrls(attachments.map((a) => a.storage_path), 900)
    : { data: [] };

  const outcomeTone = status === "action_taken" ? "border-success/30 bg-success/10" : status === "false_report" ? "border-destructive/30 bg-destructive/10" : "bg-muted";

  return (
    <div>
      <PageHeader
        back={isMine ? { href: "/incidents", label: "Incident reports" } : { href: "/incidents/review", label: "Review desk" }}
        eyebrow={
          <>
            <span className="font-mono text-xs text-muted-foreground">{r.ref_code}</span>
            <IncidentStatusBadge status={status} />
            <ToneBadge>{DIRECTION_META[r.direction as IncidentDirection].label}</ToneBadge>
            {r.is_demo && <ToneBadge>Fictional demo report</ToneBadge>}
          </>
        }
        title={r.title}
        description={CATEGORY_META[r.category as IncidentCategory].label}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">{DIRECTION_META[r.direction as IncidentDirection].subject}</dt><dd className="font-medium">{r.subject_name}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Department</dt><dd>{r.department}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Date of incident</dt><dd>{formatDate(r.occurred_on)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Reported</dt><dd><TimeAgo date={r.created_at} /></dd></div>
              {r.location && <div><dt className="text-xs text-muted-foreground">Location</dt><dd>{r.location}</dd></div>}
              {r.context && <div><dt className="text-xs text-muted-foreground">Course / activity</dt><dd>{r.context}</dd></div>}
            </dl>
            <p className="text-sm whitespace-pre-wrap">{r.description}</p>
            {r.witnesses && <p className="mt-4 text-sm"><span className="text-muted-foreground">Witnesses: </span>{r.witnesses}</p>}
            {r.outcome_note && !isOpen(status) && (
              <div className={cn("mt-4 rounded-lg border p-3 text-sm", outcomeTone)}>
                <span className="font-medium">{STATUS_META[status].label}: </span>{r.outcome_note}
              </div>
            )}
          </section>

          {(attachments?.length ?? 0) > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock className="size-3.5" /> Evidence (private to reporter & reviewers)</h2>
              <div className="flex flex-wrap gap-3">
                {attachments!.map((a, i) =>
                  signed?.[i]?.signedUrl ? (
                    <a key={a.id} href={signed[i].signedUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signed[i].signedUrl} alt="Evidence attached to the report" className="size-28 rounded-lg object-cover ring-1 ring-border" />
                    </a>
                  ) : null,
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">History</h2>
            <ol className="relative space-y-4 border-l pl-5">
              {(timeline ?? []).map((u) => (
                <li key={u.id} className="relative">
                  <span className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card", u.is_internal ? "bg-warning" : "bg-primary")} aria-hidden />
                  <p className="text-sm">
                    {u.kind === "status" ? <>Status → <strong>{STATUS_META[u.to_status as IncidentStatus]?.label}</strong></> : <strong>{u.is_internal ? "Internal note" : "Message"}</strong>}
                    {u.is_internal && <ToneBadge tone="warning" className="ml-2">Internal</ToneBadge>}
                  </p>
                  {u.note && <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted-foreground">{u.note}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">{u.actor_label} · <TimeAgo date={u.created_at!} /></p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {isMine ? (
            <>
              <section className="space-y-3 rounded-xl border bg-card p-5 text-sm">
                <p className="font-medium">What happens next?</p>
                <p className="text-muted-foreground">
                  Reviewers for {r.department} assess the report and may contact you for a statement. You&apos;ll be notified when the status changes.
                </p>
                {isOpen(status) && <ReporterActions id={id} status={status} />}
              </section>
              <IncidentDisclaimer compact />
            </>
          ) : (
            <ReviewPanel id={id} status={status} reporter={r.reporter ? { name: r.reporter.full_name, handle: r.reporter.handle } : null} />
          )}
        </aside>
      </div>
    </div>
  );
}
