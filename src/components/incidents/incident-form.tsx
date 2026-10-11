"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, fieldAria, selectClass } from "@/components/common/form-field";
import { ImageUpload } from "@/components/common/image-upload";
import { IncidentDisclaimer } from "@/components/incidents/incident-badges";
import { submitIncident } from "@/lib/actions/incidents";
import { incidentSchema } from "@/lib/validation";
import { CATEGORY_META, DECLARATION, DIRECTION_META, categoriesFor, directionFor, subjectKindsFor, type SubjectKind } from "@/lib/incidents";
import { CAMPUS_LOCATIONS, DEPARTMENTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Values = z.input<typeof incidentSchema>;

const SUBJECT_OPTIONS: Record<SubjectKind, { label: string; hint: string }> = {
  staff: { label: "A teacher or staff member", hint: "Any incident during classes, labs or official work" },
  student: { label: "Another student", hint: "Only plagiarism or stealing your work" },
};

export function IncidentForm({ userId, affiliation, defaultDepartment }: { userId: string; affiliation: string; defaultDepartment: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [photos, setPhotos] = useState<string[]>([]);
  const kinds = subjectKindsFor(affiliation);
  const today = new Date().toISOString().slice(0, 10);
  const form = useForm<Values, unknown, z.output<typeof incidentSchema>>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      category: kinds[0] === "student" ? "idea_theft" : "unprofessional_conduct", subject_kind: kinds[0], subject_name: "",
      department: defaultDepartment ?? "", title: "", description: "",
      occurred_on: today, location: "", context: "", witnesses: "", declaration: false as unknown as true,
    },
  });
  const { errors } = form.formState;
  const subjectKind = useWatch({ control: form.control, name: "subject_kind" });
  const direction = directionFor(affiliation, subjectKind);
  const categories = categoriesFor(direction);
  const meta = DIRECTION_META[direction];

  const submit = (values: z.output<typeof incidentSchema>) =>
    start(async () => {
      const res = await submitIncident({ ...values, attachmentPaths: photos });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.push(`/incidents/${res.data.id}`);
    });

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-6">
      {kinds.length > 1 && (
        <fieldset className="rounded-xl border bg-card p-5">
          <legend className="px-1 text-sm font-semibold">Who is this about?</legend>
          <Controller
            control={form.control}
            name="subject_kind"
            render={({ field }) => (
              <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who is this about?">
                {kinds.map((k) => (
                  <label key={k} className={cn("flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50", field.value === k && "border-primary bg-primary/5")}>
                    <input
                      type="radio"
                      name="subject_kind"
                      value={k}
                      checked={field.value === k}
                      onChange={() => {
                        field.onChange(k);
                        const allowed = categoriesFor(directionFor(affiliation, k));
                        if (!allowed.includes(form.getValues("category"))) form.setValue("category", allowed[0]!);
                      }}
                      className="sr-only"
                    />
                    <span className="font-medium">{SUBJECT_OPTIONS[k].label}</span>
                    <span className="text-xs text-muted-foreground">{SUBJECT_OPTIONS[k].hint}</span>
                  </label>
                ))}
              </div>
            )}
          />
        </fieldset>
      )}

      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">What kind of incident?</legend>
        {direction === "about_peer" && (
          <p className="mt-1 text-xs text-muted-foreground">Between students, only plagiarism and stealing work can be reported here.</p>
        )}
        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Category">
              {categories.map((c) => (
                <label key={c} className={cn("flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50", field.value === c && "border-primary bg-primary/5")}>
                  <input type="radio" name="category" value={c} checked={field.value === c} onChange={() => field.onChange(c)} className="sr-only" />
                  <span className="font-medium">{CATEGORY_META[c].label}</span>
                  <span className="text-xs text-muted-foreground">{CATEGORY_META[c].hint}</span>
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>

      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <FormField label={meta.subject} htmlFor="i-subject" error={errors.subject_name?.message} required hint="Name and, if known, designation or roll number.">
          <Input {...fieldAria("i-subject", errors.subject_name?.message)} {...form.register("subject_name")} />
        </FormField>
        <FormField label={meta.department} htmlFor="i-dept" error={errors.department?.message} required hint="The report is sent to this department's reviewers.">
          <select className={selectClass} {...fieldAria("i-dept", errors.department?.message)} {...form.register("department")}>
            <option value="">Select…</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </FormField>
        <FormField label="Date of incident" htmlFor="i-date" error={errors.occurred_on?.message} required>
          <Input type="date" max={today} {...fieldAria("i-date", errors.occurred_on?.message)} {...form.register("occurred_on")} />
        </FormField>
        <FormField label="Where did it happen?" htmlFor="i-loc" error={errors.location?.message}>
          <Input list="incident-locs" placeholder="Classroom, lab, office…" {...fieldAria("i-loc", errors.location?.message)} {...form.register("location")} />
          <datalist id="incident-locs">{CAMPUS_LOCATIONS.map((l) => <option key={l.label} value={l.label} />)}</datalist>
        </FormField>
        <FormField label="Course, class or activity" htmlFor="i-ctx" error={errors.context?.message} className="sm:col-span-2" hint="e.g. 22CSE301 lecture, lab session, project review">
          <Input {...fieldAria("i-ctx", errors.context?.message)} {...form.register("context")} />
        </FormField>
        <FormField label="Short summary" htmlFor="i-title" error={errors.title?.message} required className="sm:col-span-2">
          <Input {...fieldAria("i-title", errors.title?.message)} {...form.register("title")} />
        </FormField>
        <FormField label="What happened?" htmlFor="i-desc" error={errors.description?.message} required className="sm:col-span-2" hint="Describe the facts in order: what was said or done, by whom, and when. Stick to what you saw or experienced.">
          <Textarea rows={6} {...fieldAria("i-desc", errors.description?.message)} {...form.register("description")} />
        </FormField>
        <FormField label="Witnesses (optional)" htmlFor="i-wit" error={errors.witnesses?.message} className="sm:col-span-2" hint="People who saw the incident and could support your account.">
          <Textarea rows={2} {...fieldAria("i-wit", errors.witnesses?.message)} {...form.register("witnesses")} />
        </FormField>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <p className="mb-1 text-sm font-medium">Evidence (optional)</p>
        <p className="mb-3 text-xs text-muted-foreground">Screenshots or photos. Only you and the department&apos;s reviewers can view them.</p>
        <div className="flex flex-wrap gap-3">
          {photos.length < 3 && <ImageUpload key={photos.length} bucket="incident-evidence" userId={userId} onUploaded={(p) => setPhotos((x) => [...x, p])} label="Add image" />}
          {photos.length > 0 && <span className="self-center text-xs text-muted-foreground">{photos.length} image{photos.length > 1 ? "s" : ""} attached</span>}
        </div>
      </section>

      <IncidentDisclaimer />

      <div className="space-y-1.5">
        <label className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" aria-invalid={errors.declaration ? true : undefined} aria-describedby="i-decl-error" {...form.register("declaration")} />
          <span>{DECLARATION}</span>
        </label>
        {errors.declaration && <p id="i-decl-error" role="alert" className="text-xs text-destructive">{errors.declaration.message}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending} className="h-9 px-4">{pending && <LoaderCircle className="animate-spin" />} Submit report</Button>
      </div>
    </form>
  );
}
