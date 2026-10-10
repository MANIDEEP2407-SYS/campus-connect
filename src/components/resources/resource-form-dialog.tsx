"use client";

import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField, fieldAria, selectClass } from "@/components/common/form-field";
import { TagInput } from "@/components/common/tag-input";
import { createResource } from "@/lib/actions/research";
import { resourceSchema } from "@/lib/validation";
import { DEPARTMENTS } from "@/lib/constants";

type Values = z.input<typeof resourceSchema>;

export function ResourceFormDialog() {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const fid = (s: string) => `${uid}-${s}`;
  const [pending, start] = useTransition();
  const form = useForm<Values, unknown, z.output<typeof resourceSchema>>({
    resolver: zodResolver(resourceSchema),
    defaultValues: { kind: "material", title: "", description: "", course_code: "", department: "", url: "", source_label: "", tags: [] },
  });
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}><Plus /> Share a resource</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share a resource</DialogTitle>
          <DialogDescription>Share only material you&apos;re allowed to share. It will be labelled as student-contributed.</DialogDescription>
        </DialogHeader>
        <form
          id={fid("res-form")}
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            start(async () => {
              const res = await createResource(values);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              form.reset();
              setOpen(false);
            }),
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type" htmlFor={fid("rk")}>
              <select className={selectClass} {...fieldAria(fid("rk"))} {...form.register("kind")}>
                <option value="material">Learning material</option>
                <option value="link">Useful link</option>
                <option value="elective">Elective info</option>
                <option value="course">Course info</option>
              </select>
            </FormField>
            <FormField label="Course code" htmlFor={fid("rc")} error={errors.course_code?.message}>
              <Input {...fieldAria(fid("rc"))} {...form.register("course_code")} placeholder="e.g. 23CSE301" />
            </FormField>
          </div>
          <FormField label="Title" htmlFor={fid("rt")} error={errors.title?.message} required>
            <Input {...fieldAria(fid("rt"), errors.title?.message)} {...form.register("title")} />
          </FormField>
          <FormField label="Description" htmlFor={fid("rd")} error={errors.description?.message}>
            <Textarea rows={3} {...fieldAria(fid("rd"))} {...form.register("description")} />
          </FormField>
          <FormField label="Link" htmlFor={fid("ru")} error={errors.url?.message} hint="https:// links only">
            <Input type="url" {...fieldAria(fid("ru"), errors.url?.message)} {...form.register("url")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Department" htmlFor={fid("rdep")}>
              <select className={selectClass} {...fieldAria(fid("rdep"))} {...form.register("department")}>
                <option value="">—</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="Source" htmlFor={fid("rsrc")} hint="Where does this come from?">
              <Input {...fieldAria(fid("rsrc"))} {...form.register("source_label")} />
            </FormField>
          </div>
          <FormField label="Tags" htmlFor={fid("rtags")}>
            <Controller control={form.control} name="tags" render={({ field }) => <TagInput id={fid("rtags")} value={field.value} onChange={field.onChange} max={10} />} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form={fid("res-form")} disabled={pending}>{pending && <LoaderCircle className="animate-spin" />} Share</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
