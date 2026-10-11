import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { IncidentForm } from "@/components/incidents/incident-form";
import { directionFor } from "@/lib/incidents";

export const metadata: Metadata = { title: "Report an incident" };

export default async function NewIncidentPage() {
  const v = await requireViewer();
  const direction = directionFor(v.profile.affiliation);
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: "/incidents", label: "Incident reports" }}
        title={direction === "about_staff" ? "Report an incident involving a teacher" : "Report an incident involving a student"}
        description="Your report is sent to the reviewers of the department concerned. Your identity is visible only to those reviewers and the central administration."
      />
      <IncidentForm userId={v.userId} direction={direction} defaultDepartment={v.profile.department} />
    </div>
  );
}
