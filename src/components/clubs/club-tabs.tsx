import Link from "next/link";
import { cn } from "@/lib/utils";

export function ClubTabs({ active }: { active: "clubs" | "events" }) {
  return (
    <nav aria-label="Clubs and events" className="mb-6 inline-flex rounded-lg border bg-card p-1">
      {[
        { id: "clubs", href: "/clubs", label: "Clubs" },
        { id: "events", href: "/events", label: "Events" },
      ].map((t) => (
        <Link key={t.id} href={t.href} aria-current={active === t.id ? "page" : undefined}
          className={cn("rounded-md px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground", active === t.id && "bg-muted font-medium text-foreground")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
