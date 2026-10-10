import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { ActionButton } from "@/components/common/action-button";
import { TimeAgo } from "@/components/common/time-ago";
import { ApplyForm } from "@/components/research/apply-form";
import { ApplicantReview } from "@/components/research/applicant-review";
import { setProjectStatus, withdrawApplication } from "@/lib/actions/research";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/research/[id]">) {
  const { id } = await params;
  const v = await requireViewer();
  const { data: p } = await v.supabase
    .from("research_projects")
    .select("*, lead:profiles!research_projects_lead_id_fkey(id, handle, full_name, avatar_url, department)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const isLead = p.lead_id === v.userId || v.isAdmin;

  const [{ data: apps }, { data: priv }] = await Promise.all([
    // RLS: leads see all applications, applicants see only their own.
    v.supabase
      .from("research_applications")
      .select("id, applicant_id, statement, relevant_skills, availability, status, reviewer_note, created_at, applicant:profiles!research_applications_applicant_id_fkey(handle, full_name, avatar_url, department, affiliation)")
      .eq("project_id", id)
      .order("created_at"),
    isLead ? v.supabase.from("project_private_details").select("budget_note, agreement_note").eq("project_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const mine = (apps ?? []).find((a) => a.applicant_id === v.userId);

  return (
    <div>
      <PageHeader
        back={{ href: `/research?kind=${p.kind}`, label: p.kind === "consultancy" ? "Consultancy" : "Research" }}
        eyebrow={
          <>
            <ToneBadge tone="primary">{p.area}</ToneBadge>
            <ToneBadge>{p.kind === "consultancy" ? "Consultancy" : "Research"}</ToneBadge>
            <ToneBadge tone={p.status === "open" ? "success" : "neutral"}>{p.status}</ToneBadge>
          </>
        }
        title={p.title}
        actions={
          isLead ? (
            <>
              {p.status === "open" ? (
                <ActionButton action={setProjectStatus} input={{ projectId: id, status: "closed" }} variant="outline">Close applications</ActionButton>
              ) : (
                <ActionButton action={setProjectStatus} input={{ projectId: id, status: "open" }} variant="outline">Reopen</ActionButton>
              )}
              {p.status !== "completed" && <ActionButton action={setProjectStatus} input={{ projectId: id, status: "completed" }} variant="ghost">Mark completed</ActionButton>}
            </>
          ) : undefined
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <p className="font-medium">{p.abstract}</p>
            {p.description && <p className="mt-4 text-sm whitespace-pre-wrap text-muted-foreground">{p.description}</p>}
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Commitment</dt><dd>{p.commitment}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Positions</dt><dd>{p.positions}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Posted</dt><dd><TimeAgo date={p.created_at} /></dd></div>
            </dl>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Required skills">
              {p.required_skills.map((s) => <li key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs">{s}</li>)}
            </ul>
          </section>
          {isLead && priv && (priv.budget_note || priv.agreement_note) && (
            <section className="rounded-xl border border-warning/30 bg-card p-5 text-sm">
              <h2 className="mb-2 flex items-center gap-2 font-semibold"><Lock className="size-3.5" /> Restricted details</h2>
              {priv.budget_note && <p className="text-muted-foreground">{priv.budget_note}</p>}
              {priv.agreement_note && <p className="mt-2 text-muted-foreground">{priv.agreement_note}</p>}
            </section>
          )}
          {isLead && <ApplicantReview applications={(apps ?? []) as Parameters<typeof ApplicantReview>[0]["applications"]} />}
        </div>
        <aside className="space-y-4">
          {p.lead && (
            <section className="rounded-xl border bg-card p-5">
              <p className="mb-2 text-xs text-muted-foreground">Project lead</p>
              <Link href={`/profile/${p.lead.handle}`} className="flex items-center gap-3 hover:underline">
                <UserAvatar name={p.lead.full_name} src={p.lead.avatar_url} />
                <span>
                  <span className="block font-medium">{p.lead.full_name}</span>
                  <span className="block text-xs text-muted-foreground">{p.lead.department}</span>
                </span>
              </Link>
            </section>
          )}
          {!isLead &&
            (mine ? (
              <section className="space-y-3 rounded-xl border border-primary/30 bg-card p-5 text-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Your application</h2>
                  <ToneBadge tone={mine.status === "accepted" ? "success" : mine.status === "rejected" ? "danger" : "info"}>{mine.status}</ToneBadge>
                </div>
                <p className="text-muted-foreground">{mine.statement}</p>
                {mine.reviewer_note && <p className="rounded-md bg-muted p-2 text-xs">Lead&apos;s note: {mine.reviewer_note}</p>}
                {mine.status === "withdrawn" && p.status === "open" && <ApplyForm projectId={id} defaultSkills={v.profile.skills} />}
                {["pending", "shortlisted"].includes(mine.status) && (
                  <ActionButton action={withdrawApplication} input={{ applicationId: mine.id }} variant="outline" size="sm" confirm={{ title: "Withdraw your application?", confirmLabel: "Withdraw" }}>
                    Withdraw
                  </ActionButton>
                )}
              </section>
            ) : p.status === "open" ? (
              <ApplyForm projectId={id} defaultSkills={v.profile.skills} />
            ) : (
              <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">This project is not accepting applications.</p>
            ))}
        </aside>
      </div>
    </div>
  );
}
