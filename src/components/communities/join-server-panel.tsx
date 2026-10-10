"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/common/action-button";
import { joinServer, requestServerAccess } from "@/lib/actions/communities";

export function JoinServerPanel({ serverId, visibility, requestStatus }: { serverId: string; visibility: "public" | "private"; requestStatus: "pending" | "approved" | "rejected" | null }) {
  const [message, setMessage] = useState("");
  if (visibility === "public") {
    return <ActionButton action={joinServer} input={{ serverId }}>Join community</ActionButton>;
  }
  if (requestStatus === "pending") {
    return <p className="rounded-lg bg-muted px-3 py-2 text-sm">Your request is pending — the owner or a moderator will review it.</p>;
  }
  return (
    <div className="space-y-2">
      {requestStatus === "rejected" && <p className="text-sm text-muted-foreground">Your previous request was declined. You can send a new one.</p>}
      <label htmlFor="req-msg" className="text-sm font-medium">Message to the moderators (optional)</label>
      <Textarea id="req-msg" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why would you like to join?" />
      <ActionButton action={requestServerAccess} input={{ serverId, message }}>Request access</ActionButton>
    </div>
  );
}
