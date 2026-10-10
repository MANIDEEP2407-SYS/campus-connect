import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { devLoginAllowed } from "@/lib/microsoft";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create a test account" };

// Test accounts are a development-only method; production users sign in with Microsoft.
export default function SignupPage() {
  if (!devLoginAllowed()) redirect("/login?error=dev_login_disabled");
  return <SignupForm />;
}
