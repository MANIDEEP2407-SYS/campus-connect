"use client";

import Link from "next/link";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/common/action-button";
import { ToneBadge } from "@/components/common/tone-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { reviewApplication } from "@/lib/actions/research";
import { AFFILIATION_LABELS } from "@/lib/constants";

interface Application {
  id: string;
  statement: string;
  relevant_skills: string[];
  availability: string | null;
  status: "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
  reviewer_note: string | null;
  created_at: string;
  applicant: { handle: string; full_name: string; avatar_url: string | null; department: string | null; affiliation: keyof typeof AFFILIATION_LABELS } | null;
}

const TONE = { pending: "info", shortlisted: "warning", accepted: "success", rejected: "danger", withdrawn: "neutral" } as const;

export function ApplicantReview({ applications }: { applications: Application[] }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-1 font-semibold">Applicants ({applications.length})</h2>
      <p className="mb-4 text-xs text-muted-foreground">Applicants are notified when you shortlist, accept or reject them.</p>
      {!applications.length && <p className="text-sm text-muted-foreground">No applications yet.</p>}
      <ul className="space-y-4">
        {applications.map((a) => (
          <li key={a.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <UserAvatar name={a.applicant?.full_name ?? "Applicant"} src={a.applicant?.avatar_url} size="sm" />
              <div className="min-w-0">
                {a.applicant ? <Link href={`/profile/${a.applicant.handle}`} className="text-sm font-medium hover:underline">{a.applicant.full_name}</Link> : <span className="text-sm">Applicant</span>}
                <p className="text-xs text-muted-foreground">{a.applicant && AFFILIATION_LABELS[a.applicant.affiliation]}{a.applicant?.department && ` · ${a.applicant.department}`}</p>
              </div>
              <ToneBadge tone={TONE[a.status]} className="ml-auto capitalize">{a.status}</ToneBadge>
            </div>
            <p className="text-sm whitespace-pre-wrap">{a.statement}</p>
            {a.relevant_skills.length > 0 && (
              <ul className="flex flex-wrap gap-1">{a.relevant_skills.map((s) => <li key={s} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{s}</li>)}</ul>
            )}
            {a.availability && <p className="text-xs text-muted-foreground">Availability: {a.availability}</p>}
            {a.reviewer_note && <p className="text-xs text-muted-foreground">Your note: {a.reviewer_note}</p>}
            {["pending", "shortlisted"].includes(a.status) && (
              <>
                <label htmlFor={`rn-${a.id}`} className="sr-only">Note to applicant</label>
                <Textarea id={`rn-${a.id}`} rows={2} placeholder="Optional note to the applicant" value={notes[a.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  {a.status === "pending" && <ActionButton action={reviewApplication} input={{ applicationId: a.id, status: "shortlisted", note: notes[a.id] }} size="sm" variant="secondary">Shortlist</ActionButton>}
                  <ActionButton action={reviewApplication} input={{ applicationId: a.id, status: "accepted", note: notes[a.id] }} size="sm">Accept</ActionButton>
                  <ActionButton action={reviewApplication} input={{ applicationId: a.id, status: "rejected", note: notes[a.id] }} size="sm" variant="outline">Reject</ActionButton>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
