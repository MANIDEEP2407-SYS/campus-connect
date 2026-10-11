import { TriangleAlert } from "lucide-react";
import { ToneBadge } from "@/components/common/tone-badge";
import { DISCLAIMER_POINTS, DISCLAIMER_TITLE, STATUS_META, type IncidentStatus } from "@/lib/incidents";
import { cn } from "@/lib/utils";

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const m = STATUS_META[status];
  return <ToneBadge tone={m.tone} dot>{m.label}</ToneBadge>;
}

/** The false-allegation disclaimer shown before submitting and on the reports page. */
export function IncidentDisclaimer({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div role="note" className={cn("flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm", className)}>
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div>
        <p className="font-semibold text-warning">{compact ? "Disclaimer" : DISCLAIMER_TITLE}</p>
        {compact ? (
          <p className="mt-1">{DISCLAIMER_POINTS[2]}</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            {DISCLAIMER_POINTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
