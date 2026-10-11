import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/shell/logo";
import { NotificationBell } from "@/components/shell/notification-bell";
import { UserMenu } from "@/components/shell/user-menu";

export function Topbar({
  userId,
  unread,
  profile,
}: {
  userId: string;
  unread: number;
  profile: { full_name: string; handle: string; avatar_url: string | null };
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 md:px-6">
      <div className="lg:hidden">
        <Logo compact />
      </div>
      <form action="/search" role="search" className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="global-search" className="sr-only">
          Search CampusConnect
        </label>
        <input
          id="global-search"
          name="q"
          type="search"
          placeholder="Search people, communities, clubs, events, projects…"
          className="h-9 w-full rounded-lg border border-input bg-muted/40 pr-3 pl-9 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        />
      </form>
      <div className="ml-auto flex items-center gap-1.5">
        <Link href="/incidents/new" className="hidden h-9 items-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-sm font-medium text-destructive hover:bg-destructive/20 md:inline-flex">
          Report an incident
        </Link>
        <NotificationBell userId={userId} initialUnread={unread} />
        <UserMenu profile={profile} />
      </div>
    </header>
  );
}
