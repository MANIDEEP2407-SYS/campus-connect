"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/common/form-field";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>We&apos;ll email you a secure link to choose a new password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await requestPasswordReset({ email });
              setMsg(res.ok ? { ok: true, text: res.message ?? "Check your email." } : { ok: false, text: res.error });
            });
          }}
        >
          <FormField label="Email" htmlFor="email">
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          {msg && (
            <p role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>
              {msg.text}
            </p>
          )}
          <Button type="submit" className="h-9 w-full" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />} Send reset link
          </Button>
          <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
