import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MicrosoftSignIn } from "@/components/auth/microsoft-sign-in";
import { AUTH_ERROR_MESSAGES, devLoginAllowed, microsoftConfig } from "@/lib/microsoft";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, reason } = await searchParams;
  const code = typeof error === "string" ? error : typeof reason === "string" ? reason : null;
  const message = code ? (AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES.server_error) : null;
  const ms = microsoftConfig();
  const msReady = ms.enabled && Boolean(ms.tenantId);
  const dev = devLoginAllowed();
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome to CampusConnect</CardTitle>
        <CardDescription>Sign in with your official Amrita Microsoft 365 account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {message && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {message}
          </p>
        )}

        <MicrosoftSignIn ready={msReady} next={nextPath} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {msReady ? (
            <>Only accounts from the approved Amrita Microsoft tenant can sign in. Personal Microsoft accounts and other organisations are declined. Signing in never grants moderator or admin roles — those are assigned by administrators.</>
          ) : (
            <>Microsoft sign-in is <strong className="text-foreground">awaiting university configuration</strong> (Entra app registration and tenant approval). Until then, use the development sign-in below.</>
          )}
        </p>

        {dev && (
          <div className="space-y-4 rounded-lg border border-dashed border-warning/40 p-4">
            <p className="text-xs font-medium tracking-wide text-warning uppercase">Development sign-in (not available in production)</p>
            <LoginForm next={nextPath} />
            <div className="flex justify-between text-sm">
              <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot password?</Link>
              <Link href="/signup" className="font-medium text-primary hover:underline">Create a test account</Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
