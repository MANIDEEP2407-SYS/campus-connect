import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { RedeemInvite } from "@/components/communities/redeem-invite";

export const metadata: Metadata = { title: "Community invite" };

export default async function InvitePage({ params }: PageProps<"/invite/[code]">) {
  const { code } = await params;
  await requireViewer();
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center">
      <h1 className="text-xl font-semibold">You&apos;ve been invited to a community</h1>
      <p className="mt-2 text-sm text-muted-foreground">Accept to join and see its channels.</p>
      <div className="mt-5">
        <RedeemInvite code={code} />
      </div>
    </div>
  );
}
