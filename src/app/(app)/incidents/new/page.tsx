import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { IncidentForm } from "@/components/incidents/incident-form";
import { isStaffAffiliation } from "@/lib/incidents";

export const metadata: Metadata = { title: "Report an incident" };

export default async function NewIncidentPage() {
  const v = await requireViewer();
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: "/incidents", label: "Incident reports" }}
        title={isStaffAffiliation(v.profile.affiliation) ? "Report an incident involving a student" : "Report an incident"}
        description="Your report is sent to the reviewers of the department concerned. Your identity is visible only to those reviewers and the central administration."
      />
      <IncidentForm userId={v.userId} affiliation={v.profile.affiliation} defaultDepartment={v.profile.department} />
    </div>
  );
}
