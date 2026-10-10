import { Suspense } from "react";
import { Logo } from "@/components/shell/logo";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.76_0.115_184/0.14),transparent_70%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>{children}</Suspense>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Prototype sign-in. Accounts are <strong className="text-foreground">not</strong> verified against university systems; demo content is fictional.
        </p>
      </div>
    </div>
  );
}
