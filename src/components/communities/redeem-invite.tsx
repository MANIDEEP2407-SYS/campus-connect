"use client";

import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/common/action-button";
import { redeemInvite } from "@/lib/actions/communities";

export function RedeemInvite({ code }: { code: string }) {
  const router = useRouter();
  return (
    <ActionButton action={redeemInvite} input={{ code }} onDone={(d) => router.push(`/communities/${d.serverId}`)} className="h-9 px-4">
      Accept invite
    </ActionButton>
  );
}
