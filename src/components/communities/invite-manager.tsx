"use client";

import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/common/action-button";
import { createInvite, revokeInvite } from "@/lib/actions/communities";

export function InviteManager({ serverId, invites }: { serverId: string; invites: { id: string; code: string; uses: number; max_uses: number; expires_at: string }[] }) {
  const url = (code: string) => `${window.location.origin}/invite/${code}`;
  const copy = async (code: string) => {
    await navigator.clipboard.writeText(url(code));
    toast.success("Invite link copied");
  };
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Invite links</h2>
          <p className="text-xs text-muted-foreground">Links expire after 7 days or 25 uses. Anyone signed in with the link can join.</p>
        </div>
        <ActionButton action={createInvite} input={{ serverId, days: 7, maxUses: 25 }} size="sm" onDone={(d) => d && copy(d.code)}>
          <Link2 /> New invite
        </ActionButton>
      </div>
      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active invites.</p>
      ) : (
        <ul className="divide-y">
          {invites.map((i) => {
            const expired = new Date(i.expires_at) < new Date() || i.uses >= i.max_uses;
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{i.code}</code>
                <span className="text-xs text-muted-foreground">
                  {i.uses}/{i.max_uses} uses · {expired ? "expired" : `expires ${new Date(i.expires_at).toLocaleDateString()}`}
                </span>
                <div className="ml-auto flex gap-1.5">
                  {!expired && <Button size="sm" variant="outline" onClick={() => copy(i.code)}><Copy /> Copy link</Button>}
                  <ActionButton action={revokeInvite} input={{ id: i.id }} size="sm" variant="ghost">Revoke</ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
