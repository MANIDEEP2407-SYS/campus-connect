import { Suspense } from "react";
import { requireViewer } from "@/lib/auth";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Topbar } from "@/components/shell/topbar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Every app route is personalised (reads the session cookie), so the authenticated shell streams
 * inside Suspense while a static skeleton renders instantly (required with Cache Components).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}

async function AuthedShell({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const [{ count: unread }, { data: memberships }] = await Promise.all([
    v.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", v.userId).is("read_at", null),
    v.supabase.from("conversation_members").select("last_read_at, conversations(last_message_at)").eq("user_id", v.userId),
  ]);
  const unreadMessages = (memberships ?? []).filter((m) => m.conversations && m.conversations.last_message_at > m.last_read_at).length;

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <AppSidebar isReviewer={v.isReviewer} isModerator={v.isModerator} unreadMessages={unreadMessages} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userId={v.userId} unread={unread ?? 0} profile={v.profile} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-6 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileNav isReviewer={v.isReviewer} isModerator={v.isModerator} />
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading CampusConnect">
      <div className="hidden w-64 shrink-0 space-y-2 border-r bg-sidebar p-4 lg:block">
        <Skeleton className="mb-6 h-8 w-40" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex-1">
        <div className="flex h-16 items-center border-b px-6">
          <Skeleton className="h-9 w-full max-w-xl" />
        </div>
        <div className="mx-auto max-w-6xl space-y-4 px-6 pt-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
