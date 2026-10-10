"use client";

import { useOptimistic, useTransition } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions/social";

export function FollowButton({ userId, following, className }: { userId: string; following: boolean; className?: string }) {
  const [state, setState] = useOptimistic(following);
  const [pending, start] = useTransition();
  return (
    <Button
      variant={state ? "outline" : "default"}
      size="sm"
      className={className}
      disabled={pending}
      aria-pressed={state}
      onClick={() =>
        start(async () => {
          setState(!state);
          const res = await toggleFollow({ userId, following: state });
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {state ? <UserMinus /> : <UserPlus />}
      {state ? "Following" : "Follow"}
    </Button>
  );
}
