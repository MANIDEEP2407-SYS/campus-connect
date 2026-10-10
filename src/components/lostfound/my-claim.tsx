"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/common/action-button";
import { ToneBadge } from "@/components/common/tone-badge";
import { disputeClaim, withdrawClaim } from "@/lib/actions/lostfound";
import { CLAIM_STATUS_META } from "@/lib/lostfound";

export function MyClaim({ claim, sensitive }: { claim: { id: string; status: keyof typeof CLAIM_STATUS_META; details: string; review_note: string | null }; sensitive: boolean }) {
  const [reason, setReason] = useState("");
  const meta = CLAIM_STATUS_META[claim.status];
  return (
    <section className="space-y-3 rounded-xl border border-primary/30 bg-card p-5 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Your claim</h2>
        <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
      </div>
      <p className="rounded-md bg-muted p-2 whitespace-pre-wrap text-muted-foreground">{claim.details}</p>
      {claim.review_note && <p className="text-xs">Finder&apos;s note: {claim.review_note}</p>}
      {claim.status === "approved" && (
        <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs">
          {sensitive
            ? "Collect the item from the campus security office with your student ID."
            : "Arrange a handover in a busy, public campus location (e.g. the library entrance) using in-app messages."}
        </p>
      )}
      {["pending", "approved", "disputed"].includes(claim.status) && (
        <ActionButton action={withdrawClaim} input={{ claimId: claim.id }} variant="outline" size="sm" confirm={{ title: "Withdraw your claim?", confirmLabel: "Withdraw" }}>
          Withdraw claim
        </ActionButton>
      )}
      {claim.status === "rejected" && (
        <div className="space-y-2">
          <label htmlFor="dispute" className="text-xs font-medium">Believe this is a mistake? Ask a moderator to review.</label>
          <Textarea id="dispute" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          <ActionButton action={disputeClaim} input={{ claimId: claim.id, reason }} size="sm" disabled={reason.trim().length < 10}>Dispute decision</ActionButton>
        </div>
      )}
    </section>
  );
}
