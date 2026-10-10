"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/common/action-button";
import { resolveModerationReport } from "@/lib/actions/admin";

export function ModerationActions({ reportId, removable }: { reportId: string; removable: boolean }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label htmlFor={`mn-${reportId}`} className="sr-only">Resolution note</label>
      <Input id={`mn-${reportId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (optional)" className="h-8 max-w-xs" />
      {removable && (
        <ActionButton action={resolveModerationReport} input={{ id: reportId, status: "actioned", note, removeContent: true }} size="sm" variant="destructive"
          confirm={{ title: "Remove this content?", description: "The content is deleted or hidden and all open reports on it are closed.", confirmLabel: "Remove", destructive: true }}>
          Remove content
        </ActionButton>
      )}
      <ActionButton action={resolveModerationReport} input={{ id: reportId, status: "actioned", note }} size="sm" variant="outline">Mark actioned</ActionButton>
      <ActionButton action={resolveModerationReport} input={{ id: reportId, status: "dismissed", note }} size="sm" variant="ghost">Dismiss</ActionButton>
    </div>
  );
}
