import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/home" className="flex items-center gap-2.5 rounded-md" aria-label="CampusConnect Amrita — home">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.62_0.12_220)] text-sm font-bold text-primary-foreground shadow-sm">
        CC
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-heading text-[15px] font-semibold tracking-tight">CampusConnect</span>
          <span className="block text-[11px] text-muted-foreground">Amrita · Coimbatore</span>
        </span>
      )}
    </Link>
  );
}
