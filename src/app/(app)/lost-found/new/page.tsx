import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { LfItemForm } from "@/components/lostfound/lf-item-form";

export const metadata: Metadata = { title: "New Lost & Found listing" };

export default async function NewLfItem({ searchParams }: PageProps<"/lost-found/new">) {
  const sp = await searchParams;
  const kind = sp.kind === "found" ? "found" : "lost";
  const v = await requireViewer();
  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/lost-found", label: "Lost & Found" }}
        title={kind === "lost" ? "Report a lost item" : "Report a found item"}
        description="Public listings never show your phone number or email — people contact you through private, in-app claim requests."
      />
      <LfItemForm userId={v.userId} kind={kind} />
    </div>
  );
}
