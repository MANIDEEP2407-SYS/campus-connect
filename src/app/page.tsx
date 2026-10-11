import Link from "next/link";
import { CalendarDays, Compass, FileWarning, FlaskConical, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/shell/logo";
import { buttonVariants } from "@/components/ui/button";
import { LANDING_PHOTOS, unsplash } from "@/lib/photos";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: MessagesSquare, title: "Communities", body: "Student-created servers with channels and realtime chat for departments, electives and hobbies." },
  { icon: Compass, title: "Discover people", body: "Find collaborators across disciplines by interests, skills and goals — with transparent matching." },
  { icon: CalendarDays, title: "Clubs & events", body: "Verified official clubs, event registration with capacity limits and reminders." },
  { icon: FlaskConical, title: "Research exchange", body: "Faculty post projects; students apply and track decisions in one place." },
  { icon: FileWarning, title: "Incident reports", body: "Students and teachers confidentially report misconduct to the department concerned, with a reviewed, traceable outcome." },
  { icon: ShieldCheck, title: "CampusShield", body: "AI-assisted moderation that flags harmful content for human review — people decide, not the model." },
  { icon: Users, title: "Built for one campus", body: "Designed around the Coimbatore campus, with role-based access for department reviewers and moderators." },
];

const CAMPUS_LIFE = [
  { photo: LANDING_PHOTOS.robotics, label: "Build robots" },
  { photo: LANDING_PHOTOS.dance, label: "Perform" },
  { photo: LANDING_PHOTOS.hack, label: "Hack all night" },
  { photo: LANDING_PHOTOS.green, label: "Green the campus" },
];

function Photo({ photo, w, className }: { photo: { id: string; alt: string }; w: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- remote photos are sized by URL
  return <img src={unsplash(photo.id, w)} alt={photo.alt} decoding="async" referrerPolicy="no-referrer" className={cn("rounded-2xl bg-muted object-cover ring-1 ring-border", className)} />;
}

export default function Landing() {
  const credits = [...new Set(Object.values(LANDING_PHOTOS).map((p) => p.credit))].join(", ");
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
      <main className="relative mx-auto max-w-6xl px-4 pt-10 pb-24 md:px-6 md:pt-16">
        <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" /> Prototype · Amrita Vishwa Vidyapeetham, Coimbatore
            </p>
            <h1 className="max-w-3xl text-4xl font-bold text-balance md:text-6xl">
              One Campus. Every Connection. <span className="text-primary">Every Opportunity.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base text-pretty text-muted-foreground md:text-lg">
              CampusConnect brings communities, clubs, research and confidential incident reporting into one connected platform for students, faculty and campus teams.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-10 px-5")}>Create an account</Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-5")}>Sign in with a demo account</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4" aria-label="Campus life">
            <Photo photo={LANDING_PHOTOS.hero} w={900} className="col-span-2 aspect-[16/8] w-full" />
            <Photo photo={LANDING_PHOTOS.study} w={600} className="aspect-[4/3] w-full" />
            <Photo photo={LANDING_PHOTOS.library} w={600} className="aspect-[4/3] w-full" />
          </div>
        </section>

        <ul className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border bg-card/60 p-5">
              <Icon className="mb-3 size-5 text-primary" />
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>

        <section className="mt-20">
          <h2 className="text-2xl font-semibold text-balance">Find your people — on and off the stage</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Join clubs, register for events and build things together with students from every department.</p>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {CAMPUS_LIFE.map(({ photo, label }) => (
              <li key={label} className="relative overflow-hidden rounded-2xl">
                <Photo photo={photo} w={600} className="aspect-[4/5] w-full rounded-2xl" />
                <span className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent p-4 pt-10 text-sm font-medium text-white">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-16 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          This is an independent hackathon prototype. It is not an official university system, does not integrate with university identity or records, and
          all demo people, clubs, events and incident reports are fictional. Incident reports are not an emergency service. Illustrative stock photos from{" "}
          <a href="https://unsplash.com" className="underline hover:text-foreground" rel="noreferrer" target="_blank">Unsplash</a> by {credits}.
        </p>
      </main>
    </div>
  );
}
