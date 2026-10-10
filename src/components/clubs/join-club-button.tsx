"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { joinClub } from "@/lib/actions/clubs";

export function JoinClubButton({ clubId, policy }: { clubId: string; policy: "open" | "approval" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const res = await joinClub({ clubId, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setOpen(false);
    });
  if (policy === "open")
    return (
      <Button onClick={submit} disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />} Join club
      </Button>
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Request to join</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request membership</DialogTitle>
          <DialogDescription>Coordinators review requests. Add a short note about your interest.</DialogDescription>
        </DialogHeader>
        <label htmlFor="club-note" className="sr-only">Note</label>
        <Textarea id="club-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="I'd love to help with…" />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending && <LoaderCircle className="animate-spin" />} Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
