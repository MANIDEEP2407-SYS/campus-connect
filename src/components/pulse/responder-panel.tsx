"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ClipboardList, LoaderCircle, Megaphone, Merge, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, selectClass } from "@/components/common/form-field";
import { ImageUpload } from "@/components/common/image-upload";
import { addPulseNote, issuePulseAlert, markPulseDuplicate, transitionPulseReport } from "@/lib/actions/pulse";
import { STATUS_META, TRANSITIONS, transitionRequirements, type PulseStatus } from "@/lib/pulse";

type Dialogs = { kind: "transition"; to: PulseStatus } | { kind: "note" } | { kind: "alert" } | { kind: "duplicate" } | null;

export function ResponderPanel({
  reportId,
  status,
  isSafety,
  hasActiveAlert,
  userId,
  responders,
  assignee,
  reporter,
}: {
  reportId: string;
  status: PulseStatus;
  isSafety: boolean;
  hasActiveAlert: boolean;
  userId: string;
  responders: { id: string; full_name: string }[];
  assignee: string | null;
  reporter: { name: string; handle: string } | null;
}) {
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState(responders.find((r) => r.id === userId)?.id ?? responders[0]?.id ?? "");
  const [internal, setInternal] = useState(true);
  const [hours, setHours] = useState(6);
  const [ofRef, setOfRef] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const next = TRANSITIONS[status];

  const open = (d: Dialogs) => {
    setNote("");
    setPhotos([]);
    setDialog(d);
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setDialog(null);
    });

  const quick = (to: PulseStatus) => {
    const req = transitionRequirements(to);
    if (req.note || req.assignee) return open({ kind: "transition", to });
    run(() => transitionPulseReport({ reportId, to }));
  };

  return (
    <section className="space-y-4 rounded-xl border border-primary/30 bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4 text-primary" /> Responder actions</h2>
        <p className="mt-1 text-xs text-muted-foreground">All actions are audited. Status changes notify the reporter.</p>
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Reporter</dt><dd>{reporter ? <Link href={`/profile/${reporter.handle}`} className="hover:underline">{reporter.name}</Link> : "—"}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Assigned to</dt><dd>{assignee ?? "Unassigned"}</dd></div>
      </dl>

      {next.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Move to</p>
          <div className="flex flex-wrap gap-2">
            {next.map((to) => (
              <Button key={to} size="sm" variant={to === "rejected" || to === "closed" ? "outline" : to === "resolved" ? "default" : "secondary"} disabled={pending} onClick={() => quick(to)}>
                {STATUS_META[to].label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This report is {STATUS_META[status].label.toLowerCase()} — no further transitions.</p>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button size="sm" variant="outline" onClick={() => open({ kind: "note" })}><StickyNote /> Add note</Button>
        {isSafety && ["verified", "assigned", "in_progress"].includes(status) && !hasActiveAlert && (
          <Button size="sm" variant="destructive" onClick={() => { open({ kind: "alert" }); setNote("Avoid the area near "); }}><Megaphone /> Issue campus alert</Button>
        )}
        {!["resolved", "rejected", "closed"].includes(status) && (
          <Button size="sm" variant="ghost" onClick={() => open({ kind: "duplicate" })}><Merge /> Mark duplicate</Button>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog?.kind === "transition" && (
            <>
              <DialogHeader>
                <DialogTitle>Move to “{STATUS_META[dialog.to].label}”</DialogTitle>
                <DialogDescription>
                  {dialog.to === "resolved" ? "Describe what was done. The reporter and confirmers are notified." : dialog.to === "assigned" ? "Choose who will handle this." : "A reason is required and shown to the reporter."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {transitionRequirements(dialog.to).assignee && (
                  <FormField label="Assign to" htmlFor="assignee">
                    <select id="assignee" className={selectClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                      {responders.map((r) => <option key={r.id} value={r.id}>{r.full_name}{r.id === userId ? " (me)" : ""}</option>)}
                    </select>
                  </FormField>
                )}
                <FormField label={dialog.to === "resolved" ? "Resolution details" : dialog.to === "assigned" ? "Note (optional)" : "Reason"} htmlFor="t-note">
                  <Textarea id="t-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                </FormField>
                {dialog.to === "resolved" && (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Resolution photo (optional)</p>
                    {photos.length < 3 && <ImageUpload key={photos.length} bucket="pulse-evidence" userId={userId} onUploaded={(p) => setPhotos((x) => [...x, p])} label="Add photo" />}
                    {photos.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{photos.length} attached</p>}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                <Button
                  disabled={pending || (transitionRequirements(dialog.to).note && note.trim().length === 0) || (transitionRequirements(dialog.to).assignee && !assigneeId)}
                  onClick={() => run(() => transitionPulseReport({ reportId, to: dialog.to, note, assignee: assigneeId || null, resolutionPaths: photos }))}
                >
                  {pending && <LoaderCircle className="animate-spin" />} Confirm
                </Button>
              </DialogFooter>
            </>
          )}
          {dialog?.kind === "note" && (
            <>
              <DialogHeader>
                <DialogTitle>Add a note</DialogTitle>
                <DialogDescription>Internal notes are visible to responders only. Public updates appear on the report timeline.</DialogDescription>
              </DialogHeader>
              <Textarea aria-label="Note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-[var(--primary)]" /> Internal (responders only)
              </label>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                <Button disabled={pending || !note.trim()} onClick={() => run(() => addPulseNote({ reportId, note, internal }))}>{pending && <LoaderCircle className="animate-spin" />} Save note</Button>
              </DialogFooter>
            </>
          )}
          {dialog?.kind === "alert" && (
            <>
              <DialogHeader>
                <DialogTitle>Issue a campus safety alert</DialogTitle>
                <DialogDescription>Sends an in-app notification to every user and pins a warning on CampusPulse until it expires. Use only for verified hazards.</DialogDescription>
              </DialogHeader>
              <FormField label="Alert message" htmlFor="alert-msg" hint="Say where to avoid and what to do. Never ask people to approach or handle animals.">
                <Textarea id="alert-msg" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              </FormField>
              <FormField label="Expires after (hours)" htmlFor="alert-hours">
                <Input id="alert-hours" type="number" min={1} max={48} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
              </FormField>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                <Button variant="destructive" disabled={pending || note.trim().length < 10} onClick={() => run(() => issuePulseAlert({ reportId, message: note, hours }))}>
                  {pending && <LoaderCircle className="animate-spin" />} Send alert
                </Button>
              </DialogFooter>
            </>
          )}
          {dialog?.kind === "duplicate" && (
            <>
              <DialogHeader>
                <DialogTitle>Merge into an existing report</DialogTitle>
                <DialogDescription>This report will be closed and its reporter and confirmers will follow the original instead.</DialogDescription>
              </DialogHeader>
              <FormField label="Original report reference" htmlFor="dup-ref" hint="e.g. CP-1004">
                <Input id="dup-ref" value={ofRef} onChange={(e) => setOfRef(e.target.value)} />
              </FormField>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                <Button disabled={pending || ofRef.trim().length < 3} onClick={() => run(() => markPulseDuplicate({ reportId, ofRef }))}>{pending && <LoaderCircle className="animate-spin" />} Merge</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
