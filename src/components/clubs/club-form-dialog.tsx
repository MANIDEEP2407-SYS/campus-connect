"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField, fieldAria, selectClass } from "@/components/common/form-field";
import { CoverField } from "@/components/common/cover-field";
import { createClub, updateClub } from "@/lib/actions/clubs";
import { clubSchema } from "@/lib/validation";
import { CLUB_CATEGORIES } from "@/lib/constants";

type Values = z.input<typeof clubSchema>;

export function ClubFormDialog({ existing }: { existing?: Values & { id: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const uid = useId();
  const fid = (s: string) => `${uid}-${s}`;
  const [pending, start] = useTransition();
  const form = useForm<Values, unknown, z.output<typeof clubSchema>>({
    resolver: zodResolver(clubSchema),
    defaultValues: existing ?? { name: "", slug: "", tagline: "", description: "", category: "Technical", logo: "✨", membership_policy: "approval", requirements: "", cover_url: "" },
  });
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={existing ? "outline" : "default"} />}>{existing ? "Edit club" : <><Plus /> Start a club</>}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit club" : "Start a student club"}</DialogTitle>
          <DialogDescription>New clubs are listed as student-created. Platform administrators verify official clubs.</DialogDescription>
        </DialogHeader>
        <form
          id={fid("club-form")}
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            start(async () => {
              const res = existing ? await updateClub({ ...values, clubId: existing.id }) : await createClub(values);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              setOpen(false);
              if (!existing && res.data && typeof res.data === "object" && "slug" in res.data) router.push(`/clubs/${res.data.slug}`);
            }),
          )}
        >
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <FormField label="Logo" htmlFor={fid("club-logo")} error={errors.logo?.message}>
              <Input className="text-center text-lg" maxLength={8} {...fieldAria(fid("club-logo"))} {...form.register("logo")} />
            </FormField>
            <FormField label="Name" htmlFor={fid("club-name")} error={errors.name?.message} required>
              <Input {...fieldAria(fid("club-name"), errors.name?.message)} {...form.register("name", {
                onChange: (e) => !existing && form.setValue("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)),
              })} />
            </FormField>
          </div>
          {!existing && (
            <FormField label="URL" htmlFor={fid("club-slug")} error={errors.slug?.message} hint="/clubs/your-club">
              <Input {...fieldAria(fid("club-slug"), errors.slug?.message)} {...form.register("slug")} />
            </FormField>
          )}
          <FormField label="Tagline" htmlFor={fid("club-tag")} error={errors.tagline?.message}>
            <Input maxLength={140} {...fieldAria(fid("club-tag"))} {...form.register("tagline")} />
          </FormField>
          <FormField label="About" htmlFor={fid("club-desc")} error={errors.description?.message}>
            <Textarea rows={4} {...fieldAria(fid("club-desc"))} {...form.register("description")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor={fid("club-cat2")}>
              <select className={selectClass} {...fieldAria(fid("club-cat2"))} {...form.register("category")}>
                {CLUB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Membership" htmlFor={fid("club-policy")}>
              <select className={selectClass} {...fieldAria(fid("club-policy"))} {...form.register("membership_policy")}>
                <option value="approval">Coordinator approval</option>
                <option value="open">Open — anyone can join</option>
              </select>
            </FormField>
          </div>
          <FormField label="Membership requirements" htmlFor={fid("club-req")} error={errors.requirements?.message}>
            <Textarea rows={2} maxLength={500} {...fieldAria(fid("club-req"))} {...form.register("requirements")} placeholder="e.g. Open to all years; attend one orientation session" />
          </FormField>
          <CoverField value={form.watch("cover_url")} onChange={(url) => form.setValue("cover_url", url, { shouldDirty: true })} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form={fid("club-form")} disabled={pending}>{pending && <LoaderCircle className="animate-spin" />} {existing ? "Save" : "Create club"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
