"use client";

import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signInWithMicrosoft } from "@/lib/actions/auth";

function MicrosoftLogo() {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className="size-4.5">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function MicrosoftSignIn({ ready, next }: { ready: boolean; next?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full gap-3 bg-white text-[15px] font-semibold text-[#1b1b1b] hover:bg-white/90 hover:text-[#1b1b1b] disabled:opacity-60 dark:bg-white dark:hover:bg-white/90"
      disabled={!ready || pending}
      aria-describedby={ready ? undefined : "ms-awaiting"}
      onClick={() =>
        start(async () => {
          const res = await signInWithMicrosoft(next);
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <MicrosoftLogo />}
      Continue with Amrita Microsoft Account
      {!ready && <span id="ms-awaiting" className="sr-only">(awaiting configuration)</span>}
    </Button>
  );
}
