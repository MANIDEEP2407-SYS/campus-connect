import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { ProjectForm } from "@/components/research/project-form";

export const metadata: Metadata = { title: "Publish a project" };

export default async function NewProject({ searchParams }: PageProps<"/research/new">) {
  const v = await requireViewer();
  const isFaculty = v.roles.has("faculty") || v.isAdmin;
  if (!isFaculty && v.profile.affiliation !== "phd_scholar") redirect("/research");
  const sp = await searchParams;
  const kind = sp.kind === "consultancy" && isFaculty ? "consultancy" : "research";
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/research", label: "Research" }} title={kind === "consultancy" ? "Publish a consultancy listing" : "Publish a research project"} description="Describe the work, the skills you need and the time commitment." />
      <ProjectForm kind={kind} canConsult={isFaculty} />
    </div>
  );
}
