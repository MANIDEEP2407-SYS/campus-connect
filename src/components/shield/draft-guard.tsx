"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkDraft } from "@/lib/actions/shield";

type Warning = { label: string; message: string; isMock: boolean };

/**
 * Pre-publish CampusShield check. `guard(text, publish)` runs the check and either publishes
 * straight away or shows a gentle suggestion with Edit / Post anyway. It never blocks posting —
 * published content is still scanned and, if needed, reviewed by a person.
 */
export function useDraftGuard() {
  const [warning, setWarning] = useState<Warning | null>(null);
  const [checking, setChecking] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const guard = useCallback(async (text: string, publish: () => void) => {
    setChecking(true);
    const res = await checkDraft({ text }).catch(() => null);
    setChecking(false);
    const data = res?.ok ? res.data : null;
    if (data?.show) {
      pending.current = publish;
      setWarning({ label: data.label, message: data.message, isMock: data.isMock });
    } else publish();
  }, []);

  const dialog = (
    <Dialog open={warning !== null} onOpenChange={(o) => !o && setWarning(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-warning" /> Before you post</DialogTitle>
          <DialogDescription>{warning?.message}</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          CampusShield flagged this draft as possibly “{warning?.label.toLowerCase()}”. Automated checks can be wrong — quotes, jokes and
          academic discussion are sometimes misread. If you post, a moderator may review it.{" "}
          {warning?.isMock && <strong className="text-warning">(Development mock — not a real AI check.)</strong>}{" "}
          <Link href="/safety" className="text-primary hover:underline">How CampusShield works</Link>
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => { pending.current = null; setWarning(null); }}>Cancel</Button>
          <Button variant="secondary" onClick={() => { pending.current = null; setWarning(null); }}>Edit my post</Button>
          <Button onClick={() => { const p = pending.current; pending.current = null; setWarning(null); p?.(); }}>Post anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { guard, checking, dialog };
}
