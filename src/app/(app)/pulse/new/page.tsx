import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { PulseReportForm } from "@/components/pulse/pulse-report-form";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewPulseReport() {
  const v = await requireViewer();
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: "/pulse", label: "CampusPulse" }}
        title="Report a campus issue"
        description="Reports go to authorised campus responders for verification. Your identity is visible only to responders, never on the public map."
      />
      <PulseReportForm userId={v.userId} />
    </div>
  );
}
