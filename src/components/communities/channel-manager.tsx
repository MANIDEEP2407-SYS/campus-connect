"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/common/form-field";
import { ActionButton } from "@/components/common/action-button";
import { createChannel, deleteChannel, updateChannel } from "@/lib/actions/communities";

/** Staff-only: create a channel, or rename/re-topic/delete the current one. */
export function ChannelManager({ serverId, channel }: { serverId: string; channel: { id: string; name: string; topic: string | null } }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [pending, start] = useTransition();

  const open = (m: "create" | "edit") => {
    setMode(m);
    setName(m === "edit" ? channel.name : "");
    setTopic(m === "edit" ? channel.topic ?? "" : "");
  };

  return (
    <>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" className="flex-1 justify-start text-muted-foreground" onClick={() => open("create")}><Plus /> New channel</Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => open("edit")}>Edit #</Button>
      </div>
      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create channel" : `Edit #${channel.name}`}</DialogTitle>
            <DialogDescription>Channel names use lowercase letters, numbers and dashes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Name" htmlFor="ch-name">
              <Input id="ch-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} maxLength={32} placeholder="project-ideas" />
            </FormField>
            <FormField label="Topic" htmlFor="ch-topic">
              <Input id="ch-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} />
            </FormField>
          </div>
          <DialogFooter>
            {mode === "edit" && channel.name !== "general" && (
              <ActionButton action={deleteChannel} input={{ channelId: channel.id }} variant="destructive" className="sm:mr-auto"
                confirm={{ title: `Delete #${channel.name}?`, description: "All messages in this channel will be permanently deleted.", confirmLabel: "Delete channel", destructive: true }}
                onDone={() => router.push(`/communities/${serverId}`)}>
                Delete
              </ActionButton>
            )}
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button
              disabled={pending || !name}
              onClick={() =>
                start(async () => {
                  const res = mode === "create" ? await createChannel({ serverId, name, topic }) : await updateChannel({ channelId: channel.id, name, topic });
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(res.message);
                  setMode(null);
                  if (mode === "create" && res.data && typeof res.data === "object" && "id" in res.data) router.push(`/communities/${serverId}/${res.data.id}`);
                })
              }
            >
              {pending && <LoaderCircle className="animate-spin" />} {mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
