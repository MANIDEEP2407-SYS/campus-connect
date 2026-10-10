"use client";

import { useTransition } from "react";
import { Ban, Ellipsis, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setBlock } from "@/lib/actions/shield";

export function BlockControls({ userId, name, state }: { userId: string; name: string; state: "block" | "mute" | null }) {
  const [pending, start] = useTransition();
  const run = (kind: "block" | "mute" | null, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const res = await setBlock({ userId, kind });
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More options" disabled={pending} />}>
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {state === null ? (
          <>
            <DropdownMenuItem onClick={() => run("mute")}><VolumeX /> Mute {name.split(" ")[0]}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => run("block", `Block ${name}? They won't be able to message you or comment on your posts, and you won't see their posts.`)}>
              <Ban /> Block {name.split(" ")[0]}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => run(null)}>{state === "block" ? "Unblock" : "Unmute"} {name.split(" ")[0]}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
