import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Bot, Lock, Scale, ShieldCheck, UserRoundCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { TimeAgo, formatDateTime } from "@/components/common/time-ago";
import { UserAvatar } from "@/components/common/user-avatar";
import { ActionButton } from "@/components/common/action-button";
import { AppealForm } from "@/components/shield/appeal-form";
import { setBlock } from "@/lib/actions/shield";
import { moderationProviderStatus } from "@/lib/shield/service";
import { CATEGORY_LABELS, DECISION_LABELS, type ShieldCategory, type ShieldDecision } from "@/lib/shield/types";

export const metadata: Metadata = { title: "Safety & moderation" };

export default async function SafetyPage() {
  const v = await requireViewer();
  const [{ data: notices }, { data: restrictions }, { data: blocks }] = await Promise.all([
    v.supabase.from("my_moderation_notices").select("*").order("created_at", { ascending: false }).limit(50),
    v.supabase.from("user_restrictions").select("id, reason, starts_at, ends_at, lifted_at").eq("user_id", v.userId).order("created_at", { ascending: false }),
    v.supabase.from("user_blocks").select("blocked_id, kind, profile:profiles!user_blocks_blocked_id_fkey(handle, full_name, avatar_url)").eq("blocker_id", v.userId),
  ]);
  const provider = moderationProviderStatus();
  const activeRestriction = (restrictions ?? []).find((r) => !r.lifted_at && new Date(r.ends_at) > new Date());

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Safety & moderation" description="How CampusShield helps keep CampusConnect respectful — and the decisions that affect your content." />

      {activeRestriction && (
        <section role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Your posting is temporarily restricted until {formatDateTime(activeRestriction.ends_at)}.</p>
          <p className="mt-1 text-muted-foreground">Reason: {activeRestriction.reason}</p>
        </section>
      )}

      <section className="space-y-4 rounded-xl border bg-card p-5 text-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="size-4 text-primary" /> About CampusShield (AI-assisted moderation)</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex gap-3"><Bot className="mt-0.5 size-4 shrink-0 text-foreground" />
            <span><strong className="text-foreground">What is checked:</strong> public posts, comments and messages in communities are checked automatically by an AI moderation model for harassment, threats, hate, sexual harassment, exposure of personal information and other harmful content. Drafts may get a gentle suggestion before you post.</span></li>
          <li className="flex gap-3"><Lock className="mt-0.5 size-4 shrink-0 text-foreground" />
            <span><strong className="text-foreground">Private messages are not scanned.</strong> A single direct message is shared with moderators only if a participant reports it.</span></li>
          <li className="flex gap-3"><UserRoundCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
            <span><strong className="text-foreground">People decide, not the AI.</strong> The model only produces scores about the text. Flagged items go to trained moderators, who look at context (quotes, jokes, academic discussion, local language) before acting. Content is only hidden automatically in critical cases, and only until a moderator reviews it.</span></li>
          <li className="flex gap-3"><Scale className="mt-0.5 size-4 shrink-0 text-foreground" />
            <span><strong className="text-foreground">Fairness:</strong> there are no public scores, rankings or labels about people. You are told about decisions on your content and can request a review. Reporters&apos; identities are never shared with the author.</span></li>
          <li className="flex gap-3"><Ban className="mt-0.5 size-4 shrink-0 text-foreground" />
            <span><strong className="text-foreground">Data handling:</strong> only the text is sent to the moderation provider, with phone numbers, emails and ID numbers replaced first. No names, account details or tokens are sent. Routine scan results are deleted after 90 days; closed-case excerpts are cleared after a year.</span></li>
        </ul>
        <p className="rounded-lg bg-muted px-3 py-2 text-xs">
          Current moderation engine: <strong className="text-foreground">{provider.configured ? provider.label : "not configured — content is queued but not scanned"}</strong>
          {provider.isMock && " · development mock, not real AI"}
        </p>
        <p className="text-xs text-muted-foreground">If someone is in immediate danger, contact campus security or emergency services directly — CampusShield is not an emergency service.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Decisions about your content</h2>
        {!notices?.length ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nothing here — no moderation decisions affect your content.</p>
        ) : (
          notices.map((n) => (
            <article key={n.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <ToneBadge>{(n.content_type ?? "").replace("_", " ")}</ToneBadge>
                {n.decision ? (
                  <ToneBadge tone={n.decision === "warning" || n.decision === "edit_requested" ? "warning" : "danger"}>{DECISION_LABELS[n.decision as ShieldDecision]}</ToneBadge>
                ) : (
                  <ToneBadge tone="info">Pending review</ToneBadge>
                )}
                {n.category && n.category !== "none" && <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[n.category as ShieldCategory]}</span>}
                <TimeAgo date={(n.reviewed_at ?? n.created_at)!} className="ml-auto text-xs text-muted-foreground" />
              </div>
              {n.content_excerpt && <blockquote className="border-l-2 pl-3 text-muted-foreground">{n.content_excerpt}</blockquote>}
              {n.decision ? (
                <p><span className="font-medium">Moderator&apos;s explanation:</span> {n.decision_reason}</p>
              ) : (
                <p className="text-muted-foreground">This is temporarily hidden from others while a moderator reviews it. No decision has been made yet.</p>
              )}
              {n.appeal_status ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs">
                  Review request: <strong>{n.appeal_status === "open" ? "pending" : n.appeal_status === "overturned" ? "accepted — action reversed" : "decision upheld"}</strong>
                  {n.appeal_resolution && ` — ${n.appeal_resolution}`}
                </p>
              ) : n.decision ? (
                <AppealForm caseId={n.id!} />
              ) : null}
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Blocked & muted</h2>
        {!blocks?.length ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t blocked or muted anyone. Use the ⋯ menu on a profile.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {blocks.map((b) => (
              <li key={b.blocked_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <UserAvatar name={b.profile?.full_name ?? "Member"} src={b.profile?.avatar_url} size="xs" />
                <Link href={`/profile/${b.profile?.handle}`} className="hover:underline">{b.profile?.full_name ?? "Member"}</Link>
                <ToneBadge>{b.kind === "block" ? "Blocked" : "Muted"}</ToneBadge>
                <ActionButton action={setBlock} input={{ userId: b.blocked_id, kind: null }} size="sm" variant="ghost" className="ml-auto">
                  {b.kind === "block" ? "Unblock" : "Unmute"}
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
