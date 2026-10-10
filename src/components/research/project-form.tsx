"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, fieldAria, selectClass } from "@/components/common/form-field";
import { TagInput } from "@/components/common/tag-input";
import { createProject } from "@/lib/actions/research";
import { projectSchema } from "@/lib/validation";
import { DEPARTMENTS, RESEARCH_AREAS } from "@/lib/constants";

type Values = z.input<typeof projectSchema>;

export function ProjectForm({ kind, canConsult }: { kind: "research" | "consultancy"; canConsult: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<Values, unknown, z.output<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: { kind, title: "", abstract: "", description: "", area: RESEARCH_AREAS[0], department: "", required_skills: [], commitment: "6–8 hours/week, one semester", positions: 2, budget_note: "" },
  });
  const { errors } = form.formState;
  const k = form.watch("kind");

  return (
    <form
      noValidate
      className="space-y-5 rounded-xl border bg-card p-5"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = await createProject(values);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.push(`/research/${res.data.id}`);
        }),
      )}
    >
      {canConsult && (
        <FormField label="Type" htmlFor="pk">
          <select className={selectClass} {...fieldAria("pk")} {...form.register("kind")}>
            <option value="research">Research project</option>
            <option value="consultancy">Consultancy</option>
          </select>
        </FormField>
      )}
      <FormField label="Title" htmlFor="pt" error={errors.title?.message} required>
        <Input {...fieldAria("pt", errors.title?.message)} {...form.register("title")} />
      </FormField>
      <FormField label="Abstract" htmlFor="pa" error={errors.abstract?.message} required hint="Shown in listings (20–600 characters).">
        <Textarea rows={3} {...fieldAria("pa", errors.abstract?.message)} {...form.register("abstract")} />
      </FormField>
      <FormField label="Full description" htmlFor="pd" error={errors.description?.message}>
        <Textarea rows={6} {...fieldAria("pd")} {...form.register("description")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Area" htmlFor="parea">
          <select className={selectClass} {...fieldAria("parea")} {...form.register("area")}>
            {RESEARCH_AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </FormField>
        <FormField label="Department" htmlFor="pdep">
          <select className={selectClass} {...fieldAria("pdep")} {...form.register("department")}>
            <option value="">—</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </FormField>
        <FormField label="Commitment" htmlFor="pc" error={errors.commitment?.message} required>
          <Input {...fieldAria("pc", errors.commitment?.message)} {...form.register("commitment")} />
        </FormField>
        <FormField label="Open positions" htmlFor="pp" error={errors.positions?.message}>
          <Input type="number" min={1} max={50} {...fieldAria("pp", errors.positions?.message)} {...form.register("positions")} />
        </FormField>
      </div>
      <FormField label="Required skills" htmlFor="ps" error={errors.required_skills?.message}>
        <Controller control={form.control} name="required_skills" render={({ field }) => <TagInput id="ps" value={field.value} onChange={field.onChange} max={15} placeholder="e.g. Python, Signal processing" />} />
      </FormField>
      {k === "consultancy" && (
        <FormField label={<span className="flex items-center gap-1.5"><Lock className="size-3.5" /> Budget / agreement notes (restricted)</span>} htmlFor="pb" hint="Visible only to you and platform administrators.">
          <Textarea rows={2} {...fieldAria("pb")} {...form.register("budget_note")} />
        </FormField>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending} className="h-9 px-4">{pending && <LoaderCircle className="animate-spin" />} Publish</Button>
      </div>
    </form>
  );
}
