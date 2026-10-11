"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MOBILE_PRIMARY, NAV_ITEMS, STAFF_ITEMS, isActive } from "@/components/shell/nav-items";
import { Logo } from "@/components/shell/logo";

export function MobileNav({ isReviewer, isModerator }: { isReviewer: boolean; isModerator: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => (MOBILE_PRIMARY as readonly string[]).includes(i.href));
  const all = [
    ...NAV_ITEMS,
    ...(isReviewer ? [STAFF_ITEMS.reviewer] : []),
    ...(isModerator ? [STAFF_ITEMS.shield, STAFF_ITEMS.admin] : []),
  ];
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-6">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground", active && "text-primary")}>
                <Icon className="size-5" />
                <span className="truncate">{label.split(" ")[0]}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="flex w-full flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground" aria-label="Open full menu">
              <Menu className="size-5" />
              More
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle render={<div />}>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <ul className="space-y-0.5 p-3">
                {all.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", isActive(pathname, href) ? "bg-sidebar-accent text-foreground" : "text-sidebar-foreground/80")}
                    >
                      <Icon className="size-4.5" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
