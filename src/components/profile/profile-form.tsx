"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormField, fieldAria, selectClass } from "@/components/common/form-field";
import { TagInput } from "@/components/common/tag-input";
import { ImageUpload } from "@/components/common/image-upload";
import { UserAvatar } from "@/components/common/user-avatar";
import { setAvatar, updateProfile } from "@/lib/actions/social";
import { profileSchema } from "@/lib/validation";
import { AFFILIATION_LABELS, DEPARTMENTS, INTEREST_SUGGESTIONS, VISIBILITY_LABELS } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type Values = z.input<typeof profileSchema>;

export function ProfileForm({ profile, mode }: { profile: Tables<"profiles">; mode: "onboarding" | "edit" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [avatar, setAvatarUrl] = useState(profile.avatar_url);
  const form = useForm<Values, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name,
      handle: profile.handle,
      affiliation: profile.affiliation,
      department: profile.department ?? "",
      program: profile.program ?? "",
      year_of_study: profile.year_of_study ?? "",
      bio: profile.bio ?? "",
      skills: profile.skills,
      interests: profile.interests,
      goals: profile.goals,
      visibility: profile.visibility,
      allow_dms: profile.allow_dms,
    },
  });
  const { errors } = form.formState;
  const affiliation = form.watch("affiliation");

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = await updateProfile(values, { onboarding: mode === "onboarding" });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(mode === "onboarding" ? "Welcome to CampusConnect!" : "Profile saved");
          router.push(mode === "onboarding" ? "/discover" : `/profile/${values.handle}`);
        }),
      )}
    >
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Basics</h2>
        <div className="flex items-center gap-4">
          <UserAvatar name={form.watch("full_name") || profile.full_name} src={avatar} size="lg" />
          <ImageUpload
            bucket="avatars"
            userId={profile.id}
            label="Upload avatar"
            hint="PNG, JPEG or WebP, up to 2 MB"
            onUploaded={async (_path, url) => {
              setAvatarUrl(url);
              const res = await setAvatar({ url });
              if (!res.ok) toast.error(res.error);
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="full_name" error={errors.full_name?.message} required>
            <Input {...fieldAria("full_name", errors.full_name?.message)} {...form.register("full_name")} />
          </FormField>
          <FormField label="Handle" htmlFor="handle" error={errors.handle?.message} hint="Your profile URL: /profile/handle" required>
            <Input {...fieldAria("handle", errors.handle?.message)} {...form.register("handle")} />
          </FormField>
          <FormField label="Affiliation" htmlFor="affiliation" hint="Self-declared. Verified faculty status is granted by administrators." required>
            <select className={selectClass} {...fieldAria("affiliation")} {...form.register("affiliation")}>
              {Object.entries(AFFILIATION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Department / school" htmlFor="department" error={errors.department?.message}>
            <select className={selectClass} {...fieldAria("department")} {...form.register("department")}>
              <option value="">Select…</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Programme" htmlFor="program" error={errors.program?.message}>
            <Input placeholder="e.g. B.Tech CSE, M.Tech Robotics, PhD" {...fieldAria("program")} {...form.register("program")} />
          </FormField>
          {(affiliation === "ug_student" || affiliation === "pg_student" || affiliation === "phd_scholar") && (
            <FormField label="Year" htmlFor="year_of_study" error={errors.year_of_study?.message}>
              <select className={selectClass} {...fieldAria("year_of_study")} {...form.register("year_of_study")}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </FormField>
          )}
        </div>
        <FormField label="Bio" htmlFor="bio" error={errors.bio?.message} hint="What are you working on or curious about?">
          <Textarea rows={3} maxLength={500} {...fieldAria("bio")} {...form.register("bio")} />
        </FormField>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Interests &amp; collaboration</h2>
          <p className="text-sm text-muted-foreground">Used for transparent, rules-based recommendations in Discover.</p>
        </div>
        <FormField label="Interests" htmlFor="interests" error={errors.interests?.message}>
          <Controller control={form.control} name="interests" render={({ field }) => <TagInput id="interests" value={field.value} onChange={field.onChange} suggestions={INTEREST_SUGGESTIONS} />} />
        </FormField>
        <FormField label="Skills" htmlFor="skills" error={errors.skills?.message}>
          <Controller control={form.control} name="skills" render={({ field }) => <TagInput id="skills" value={field.value} onChange={field.onChange} placeholder="e.g. Python, CAD, Embedded C" />} />
        </FormField>
        <FormField label="Looking for" htmlFor="goals" error={errors.goals?.message} hint="Skills or collaborators you'd like to find, e.g. 'UI design', 'Hardware partner'.">
          <Controller control={form.control} name="goals" render={({ field }) => <TagInput id="goals" value={field.value} onChange={field.onChange} max={10} />} />
        </FormField>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Privacy</h2>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Who can see your full profile?</legend>
          <Controller
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(VISIBILITY_LABELS) as (keyof typeof VISIBILITY_LABELS)[]).map((k) => (
                  <label key={k} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50", field.value === k && "border-primary bg-primary/5")}>
                    <input type="radio" className="mt-0.5 accent-[var(--primary)]" checked={field.value === k} onChange={() => field.onChange(k)} name="visibility" value={k} />
                    <span>
                      <span className="block font-medium">{VISIBILITY_LABELS[k]}</span>
                      <span className="text-xs text-muted-foreground">
                        {k === "campus" && "Shown in Discover and search."}
                        {k === "connections" && "Others see your name only."}
                        {k === "hidden" && "Not listed in Discover or search."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          />
        </fieldset>
        <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
          <span>
            <span className="block font-medium">Allow direct messages</span>
            <span className="text-xs text-muted-foreground">People can start a conversation with you.</span>
          </span>
          <Controller control={form.control} name="allow_dms" render={({ field }) => <Switch checked={field.value} onCheckedChange={(c) => field.onChange(c)} aria-label="Allow direct messages" />} />
        </label>
      </section>

      <div className="flex justify-end gap-2">
        {mode === "edit" && (
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        )}
        <Button type="submit" disabled={pending} className="h-9 px-4">
          {pending && <LoaderCircle className="animate-spin" />} {mode === "onboarding" ? "Finish setup" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
