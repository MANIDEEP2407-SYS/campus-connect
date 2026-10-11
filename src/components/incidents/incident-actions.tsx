"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ClipboardList, LoaderCircle, MessageSquarePlus, StickyNote, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/common/form-field";
import { addIncidentNote, transitionIncident, withdrawIncident } from "@/lib/actions/incidents";
import { STATUS_META, TRANSITIONS, requiresNote, type IncidentStatus } from "@/lib/incidents";

type Result = { ok: boolean; error?: string; message?: string };

function useRunner(close: () => void) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      close();
    });
  return { pending, run };
}

const OUTCOME_HELP: Partial<Record<IncidentStatus, string>> = {
  action_taken: "Summarise the action taken. The reporter sees this note.",
  unsubstantiated: "Explain that the allegation could not be proven. This is not a finding that it was false, and the reporter is not penalised.",
  false_report: "Only use this when the investigation established the allegation was knowingly false or malicious. Record the basis; the reporter may face disciplinary action under university rules.",
};

/** Reviewer controls: change status, record outcomes and add notes. */
export function ReviewPanel({ id, status, reporter }: { id: string; status: IncidentStatus; reporter: { name: string; handle: string } | null }) {
  const [dialog, setDialog] = useState<{ kind: "transition"; to: IncidentStatus } | { kind: "note" } | null>(null);
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(true);
  const { pending, run } = useRunner(() => setDialog(null));
  const next = TRANSITIONS[status];

  const open = (d: NonNullable<typeof dialog>) => {
    setNote("");
    setDialog(d);
  };
  const move = (to: IncidentStatus) => (requiresNote(to) ? open({ kind: "transition", to }) : run(() => transitionIncident({ id, to })));

  return (
    <section className="space-y-4 rounded-xl border border-primary/30 bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4 text-primary" /> Department review</h2>
        <p className="mt-1 text-xs text-muted-foreground">All actions are audited. Status changes notify the reporter. Keep the reporter&apos;s identity confidential.</p>
      </div>
      <dl className="text-sm">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Reporter</dt><dd>{reporter ? <Link href={`/profile/${reporter.handle}`} className="hover:underline">{reporter.name}</Link> : "—"}</dd></div>
      </dl>

      {next.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Move to</p>
          <div className="flex flex-wrap gap-2">
            {next.map((to) => (
              <Button key={to} size="sm" variant={to === "false_report" ? "destructive" : to === "action_taken" ? "default" : "secondary"} disabled={pending} onClick={() => move(to)}>
                {STATUS_META[to].label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This report is closed ({STATUS_META[status].label.toLowerCase()}).</p>
      )}

      <div className="border-t pt-4">
        <Button size="sm" variant="outline" onClick={() => open({ kind: "note" })}><StickyNote /> Add note</Button>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog?.kind === "transition" && (
            <>
              <DialogHeader>
                <DialogTitle>Close as “{STATUS_META[dialog.to].label}”</DialogTitle>
                <DialogDescription>{OUTCOME_HELP[dialog.to]}</DialogDescription>
              </DialogHeader>
              <FormField label="Outcome" htmlFor="t-note">
                <Textarea id="t-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              </FormField>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                <Button variant={dialog.to === "false_report" ? "destructive" : "default"} disabled={pending || note.trim().length === 0}
                  onClick={() => run(() => transitionIncident({ id, to: dialog.to, note }))}>
                  {pending && <LoaderCircle className="animate-spin" />} Confirm
                </Button>
              </DialogFooter>
            </>
          )}
          {dialog?.kind === "note" && (
            <>
              <DialogHeader>
                <DialogTitle>Add a note</DialogTitle>
                <DialogDescription>Internal notes are visible to reviewers only. Unticked, the note is sent to the reporter.</DialogDescription>
              </DialogHeader>
              <Textarea aria-label="Note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-[var(--primary)]" /> Internal (reviewers only)
              </label>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                <Button disabled={pending || !note.trim()} onClick={() => run(() => addIncidentNote({ id, note, internal }))}>{pending && <LoaderCircle className="animate-spin" />} Save note</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Reporter controls while the report is open: add information, or withdraw before review starts. */
export function ReporterActions({ id, status }: { id: string; status: IncidentStatus }) {
  const [dialog, setDialog] = useState<"info" | "withdraw" | null>(null);
  const [text, setText] = useState("");
  const { pending, run } = useRunner(() => setDialog(null));
  const open = (d: "info" | "withdraw") => {
    setText("");
    setDialog(d);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => open("info")}><MessageSquarePlus /> Add information</Button>
      {status === "submitted" && <Button size="sm" variant="ghost" onClick={() => open("withdraw")}><Undo2 /> Withdraw</Button>}
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "withdraw" ? "Withdraw this report?" : "Add information"}</DialogTitle>
            <DialogDescription>
              {dialog === "withdraw" ? "The department will stop reviewing it. You can only withdraw before review starts." : "Further details or corrections are added to your report for the reviewers."}
            </DialogDescription>
          </DialogHeader>
          <Textarea aria-label={dialog === "withdraw" ? "Reason" : "Information"} rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={dialog === "withdraw" ? 500 : 2000} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant={dialog === "withdraw" ? "destructive" : "default"} disabled={pending || text.trim().length < 3}
              onClick={() => run(() => (dialog === "withdraw" ? withdrawIncident({ id, reason: text }) : addIncidentNote({ id, note: text, internal: false })))}>
              {pending && <LoaderCircle className="animate-spin" />} {dialog === "withdraw" ? "Withdraw" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
