"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, STAFF_ITEMS, isActive } from "@/components/shell/nav-items";
import { Logo } from "@/components/shell/logo";

export function AppSidebar({ isReviewer, isModerator, unreadMessages }: { isReviewer: boolean; isModerator: boolean; unreadMessages: number }) {
  const pathname = usePathname();
  const staff = [isReviewer && STAFF_ITEMS.reviewer, isModerator && STAFF_ITEMS.shield, isModerator && STAFF_ITEMS.admin].filter(Boolean) as (typeof STAFF_ITEMS)[keyof typeof STAFF_ITEMS][];
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.href}
              {...item}
              active={isActive(pathname, item.href, "also" in item ? item.also : [])}
              badge={item.href === "/messages" ? unreadMessages : 0}
            />
          ))}
        </ul>
        {staff.length > 0 && (
          <>
            <p className="mt-6 mb-2 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Staff tools</p>
            <ul className="space-y-0.5">
              {staff.map((item) => (
                <SidebarLink key={item.href} {...item} active={isActive(pathname, item.href)} badge={0} />
              ))}
            </ul>
          </>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-[11px] leading-relaxed text-muted-foreground">
        Prototype for the Coimbatore campus. Demo data is fictional; accounts are not university-verified.
      </div>
    </aside>
  );
}

function SidebarLink({ href, label, icon: Icon, active, badge }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean; badge: number }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <Icon className={cn("size-4.5 text-muted-foreground group-hover:text-foreground", active && "text-primary group-hover:text-primary")} />
        <span className="flex-1">{label}</span>
        {badge > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">{badge > 99 ? "99+" : badge}</span>
        )}
      </Link>
    </li>
  );
}
