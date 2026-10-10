import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <div className="text-center">
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Not found — or not yours to see</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">The page doesn&apos;t exist, or it belongs to a private community or record you don&apos;t have access to.</p>
        <Link href="/home" className={buttonVariants({ className: "mt-6" })}>Back to home</Link>
      </div>
    </div>
  );
}
