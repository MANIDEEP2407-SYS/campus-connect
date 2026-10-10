import { ToneBadge } from "@/components/common/tone-badge";
import { CATEGORY_META, SEVERITY_META, STATUS_META, type PulseCategory, type PulseSeverity, type PulseStatus } from "@/lib/pulse";

export function PulseStatusBadge({ status }: { status: PulseStatus }) {
  const m = STATUS_META[status];
  return <ToneBadge tone={m.tone} dot>{m.label}</ToneBadge>;
}

export function SeverityBadge({ severity }: { severity: PulseSeverity }) {
  const m = SEVERITY_META[severity];
  return <ToneBadge tone={m.tone}>{m.label} severity</ToneBadge>;
}

export function CategoryLabel({ category, subcategory }: { category: PulseCategory; subcategory?: string | null }) {
  const m = CATEGORY_META[category];
  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden>{m.emoji}</span> {m.label}
      {subcategory && ` · ${subcategory}`}
    </span>
  );
}
