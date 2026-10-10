"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, fieldAria } from "@/components/common/form-field";
import { signIn } from "@/lib/actions/auth";
import { signInSchema } from "@/lib/validation";
import type { z } from "zod";

export function LoginForm({ next }: { next?: string }) {
  const [pending, start] = useTransition();
  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = await signIn(values, next);
          if (res && !res.ok) toast.error(res.error);
        }),
      )}
    >
      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...fieldAria("email", errors.email?.message)} {...form.register("email")} />
      </FormField>
      <FormField label="Password" htmlFor="password" error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...fieldAria("password", errors.password?.message)} {...form.register("password")} />
      </FormField>
      <Button type="submit" className="h-9 w-full" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />} Sign in
      </Button>
    </form>
  );
}
