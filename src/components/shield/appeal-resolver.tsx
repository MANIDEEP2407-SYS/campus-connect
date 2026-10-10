"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/common/action-button";
import { ToneBadge } from "@/components/common/tone-badge";
import { resolveAppeal } from "@/lib/actions/shield";

export function AppealResolver({ appeal, reviewedByMe }: {
  appeal: { id: string; statement: string; status: string; resolution: string | null };
  reviewedByMe: boolean;
}) {
  const [resolution, setResolution] = useState("");
  return (
    <section className="space-y-3 rounded-xl border border-info/30 bg-card p-5 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Appeal</h2>
        <ToneBadge tone={appeal.status === "open" ? "info" : appeal.status === "overturned" ? "success" : "neutral"}>{appeal.status}</ToneBadge>
      </div>
      <blockquote className="border-l-2 pl-3 text-muted-foreground">{appeal.statement}</blockquote>
      {appeal.status === "open" ? (
        <>
          {reviewedByMe && <p className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">You made the original decision — ask another moderator to review this appeal if possible.</p>}
          <label htmlFor="appeal-resolution" className="text-xs font-medium">Outcome explanation (shown to the author)</label>
          <Textarea id="appeal-resolution" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={1000} />
          <div className="flex flex-wrap gap-2">
            <ActionButton action={resolveAppeal} input={{ appealId: appeal.id, overturn: true, resolution }} size="sm" disabled={resolution.trim().length < 10}
              confirm={{ title: "Overturn the decision?", description: "Content is restored and any restriction from this case is lifted.", confirmLabel: "Overturn" }}>
              Overturn
            </ActionButton>
            <ActionButton action={resolveAppeal} input={{ appealId: appeal.id, overturn: false, resolution }} size="sm" variant="outline" disabled={resolution.trim().length < 10}>
              Uphold decision
            </ActionButton>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{appeal.resolution}</p>
      )}
    </section>
  );
}
