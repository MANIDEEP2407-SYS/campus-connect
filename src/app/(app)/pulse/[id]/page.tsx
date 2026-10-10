import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MapPin, ShieldAlert, Siren, ThumbsUp } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionButton } from "@/components/common/action-button";
import { FlagButton } from "@/components/common/flag-button";
import { TimeAgo, formatDateTime } from "@/components/common/time-ago";
import { CampusMap } from "@/components/pulse/campus-map";
import { CategoryLabel, PulseStatusBadge, SeverityBadge } from "@/components/pulse/pulse-badges";
import { ResponderPanel } from "@/components/pulse/responder-panel";
import { confirmPulseReport } from "@/lib/actions/pulse";
import { SAFETY_NOTICE, SEVERITY_META, STATUS_META, isTerminal, type PulseCategory, type PulseSeverity, type PulseStatus } from "@/lib/pulse";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Report" };

export default async function PulseReportPage({ params }: PageProps<"/pulse/[id]">) {
  const { id } = await params;
  const v = await requireViewer();
  const { data: r } = await v.supabase.from("pulse_feed").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const status = r.status as PulseStatus;
  const privileged = v.isResponder || Boolean(r.is_mine);

  const [{ data: timeline }, raw, loc, atts, responders] = await Promise.all([
    v.supabase.from("pulse_timeline").select("*").eq("report_id", id).order("created_at"),
    v.isResponder ? v.supabase.from("reports").select("assigned_to, reporter:profiles!reports_reporter_id_fkey(full_name, handle), assignee:profiles!reports_assigned_to_fkey(full_name)").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    privileged ? v.supabase.from("report_locations").select("lat, lng").eq("report_id", id).maybeSingle() : Promise.resolve({ data: null }),
    privileged ? v.supabase.from("report_attachments").select("id, storage_path, purpose").eq("report_id", id) : Promise.resolve({ data: null }),
    v.isResponder ? v.supabase.rpc("list_responders") : Promise.resolve({ data: null }),
  ]);
  const attachments = atts.data ?? [];
  const { data: signed } = attachments.length
    ? await v.supabase.storage.from("pulse-evidence").createSignedUrls(attachments.map((a) => a.storage_path), 900)
    : { data: [] };

  const lat = loc.data?.lat ?? (r.approx_lat !== null ? Number(r.approx_lat) : null);
  const lng = loc.data?.lng ?? (r.approx_lng !== null ? Number(r.approx_lng) : null);
  const severity = r.severity as PulseSeverity;

  return (
    <div>
      <PageHeader
        back={{ href: v.isResponder ? "/pulse/responder" : "/pulse", label: v.isResponder ? "Responder desk" : "CampusPulse" }}
        eyebrow={
          <>
            <span className="font-mono text-xs text-muted-foreground">{r.ref_code}</span>
            <PulseStatusBadge status={status} />
            <SeverityBadge severity={severity} />
            {r.is_demo && <ToneBadge>Fictional demo report</ToneBadge>}
          </>
        }
        title={r.title}
        description={<CategoryLabel category={r.category as PulseCategory} subcategory={r.subcategory} />}
      />

      {r.is_safety && !isTerminal(status) && status !== "resolved" && (
        <div role="note" className="mb-6 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <p>{SAFETY_NOTICE}</p>
        </div>
      )}
      {r.alert_message && (
        <div className="mb-6 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <Siren className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Campus alert: {r.alert_message}</p>
            {r.expires_at && <p className="text-xs text-muted-foreground">Active until {formatDateTime(r.expires_at)}</p>}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <p className="text-sm whitespace-pre-wrap">{r.description}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Reported</dt><dd><TimeAgo date={r.created_at!} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Location</dt><dd className="flex items-center gap-1"><MapPin className="size-3.5" />{r.location_label}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Confirmations</dt><dd className="flex items-center gap-1"><ThumbsUp className="size-3.5" />{r.confirmations_count}</dd></div>
            </dl>
            {r.resolution_note && (
              <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm"><span className="font-medium text-success">Resolution: </span>{r.resolution_note}</div>
            )}
            {r.closed_reason && (
              <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <span className="font-medium">{status === "rejected" ? "Rejected" : "Closed"}: </span>{r.closed_reason}
                {r.duplicate_of && <> — <Link href={`/pulse/${r.duplicate_of}`} className="text-primary hover:underline">view original</Link></>}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {!r.is_mine && !isTerminal(status) && status !== "resolved" && !r.confirmed_by_me && (
                <ActionButton action={confirmPulseReport} input={{ reportId: id }} variant="secondary" size="sm"><ThumbsUp /> I see this too</ActionButton>
              )}
              {r.confirmed_by_me && <ToneBadge tone="primary" className="h-7 px-2.5">You confirmed this</ToneBadge>}
              {!r.is_mine && <FlagButton targetType="pulse_report" targetId={id} label="Report misuse" />}
            </div>
          </section>

          {lat !== null && lng !== null && (
            <section>
              <CampusMap points={[{ id, lat, lng, color: SEVERITY_META[severity].color, label: r.title!, pulse: Boolean(r.is_active_warning) }]} height={260} zoom={17} />
              <p className="mt-2 text-xs text-muted-foreground">
                {loc.data ? (v.isResponder ? "Exact reported position (visible to responders and the reporter)." : "Exact position — only you and responders can see this.") : "Approximate position (rounded to ~100 m)."}
              </p>
            </section>
          )}

          {privileged && attachments.length > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock className="size-3.5" /> Photos (private to reporter & responders)</h2>
              <div className="flex flex-wrap gap-3">
                {attachments.map((a, i) =>
                  signed?.[i]?.signedUrl ? (
                    <a key={a.id} href={signed[i].signedUrl} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signed[i].signedUrl} alt={a.purpose === "resolution" ? "Resolution evidence" : "Report evidence"} className="size-28 rounded-lg object-cover ring-1 ring-border" />
                      <span className="mt-1 block text-[11px] text-muted-foreground capitalize">{a.purpose}</span>
                    </a>
                  ) : null,
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Status history</h2>
            <ol className="relative space-y-4 border-l pl-5">
              {(timeline ?? []).map((u) => (
                <li key={u.id} className="relative">
                  <span className={cn("absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card", u.is_internal ? "bg-warning" : u.kind === "alert" ? "bg-destructive" : "bg-primary")} aria-hidden />
                  <p className="text-sm">
                    {u.kind === "status" || u.kind === "assignment" ? (
                      <>Status → <strong>{STATUS_META[u.to_status as PulseStatus]?.label}</strong></>
                    ) : u.kind === "alert" ? (
                      <strong className="text-destructive">Campus alert issued</strong>
                    ) : u.kind === "confirmation" ? (
                      <>Confirmed by another person</>
                    ) : (
                      <strong>{u.is_internal ? "Internal note" : "Update"}</strong>
                    )}
                    {u.is_internal && <ToneBadge tone="warning" className="ml-2">Internal</ToneBadge>}
                  </p>
                  {u.note && u.kind !== "confirmation" && <p className="mt-0.5 text-sm text-muted-foreground">{u.note}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">{u.actor_label} · <TimeAgo date={u.created_at!} /></p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {v.isResponder ? (
            <ResponderPanel
              reportId={id}
              status={status}
              isSafety={Boolean(r.is_safety)}
              hasActiveAlert={Boolean(r.alert_message)}
              userId={v.userId}
              responders={responders.data ?? []}
              assignee={raw.data?.assignee?.full_name ?? null}
              reporter={raw.data?.reporter ? { name: raw.data.reporter.full_name, handle: raw.data.reporter.handle } : null}
            />
          ) : (
            <section className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">What happens next?</p>
              <p>Authorised campus responders verify reports, assign a team and record the resolution. {r.is_mine ? "You'll be notified at each step." : "Confirm the issue if you're affected — it helps prioritise."}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
