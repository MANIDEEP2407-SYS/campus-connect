"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, MailCheck } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, fieldAria } from "@/components/common/form-field";
import { signUp } from "@/lib/actions/auth";
import { signUpSchema } from "@/lib/validation";

export function SignupForm() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof signUpSchema>>({ resolver: zodResolver(signUpSchema), defaultValues: { fullName: "", email: "", password: "" } });
  const { errors } = form.formState;

  if (sent)
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <MailCheck className="mx-auto size-8 text-primary" />
          <p className="font-medium">Check your inbox</p>
          <p className="text-sm text-muted-foreground">We sent a confirmation link. Open it to finish creating your account.</p>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Join CampusConnect</CardTitle>
        <CardDescription>Create a prototype account for the Coimbatore campus network.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            start(async () => {
              const res = await signUp(values);
              if (!res) return;
              if (!res.ok) toast.error(res.error);
              else if (res.data.needsConfirmation) setSent(true);
            }),
          )}
        >
          <FormField label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
            <Input autoComplete="name" {...fieldAria("fullName", errors.fullName?.message)} {...form.register("fullName")} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email?.message} hint="Use any email for the prototype — university addresses are not verified.">
            <Input type="email" autoComplete="email" {...fieldAria("email", errors.email?.message)} {...form.register("email")} />
          </FormField>
          <FormField label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters.">
            <Input type="password" autoComplete="new-password" {...fieldAria("password", errors.password?.message)} {...form.register("password")} />
          </FormField>
          <Button type="submit" className="h-9 w-full" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />} Create account
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
