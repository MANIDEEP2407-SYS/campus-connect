"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, LoaderCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, fieldAria, selectClass } from "@/components/common/form-field";
import { ImageUpload } from "@/components/common/image-upload";
import { createLfItem } from "@/lib/actions/lostfound";
import { lfItemSchema } from "@/lib/validation";
import { LF_CATEGORIES, LF_CATEGORY_META } from "@/lib/lostfound";
import { CAMPUS_LOCATIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Values = z.input<typeof lfItemSchema>;

export function LfItemForm({ userId, kind }: { userId: string; kind: "lost" | "found" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const form = useForm<Values, unknown, z.output<typeof lfItemSchema>>({
    resolver: zodResolver(lfItemSchema),
    defaultValues: { kind, category: "other", title: "", description: "", location_label: "", occurred_on: today, contact_pref: "in_app", secret_details: "", image_path: null },
  });
  const { errors } = form.formState;
  const category = form.watch("category");
  const sensitive = LF_CATEGORY_META[category].sensitive;

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = await createLfItem(values);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.push(`/lost-found/${res.data.id}#matches`);
        }),
      )}
    >
      <fieldset className="rounded-xl border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">Category</legend>
        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Category">
              {LF_CATEGORIES.map((c) => (
                <label key={c} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50", field.value === c && "border-primary bg-primary/5")}>
                  <input type="radio" className="sr-only" name="category" value={c} checked={field.value === c} onChange={() => { field.onChange(c); if (LF_CATEGORY_META[c].sensitive) form.setValue("contact_pref", "security_office"); }} />
                  <span aria-hidden>{LF_CATEGORY_META[c].emoji}</span> {LF_CATEGORY_META[c].label}
                </label>
              ))}
            </div>
          )}
        />
        {sensitive && (
          <div role="note" className="mt-4 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
            <p>
              <strong className="text-warning">Sensitive item.</strong> Never post ID numbers, card numbers, phone numbers or serial numbers. {kind === "found" ? "Please hand ID cards, wallets and phones to the campus security office; " : ""}
              handovers for these items are coordinated through campus security, and photos are hidden from public listings.
            </p>
          </div>
        )}
      </fieldset>

      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <FormField label="Title" htmlFor="lf-title" error={errors.title?.message} required className="sm:col-span-2">
          <Input placeholder={kind === "lost" ? "e.g. Black backpack with laptop sleeve" : "e.g. Set of keys with red keychain"} {...fieldAria("lf-title", errors.title?.message)} {...form.register("title")} />
        </FormField>
        <FormField label="Public description" htmlFor="lf-desc" error={errors.description?.message} required className="sm:col-span-2" hint="General appearance only. Keep identifying details for the private field below.">
          <Textarea rows={4} {...fieldAria("lf-desc", errors.description?.message)} {...form.register("description")} />
        </FormField>
        <FormField label={kind === "lost" ? "Where did you lose it?" : "Where did you find it?"} htmlFor="lf-loc" error={errors.location_label?.message} required>
          <Input list="lf-loc-list" {...fieldAria("lf-loc", errors.location_label?.message)} {...form.register("location_label")} />
          <datalist id="lf-loc-list">{CAMPUS_LOCATIONS.map((l) => <option key={l.label} value={l.label} />)}</datalist>
        </FormField>
        <FormField label="Approximate date" htmlFor="lf-date" error={errors.occurred_on?.message} required>
          <Input type="date" max={today} {...fieldAria("lf-date", errors.occurred_on?.message)} {...form.register("occurred_on")} />
        </FormField>
        <FormField label="Preferred contact" htmlFor="lf-contact" hint={sensitive ? "Sensitive items always go through campus security." : undefined}>
          {/* Not `disabled`: RHF drops disabled values. The DB forces security_office for sensitive items anyway. */}
          <select className={selectClass} {...fieldAria("lf-contact")} {...form.register("contact_pref")}>
            <option value="in_app">Private in-app claim requests</option>
            <option value="security_office">Via campus security office</option>
          </select>
        </FormField>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <FormField
          label={<span className="flex items-center gap-1.5"><Lock className="size-3.5" /> Private verification details</span>}
          htmlFor="lf-secret"
          error={errors.secret_details?.message}
          hint={kind === "found" ? "Something only the real owner would know (contents, marks, stickers). Used to check claims — never shown publicly." : "Distinguishing details to help a finder verify it's yours. Visible only to you and moderators."}
        >
          <Textarea rows={3} {...fieldAria("lf-secret")} {...form.register("secret_details")} />
        </FormField>
        <div>
          <p className="mb-1 text-sm font-medium">Photo (optional)</p>
          <p className="mb-2 text-xs text-muted-foreground">{sensitive ? "Photos of sensitive items are visible only to you and moderators." : "Avoid capturing names, ID numbers or screens."}</p>
          <ImageUpload bucket="lostfound" userId={userId} onUploaded={(p) => form.setValue("image_path", p)} onRemoved={() => form.setValue("image_path", null)} label="Add photo" />
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending} className="h-9 px-4">{pending && <LoaderCircle className="animate-spin" />} Post listing</Button>
      </div>
    </form>
  );
}
