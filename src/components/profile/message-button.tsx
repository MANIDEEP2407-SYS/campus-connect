"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LoaderCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startConversation } from "@/lib/actions/communities";

export function MessageButton({ userId, label = "Message", size = "sm" }: { userId: string; label?: string; size?: "sm" | "default" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startConversation({ userId });
          if (res.ok) router.push(`/messages/${res.data.id}`);
          else toast.error(res.error);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <MessageCircle />} {label}
    </Button>
  );
}
