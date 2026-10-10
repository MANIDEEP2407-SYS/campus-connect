import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { Logo } from "@/components/shell/logo";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">Set up your campus profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell people what you study and what you&apos;re into. You control who can see this — change it any time.
      </p>
      <Card className="mt-6">
        <CardContent className="pt-2">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <OnboardingForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function OnboardingForm() {
  const v = await requireViewer({ allowUnonboarded: true });
  if (v.profile.onboarded) redirect("/home");
  return <ProfileForm profile={v.profile} mode="onboarding" />;
}
