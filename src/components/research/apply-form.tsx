"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/common/form-field";
import { TagInput } from "@/components/common/tag-input";
import { applyToProject } from "@/lib/actions/research";

export function ApplyForm({ projectId, defaultSkills }: { projectId: string; defaultSkills: string[] }) {
  const [statement, setStatement] = useState("");
  const [skills, setSkills] = useState(defaultSkills.slice(0, 8));
  const [availability, setAvailability] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  return (
    <section className="space-y-4 rounded-xl border border-primary/30 bg-card p-5">
      <h2 className="font-semibold">Express interest</h2>
      <FormField label="Why are you a good fit?" htmlFor="stmt" error={error} hint={`${statement.trim().length}/30 characters minimum`}>
        <Textarea id="stmt" rows={5} maxLength={2000} value={statement} onChange={(e) => setStatement(e.target.value)} />
      </FormField>
      <FormField label="Relevant skills" htmlFor="askills">
        <TagInput id="askills" value={skills} onChange={setSkills} max={15} />
      </FormField>
      <FormField label="Availability" htmlFor="avail">
        <Input id="avail" maxLength={120} value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="e.g. 8 hrs/week from November" />
      </FormField>
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await applyToProject({ project_id: projectId, statement, relevant_skills: skills, availability });
            if (!res.ok) {
              setError(res.fieldErrors?.statement?.[0]);
              return void toast.error(res.error);
            }
            toast.success(res.message);
          })
        }
      >
        {pending && <LoaderCircle className="animate-spin" />} Submit application
      </Button>
    </section>
  );
}
