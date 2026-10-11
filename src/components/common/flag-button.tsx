"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Flag, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/components/common/form-field";
import { flagContent } from "@/lib/actions/social";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/shield/types";

type Target = "post" | "comment" | "message" | "direct_message" | "server" | "profile";
const CONTENT_TARGETS: Target[] = ["post", "comment", "message", "direct_message"];

/** "Report to moderators" control used across modules. Content reports feed CampusShield. */
export function FlagButton({ targetType, targetId, label = "Report", iconOnly, open: controlledOpen, onOpenChange }: {
  targetType: Target;
  targetId: string;
  label?: string;
  iconOnly?: boolean;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (o: boolean) => {
    (onOpenChange ?? setInnerOpen)(o);
    if (!o) setDone(false);
  };
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<ReportCategory>("harassment");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const isContent = CONTENT_TARGETS.includes(targetType);

  return (
    <>
      {controlledOpen === undefined && (
        <Button variant="ghost" size={iconOnly ? "icon-sm" : "sm"} onClick={() => setOpen(true)} aria-label={iconOnly ? label : undefined} className="text-muted-foreground">
          <Flag /> {!iconOnly && label}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {done ? (
            <div className="space-y-3 py-2 text-center" role="status">
              <CircleCheck className="mx-auto size-8 text-success" />
              <DialogTitle>Report received</DialogTitle>
              <DialogDescription>
                Moderators will review it. The author is not told who reported them. {isContent && "You can also block this person from their profile."}
              </DialogDescription>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Report to moderators</DialogTitle>
                <DialogDescription>
                  Reports are private. {targetType === "direct_message"
                    ? "Reporting shares only this message with moderators — not the rest of your conversation."
                    : "Moderators review reported content against campus community guidelines."}
                </DialogDescription>
              </DialogHeader>
              {isContent && (
                <div className="space-y-1.5">
                  <Label htmlFor={`flag-cat-${targetId}`}>Reason</Label>
                  <select id={`flag-cat-${targetId}`} className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
                    {REPORT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor={`flag-${targetId}`}>{isContent ? "Details" : "What's wrong?"}</Label>
                <Textarea id={`flag-${targetId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={4}
                  placeholder={isContent ? "What happened? Context helps moderators (e.g. if this is part of a pattern)." : "e.g. spam, misleading safety information, exposes personal data…"} />
              </div>
              {category === "self_harm" && isContent && (
                <p className="rounded-lg bg-warning/10 p-3 text-xs">If someone is in immediate danger, contact campus security or emergency services right away. Reports are reviewed by people, not instantly.</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  disabled={pending || reason.trim().length < 5}
                  onClick={() =>
                    start(async () => {
                      const res = await flagContent({ target_type: targetType, target_id: targetId, reason, category: isContent ? category : undefined });
                      if (res.ok) {
                        setDone(true);
                        setReason("");
                      } else toast.error(res.error);
                    })
                  }
                >
                  {pending && <LoaderCircle className="animate-spin" />} Submit report
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
