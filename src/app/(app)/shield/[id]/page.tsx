import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bot, Clock, Flag, Lock } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { TimeAgo, formatDateTime } from "@/components/common/time-ago";
import { ActionButton } from "@/components/common/action-button";
import { DecisionPanel } from "@/components/shield/decision-panel";
import { AppealResolver } from "@/components/shield/appeal-resolver";
import { liftRestriction, markCaseInReview } from "@/lib/actions/shield";
import { CATEGORY_LABELS, DECISION_LABELS, RISK_META, REPORT_CATEGORIES, type ShieldCategory, type ShieldDecision, type ShieldRisk } from "@/lib/shield/types";

export const metadata: Metadata = { title: "CampusShield case" };

const EVENT_LABELS: Record<string, string> = {
  ai_flagged: "Flagged by the moderation model",
  ai_rescanned: "Re-scanned by the moderation model",
  report_linked: "User report linked",
  content_held: "Content withheld pending review (critical)",
  review_started: "Review started",
  internal_note: "Internal note",
  decision: "Decision recorded",
  appeal_submitted: "Author requested a review",
  appeal_resolved: "Appeal resolved",
};

export default async function ShieldCase({ params }: PageProps<"/shield/[id]">) {
  const { id } = await params;
  const v = await requireViewer();
  if (!v.isModerator) redirect("/home");

  const { data: c } = await v.supabase
    .from("moderation_cases")
    .select("*, author:profiles!moderation_cases_content_author_id_fkey(handle, full_name), target:profiles!moderation_cases_target_user_id_fkey(handle, full_name), reviewer:profiles!moderation_cases_reviewed_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const ctx = (c.context ?? {}) as { post_id?: string; post_excerpt?: string; server_id?: string; channel_id?: string; club_id?: string };
  const [{ data: reports }, { data: events }, { data: scans }, { data: appeal }, { data: restrictions }, current, thread] = await Promise.all([
    v.supabase.from("moderation_reports").select("id, category, reason, created_at").eq("case_id", id).order("created_at"),
    v.supabase.from("moderation_events").select("id, event_type, details, created_at, actor:profiles!moderation_events_actor_id_fkey(full_name)").eq("case_id", id).order("created_at"),
    v.supabase.from("moderation_scans").select("id, provider, model, status, error, created_at").eq("content_type", c.content_type).eq("content_id", c.content_id).order("created_at", { ascending: false }).limit(5),
    v.supabase.from("moderation_appeals").select("*").eq("case_id", id).maybeSingle(),
    v.supabase.from("user_restrictions").select("id, ends_at, lifted_at, reason").eq("case_id", id),
    c.content_type === "post" ? v.supabase.from("posts").select("body, shield_state").eq("id", c.content_id).maybeSingle()
      : c.content_type === "comment" ? v.supabase.from("comments").select("body, shield_state").eq("id", c.content_id).maybeSingle()
      : c.content_type === "message" ? v.supabase.from("messages").select("body, shield_state").eq("id", c.content_id).maybeSingle()
      : Promise.resolve({ data: null }),
    c.content_type === "message" && ctx.channel_id
      ? v.supabase.from("messages").select("id, body, created_at, author:profiles!messages_author_id_fkey(full_name)").eq("channel_id", ctx.channel_id).lte("created_at", c.created_at).order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: null }),
  ]);
  const scores = (c.model_scores ?? {}) as Record<string, number>;
  const evidence = (c.pattern_evidence ?? {}) as Record<string, unknown>;
  const risk = RISK_META[c.risk_level as ShieldRisk];
  const closed = c.review_status === "resolved" || c.review_status === "dismissed";
  const reportLabel = (v: string | null) => REPORT_CATEGORIES.find((r) => r.value === v)?.label ?? "Unspecified";
  const contentState = (current.data as { shield_state?: string } | null)?.shield_state;

  return (
    <div>
      <PageHeader
        back={{ href: "/shield", label: "CampusShield queue" }}
        eyebrow={
          <>
            <ToneBadge tone={risk.tone} dot>{risk.label}</ToneBadge>
            <ToneBadge>{c.content_type.replace("_", " ")}</ToneBadge>
            <ToneBadge>{c.review_status.replace("_", " ")}</ToneBadge>
            {contentState && contentState !== "visible" && <ToneBadge tone="warning">Content {contentState}</ToneBadge>}
          </>
        }
        title={CATEGORY_LABELS[c.category as ShieldCategory]}
        description={`Opened ${formatDateTime(c.created_at)} · source: ${c.source.replace("+", " + ")}`}
        actions={c.review_status === "open" ? <ActionButton action={markCaseInReview} input={{ caseId: id }} variant="outline" size="sm">Start review</ActionButton> : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold">Content</h2>
            <p className="text-xs text-muted-foreground">
              By {c.author ? <Link href={`/profile/${c.author.handle}`} className="text-foreground hover:underline">{c.author.full_name}</Link> : "unknown"}
              {c.target && <> · directed at / replying to <Link href={`/profile/${c.target.handle}`} className="text-foreground hover:underline">{c.target.full_name}</Link></>}
            </p>
            <blockquote className="mt-3 rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
              {(current.data as { body?: string } | null)?.body ?? c.content_excerpt ?? "Content no longer available."}
            </blockquote>
            {c.content_type === "direct_message" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3" /> Private message shared by a participant&apos;s report. The rest of the conversation is not visible to moderators.</p>
            )}
            {ctx.post_excerpt && (
              <div className="mt-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Comment on post:</p>
                <p className="border-l-2 pl-2">{ctx.post_excerpt}</p>
              </div>
            )}
            {thread.data && thread.data.length > 1 && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium">Channel context (preceding messages)</p>
                <ol className="space-y-1 text-xs text-muted-foreground">
                  {thread.data.slice().reverse().map((m) => (
                    <li key={m.id} className={m.id === c.content_id ? "text-foreground" : ""}><strong>{m.author?.full_name ?? "Member"}:</strong> {m.body}</li>
                  ))}
                </ol>
              </div>
            )}
            {ctx.channel_id && ctx.server_id && <Link href={`/communities/${ctx.server_id}/${ctx.channel_id}`} className="mt-3 inline-block text-xs text-primary hover:underline">Open channel</Link>}
            {c.content_type === "post" && <Link href={`/home#post-${c.content_id}`} className="mt-3 inline-block text-xs text-primary hover:underline">Open in feed</Link>}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Bot className="size-4" /> Model output <span className="font-normal text-muted-foreground">— automated, not a finding</span></h2>
            {c.model_provider === "mock" && <p className="mb-2 rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">Development mock: keyword heuristic, not an AI classification.</p>}
            {Object.keys(scores).length ? (
              <>
                <ul className="mt-2 space-y-1.5">
                  {Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([k, s]) => (
                    <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
                      <span>{CATEGORY_LABELS[k as ShieldCategory] ?? k}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full bg-primary" style={{ width: `${Math.round(s * 100)}%` }} /></span>
                        {s.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">{c.model_explanation}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No model scores yet{scans?.[0]?.status === "error" ? ` — last scan failed (${scans[0].error})` : " (user report only, scan pending)"}.</p>
            )}
            {Object.keys(evidence).length > 0 && (
              <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
                <p className="mb-1 font-medium">Repeated-targeting context (confidential)</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li>Prior actioned cases, same author → same person (90 days): {String(evidence.prior_actioned_cases_same_target ?? 0)}</li>
                  <li>Other open cases, same author → same person: {String(evidence.other_open_cases_same_target ?? 0)}</li>
                  <li>Prior actioned cases for this author (180 days): {String(evidence.prior_actioned_cases_author ?? 0)}</li>
                </ul>
                <p className="mt-1 text-muted-foreground">Based only on earlier moderator decisions and open cases — not on this message alone.</p>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Flag className="size-4" /> User reports ({reports?.length ?? 0})</h2>
            {!reports?.length ? <p className="text-sm text-muted-foreground">No user reports — flagged by the model.</p> : (
              <ul className="space-y-2 text-sm">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-lg bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">{reportLabel(r.category)} · <TimeAgo date={r.created_at} /> · reporter identity hidden</p>
                    <p className="mt-1">{r.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" /> Case history</h2>
            <ol className="space-y-2 border-l pl-4 text-sm">
              {(events ?? []).map((e) => {
                const d = (e.details ?? {}) as Record<string, unknown>;
                return (
                  <li key={e.id}>
                    <p>{EVENT_LABELS[e.event_type] ?? e.event_type}{e.event_type === "decision" && d.decision ? `: ${DECISION_LABELS[d.decision as ShieldDecision]}` : ""}</p>
                    {typeof d.note === "string" && <p className="text-xs text-muted-foreground">“{d.note}”</p>}
                    <p className="text-xs text-muted-foreground">{e.actor?.full_name ?? "System"} · <TimeAgo date={e.created_at} /></p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {closed ? (
            <section className="rounded-xl border bg-card p-5 text-sm">
              <h2 className="mb-2 font-semibold">Outcome</h2>
              <p><ToneBadge tone="primary">{DECISION_LABELS[c.decision as ShieldDecision]}</ToneBadge></p>
              {c.decision_reason && <p className="mt-2 text-muted-foreground">“{c.decision_reason}”</p>}
              <p className="mt-2 text-xs text-muted-foreground">By {c.reviewer?.full_name ?? "a moderator"} · {c.reviewed_at && formatDateTime(c.reviewed_at)}</p>
            </section>
          ) : (
            <DecisionPanel caseId={id} hasAuthor={Boolean(c.content_author_id)} contentType={c.content_type} />
          )}
          {appeal && <AppealResolver appeal={appeal} reviewedByMe={c.reviewed_by === v.userId} />}
          {(restrictions ?? []).map((r) => (
            <section key={r.id} className="rounded-xl border border-destructive/30 bg-card p-5 text-sm">
              <p className="font-medium">Posting restriction</p>
              <p className="text-xs text-muted-foreground">{r.lifted_at ? "Lifted" : `Until ${formatDateTime(r.ends_at)}`}</p>
              {!r.lifted_at && <ActionButton action={liftRestriction} input={{ id: r.id }} size="sm" variant="outline" className="mt-2" confirm={{ title: "Lift this restriction now?", confirmLabel: "Lift" }}>Lift restriction</ActionButton>}
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
