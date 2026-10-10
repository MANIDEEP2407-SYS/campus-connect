"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/common/action-button";
import { ToneBadge } from "@/components/common/tone-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { MessageButton } from "@/components/profile/message-button";
import { completeHandover, reviewClaim } from "@/lib/actions/lostfound";
import { CLAIM_STATUS_META } from "@/lib/lostfound";

interface Claim {
  id: string;
  claimant_id: string;
  details: string;
  status: keyof typeof CLAIM_STATUS_META;
  review_note: string | null;
  dispute_reason: string | null;
  created_at: string;
  claimant: { handle: string; full_name: string; avatar_url: string | null } | null;
}

/** Finder / moderator view of private ownership claims on a found item. */
export function ClaimReview({ itemId, claims, isModerator }: { itemId: string; claims: Claim[]; isModerator: boolean }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  void itemId;
  return (
    <section className="space-y-4 rounded-xl border border-primary/30 bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Lock className="size-3.5" /> Ownership claims ({claims.length})</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {isModerator ? "Moderator view." : "Compare each claim with your private verification details."} Approve only when you&apos;re confident — then arrange a safe handover.
        </p>
      </div>
      {claims.length === 0 && <p className="text-sm text-muted-foreground">No claims yet.</p>}
      <ul className="space-y-4">
        {claims.map((c) => {
          const meta = CLAIM_STATUS_META[c.status];
          return (
            <li key={c.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <UserAvatar name={c.claimant?.full_name ?? "Member"} src={c.claimant?.avatar_url} size="xs" />
                {c.claimant ? <Link href={`/profile/${c.claimant.handle}`} className="text-sm font-medium hover:underline">{c.claimant.full_name}</Link> : <span className="text-sm">Member</span>}
                <ToneBadge tone={meta.tone} className="ml-auto">{meta.label}</ToneBadge>
              </div>
              <p className="rounded-md bg-muted p-2 text-sm whitespace-pre-wrap">{c.details}</p>
              {c.dispute_reason && <p className="text-xs text-warning">Dispute: {c.dispute_reason}</p>}
              {c.review_note && <p className="text-xs text-muted-foreground">Note: {c.review_note}</p>}
              {(c.status === "pending" || c.status === "disputed") && (
                <>
                  <label htmlFor={`note-${c.id}`} className="sr-only">Note to claimant</label>
                  <Textarea id={`note-${c.id}`} rows={2} placeholder="Optional note to the claimant" value={notes[c.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))} />
                  <div className="flex gap-2">
                    <ActionButton action={reviewClaim} input={{ claimId: c.id, approve: true, note: notes[c.id] }} size="sm"
                      confirm={{ title: "Approve this claim?", description: "Other claims stay pending until the handover is confirmed. The claimant receives handover instructions.", confirmLabel: "Approve" }}>
                      Approve
                    </ActionButton>
                    <ActionButton action={reviewClaim} input={{ claimId: c.id, approve: false, note: notes[c.id] }} size="sm" variant="outline">Decline</ActionButton>
                  </div>
                </>
              )}
              {c.status === "approved" && (
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={completeHandover} input={{ claimId: c.id }} size="sm"
                    confirm={{ title: "Confirm the item was handed over?", description: "The listing will be marked as returned.", confirmLabel: "Mark returned" }}>
                    Mark as returned
                  </ActionButton>
                  {!isModerator && <MessageButton userId={c.claimant_id} label="Arrange handover" />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
