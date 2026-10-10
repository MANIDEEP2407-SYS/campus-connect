"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitAppeal } from "@/lib/actions/shield";

export function AppealForm({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const [pending, start] = useTransition();
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Request a review</Button>;
  return (
    <div className="space-y-2">
      <label htmlFor={`appeal-${caseId}`} className="text-xs font-medium">Why should this decision be reviewed? A different moderator will look at it where possible.</label>
      <Textarea id={`appeal-${caseId}`} rows={3} maxLength={2000} value={statement} onChange={(e) => setStatement(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || statement.trim().length < 10}
          onClick={() => start(async () => {
            const res = await submitAppeal({ caseId, statement });
            if (res.ok) toast.success(res.message);
            else toast.error(res.error);
          })}>
          {pending && <LoaderCircle className="animate-spin" />} Submit review request
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
