import Link from "next/link";
import { BookOpen, CalendarDays, Compass, FlaskConical, MessagesSquare, PackageSearch, Siren, Users } from "lucide-react";
import { Logo } from "@/components/shell/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: MessagesSquare, title: "Communities", body: "Student-created servers with channels and realtime chat for departments, electives and hobbies." },
  { icon: Compass, title: "Discover people", body: "Find collaborators across disciplines by interests, skills and goals — with transparent matching." },
  { icon: CalendarDays, title: "Clubs & events", body: "Verified official clubs, event registration with capacity limits and reminders." },
  { icon: FlaskConical, title: "Research exchange", body: "Faculty post projects; students apply and track decisions in one place." },
  { icon: Siren, title: "CampusPulse", body: "Report utility failures, hazards and wildlife sightings with a traceable response workflow." },
  { icon: PackageSearch, title: "Lost & Found", body: "Suggested matches and private ownership verification — no personal data in public listings." },
  { icon: BookOpen, title: "Academic resources", body: "Curated links and course communities, with official and student material clearly labelled." },
  { icon: Users, title: "Built for one campus", body: "Designed around the Coimbatore campus, with role-based access for responders and moderators." },
];

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_70%_0%,oklch(0.76_0.115_184/0.16),transparent_70%),radial-gradient(40%_40%_at_10%_20%,oklch(0.6_0.12_250/0.14),transparent_70%)]" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <Logo />
        <nav className="flex gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>Sign in</Link>
          <Link href="/signup" className={buttonVariants()}>Get started</Link>
        </nav>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 pt-16 pb-24 md:px-6 md:pt-24">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" /> Prototype · Amrita Vishwa Vidyapeetham, Coimbatore
        </p>
        <h1 className="max-w-3xl text-4xl font-bold text-balance md:text-6xl">
          One Campus. Every Connection. <span className="text-primary">Every Opportunity.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-pretty text-muted-foreground md:text-lg">
          CampusConnect brings communities, clubs, research, academic resources, campus issue reporting and Lost &amp; Found into one connected platform for students, faculty and campus teams.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-10 px-5")}>Create an account</Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-5")}>Sign in with a demo account</Link>
        </div>
        <ul className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border bg-card/60 p-5">
              <Icon className="mb-3 size-5 text-primary" />
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-16 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          This is an independent hackathon prototype. It is not an official university system, does not integrate with university identity or records, and
          all demo people, clubs, events and incident reports are fictional. CampusPulse is not an emergency service.
        </p>
      </main>
    </div>
  );
}
