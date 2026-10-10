import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, BookOpen, ExternalLink, MessagesSquare, Search } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionButton } from "@/components/common/action-button";
import { FlagButton } from "@/components/common/flag-button";
import { selectClass } from "@/components/common/form-field";
import { ResourceFormDialog } from "@/components/resources/resource-form-dialog";
import { Button } from "@/components/ui/button";
import { deleteResource, setResourceOfficial } from "@/lib/actions/research";
import { DEPARTMENTS } from "@/lib/constants";

export const metadata: Metadata = { title: "Academic resources" };

const KIND_LABELS = { course: "Course", elective: "Elective", material: "Learning material", link: "Link", form: "Form" } as const;

export default async function ResourcesPage({ searchParams }: PageProps<"/resources">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%,()]/g, "").slice(0, 60) : "";
  const kind = typeof sp.kind === "string" && sp.kind in KIND_LABELS ? (sp.kind as keyof typeof KIND_LABELS) : undefined;
  const department = typeof sp.department === "string" ? sp.department : "";
  const source = sp.source === "official" || sp.source === "student" ? sp.source : "";
  const v = await requireViewer();

  let query = v.supabase.from("resources").select("*, server:servers(id, name)").order("is_official", { ascending: false }).order("title").limit(120);
  if (q) query = query.or(`title.ilike.%${q}%,course_code.ilike.%${q}%,description.ilike.%${q}%`);
  if (kind) query = query.eq("kind", kind);
  if (department) query = query.eq("department", department);
  if (source) query = query.eq("is_official", source === "official");
  const { data: resources } = await query;

  return (
    <div>
      <PageHeader
        title="Academic resources"
        description="Course and elective information, curated links and course communities. Official items are curated by administrators; others are student-contributed. Registration and grades remain in the university's official systems."
        actions={<ResourceFormDialog />}
      />
      <form className="mb-6 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="rsq" className="sr-only">Search resources</label>
          <input id="rsq" name="q" defaultValue={q} placeholder="Title or course code…" className="h-9 w-full rounded-lg border border-input bg-input/30 pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <label htmlFor="rsk" className="sr-only">Type</label>
        <select id="rsk" name="kind" defaultValue={kind ?? ""} className={selectClass}>
          <option value="">All types</option>
          {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label htmlFor="rsd" className="sr-only">Department</label>
        <select id="rsd" name="department" defaultValue={department} className={selectClass}>
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label htmlFor="rss" className="sr-only">Source</label>
        <select id="rss" name="source" defaultValue={source} className={selectClass}>
          <option value="">Official & student</option>
          <option value="official">Official only</option>
          <option value="student">Student-contributed</option>
        </select>
        <Button type="submit" variant="secondary" className="h-9">Filter</Button>
      </form>

      {!resources?.length ? (
        <EmptyState icon={BookOpen} title="No resources found" description="Share a helpful link or course note with your classmates." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {resources.map((r) => (
            <li key={r.id} className="flex flex-col rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {r.is_official ? <ToneBadge tone="primary"><BadgeCheck className="size-3" /> Official</ToneBadge> : <ToneBadge tone="warning">Student-contributed</ToneBadge>}
                <ToneBadge>{KIND_LABELS[r.kind]}</ToneBadge>
                {r.course_code && <span className="font-mono text-xs text-muted-foreground">{r.course_code}</span>}
              </div>
              <p className="mt-2 font-medium">{r.title}</p>
              {r.description && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.description}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {r.department}
                {r.source_label && <> · Source: {r.source_label}</>}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Open link <ExternalLink className="size-3.5" />
                  </a>
                )}
                {r.server && (
                  <Link href={`/communities/${r.server.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <MessagesSquare className="size-3.5" /> {r.server.name}
                  </Link>
                )}
                <div className="ml-auto flex gap-1">
                  {v.isAdmin && (
                    <ActionButton action={setResourceOfficial} input={{ id: r.id, official: !r.is_official }} size="xs" variant="ghost">
                      {r.is_official ? "Unmark official" : "Mark official"}
                    </ActionButton>
                  )}
                  {(r.submitted_by === v.userId || v.isModerator) && (
                    <ActionButton action={deleteResource} input={{ id: r.id }} size="xs" variant="ghost" confirm={{ title: "Delete this resource?", confirmLabel: "Delete", destructive: true }}>Delete</ActionButton>
                  )}
                  {r.submitted_by !== v.userId && <FlagButton targetType="resource" targetId={r.id} iconOnly />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
