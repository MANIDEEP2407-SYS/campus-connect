import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-info/12 text-info ring-info/25",
  warning: "bg-warning/12 text-warning ring-warning/25",
  success: "bg-success/12 text-success ring-success/25",
  danger: "bg-destructive/12 text-destructive ring-destructive/25",
  primary: "bg-primary/12 text-primary ring-primary/25",
};

export function ToneBadge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
