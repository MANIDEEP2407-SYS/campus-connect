"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormField } from "@/components/common/form-field";
import { addCaseNote, decideCase } from "@/lib/actions/shield";
import { DECISION_LABELS, type ShieldDecision } from "@/lib/shield/types";

const OPTIONS: { value: ShieldDecision; hint: string; consequential: boolean }[] = [
  { value: "dismissed_false_positive", hint: "The model or report was wrong. Content is restored if it was held.", consequential: false },
  { value: "no_action", hint: "Reviewed; within guidelines.", consequential: false },
  { value: "warning", hint: "Content stays; the author is warned with your explanation.", consequential: true },
  { value: "edit_requested", hint: "Ask the author to edit or remove it themselves.", consequential: true },
  { value: "removed", hint: "Hide the content from everyone (kept for appeal and audit).", consequential: true },
  { value: "restricted", hint: "Remove the content and temporarily block posting (1–30 days).", consequential: true },
  { value: "escalated", hint: "Serious threat or safety risk — alert administrators for the institutional process.", consequential: true },
];

export function DecisionPanel({ caseId, hasAuthor, contentType }: { caseId: string; hasAuthor: boolean; contentType: string }) {
  const [decision, setDecision] = useState<ShieldDecision>("dismissed_false_positive");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(3);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();
  const opt = OPTIONS.find((o) => o.value === decision)!;
  const needsReason = opt.consequential;
  // DMs are never hidden by CampusShield (participants can block), so "removed" doesn't apply to them.
  const allowed = OPTIONS.filter((o) => (o.value !== "restricted" || hasAuthor) && !(contentType === "direct_message" && o.value === "removed"));

  const submit = () =>
    start(async () => {
      const res = await decideCase({ caseId, decision, reason, internalNote: note, restrictDays: decision === "restricted" ? days : undefined });
      setConfirmOpen(false);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  return (
    <section className="space-y-4 rounded-xl border border-primary/30 bg-card p-5">
      <div>
        <h2 className="font-semibold">Record a decision</h2>
        <p className="mt-1 text-xs text-muted-foreground">You decide — the model only suggests. Every decision is audited and the author can request a review.</p>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="sr-only">Decision</legend>
        {allowed.map((o) => (
          <label key={o.value} className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 ${decision === o.value ? "border-primary bg-primary/5" : ""}`}>
            <input type="radio" name="decision" value={o.value} checked={decision === o.value} onChange={() => setDecision(o.value)} className="mt-0.5 accent-[var(--primary)]" />
            <span>
              <span className="block font-medium">{DECISION_LABELS[o.value]}</span>
              <span className="text-xs text-muted-foreground">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {decision === "restricted" && (
        <FormField label="Restriction length (days)" htmlFor="restrict-days">
          <Input id="restrict-days" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </FormField>
      )}
      <FormField label={needsReason ? "Explanation for the author (required)" : "Explanation for the author (optional)"} htmlFor="decision-reason"
        hint="Shown to the author. Explain the guideline — don't reveal who reported it.">
        <Textarea id="decision-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      <FormField label="Internal note (moderators only)" htmlFor="decision-note">
        <Textarea id="decision-note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || (needsReason && reason.trim().length < 10)} onClick={() => (opt.consequential ? setConfirmOpen(true) : submit())}>
          {pending && <LoaderCircle className="animate-spin" />} Record decision
        </Button>
        <Button variant="outline" disabled={pending || note.trim().length < 2}
          onClick={() => start(async () => {
            const res = await addCaseNote({ caseId, note });
            if (res.ok) { toast.success(res.message); setNote(""); } else toast.error(res.error);
          })}>
          Save note only
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm: {DECISION_LABELS[decision]}</AlertDialogTitle>
            <AlertDialogDescription>
              {opt.hint} The author will be notified with your explanation and can appeal.
              {decision === "restricted" && ` Posting will be blocked for ${days} day(s).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant={decision === "escalated" ? "default" : "destructive"} onClick={submit} disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />} Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
