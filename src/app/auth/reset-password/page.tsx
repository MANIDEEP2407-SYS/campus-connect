"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/common/form-field";
import { Logo } from "@/components/shell/logo";
import { updatePassword } from "@/lib/actions/auth";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Choose a new password</CardTitle>
            <CardDescription>You&apos;re signed in from the recovery link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await updatePassword({ password, confirm });
                  if (res && !res.ok) setError(res.error);
                });
              }}
            >
              <FormField label="New password" htmlFor="password">
                <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormField>
              <FormField label="Confirm password" htmlFor="confirm" error={error ?? undefined}>
                <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </FormField>
              <Button type="submit" className="h-9 w-full" disabled={pending}>
                {pending && <LoaderCircle className="animate-spin" />} Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
