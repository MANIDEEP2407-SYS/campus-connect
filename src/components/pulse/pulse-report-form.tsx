"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Crosshair, LoaderCircle, MapPin, ShieldAlert, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, fieldAria, selectClass } from "@/components/common/form-field";
import { ImageUpload } from "@/components/common/image-upload";
import { CampusMap } from "@/components/pulse/campus-map";
import { PulseStatusBadge } from "@/components/pulse/pulse-badges";
import { confirmPulseReport, submitPulseReport, type SimilarReport } from "@/lib/actions/pulse";
import { pulseReportSchema } from "@/lib/validation";
import { CATEGORY_META, PULSE_CATEGORIES, PULSE_SEVERITIES, SAFETY_NOTICE, SEVERITY_META, isSafetyCategory, type PulseStatus } from "@/lib/pulse";
import { CAMPUS_LOCATIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Values = z.input<typeof pulseReportSchema>;

export function PulseReportForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [photos, setPhotos] = useState<string[]>([]);
  const [similar, setSimilar] = useState<SimilarReport[] | null>(null);
  const [locating, setLocating] = useState(false);
  const form = useForm<Values, unknown, z.output<typeof pulseReportSchema>>({
    resolver: zodResolver(pulseReportSchema),
    defaultValues: { category: "maintenance_infrastructure", subcategory: "", title: "", description: "", severity: "medium", location_label: "", lat: null, lng: null },
  });
  const { errors } = form.formState;
  const category = form.watch("category");
  const lat = form.watch("lat");
  const lng = form.watch("lng");
  const safety = isSafetyCategory(category);

  const setPoint = (la: number, ln: number, label?: string) => {
    form.setValue("lat", la, { shouldValidate: true });
    form.setValue("lng", ln, { shouldValidate: true });
    if (label) form.setValue("location_label", label, { shouldValidate: true });
  };

  const submit = (values: z.output<typeof pulseReportSchema>, force = false) =>
    start(async () => {
      const res = await submitPulseReport({ ...values, force, attachmentPaths: photos });
      if (!res.ok) return void toast.error(res.error);
      if (!res.data.id) {
        setSimilar(res.data.similar);
        return;
      }
      toast.success(res.message);
      router.push(`/pulse/${res.data.id}`);
    });

  return (
    <>
      <form noValidate onSubmit={form.handleSubmit((v) => submit(v))} className="space-y-6">
        <fieldset className="rounded-xl border bg-card p-5">
          <legend className="px-1 text-sm font-semibold">What kind of issue?</legend>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Category">
                {PULSE_CATEGORIES.map((c) => (
                  <label key={c} className={cn("flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50", field.value === c && "border-primary bg-primary/5")}>
                    <input type="radio" name="category" value={c} checked={field.value === c} onChange={() => { field.onChange(c); form.setValue("subcategory", ""); if (isSafetyCategory(c) && form.getValues("severity") === "low") form.setValue("severity", "high"); }} className="sr-only" />
                    <span className="text-xl" aria-hidden>{CATEGORY_META[c].emoji}</span>
                    <span className="font-medium leading-tight">{CATEGORY_META[c].label}</span>
                  </label>
                ))}
              </div>
            )}
          />
          {safety && (
            <div role="note" className="mt-4 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <p><strong className="text-warning">Safety first.</strong> {SAFETY_NOTICE}</p>
            </div>
          )}
        </fieldset>

        <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
          {CATEGORY_META[category].subcategories.length > 0 && (
            <FormField label="Type" htmlFor="p-sub">
              <select className={selectClass} {...fieldAria("p-sub")} {...form.register("subcategory")}>
                <option value="">Select…</option>
                {CATEGORY_META[category].subcategories.map((s) => <option key={s}>{s}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="Severity" htmlFor="p-sev" hint={safety ? "Safety reports are prioritised for security review." : "How urgent is this?"}>
            <select className={selectClass} {...fieldAria("p-sev")} {...form.register("severity")}>
              {PULSE_SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
            </select>
          </FormField>
          <FormField label="Short title" htmlFor="p-title" error={errors.title?.message} required className="sm:col-span-2">
            <Input placeholder={safety ? "e.g. Snake seen near library walkway" : "e.g. No water in 2nd floor washroom"} {...fieldAria("p-title", errors.title?.message)} {...form.register("title")} />
          </FormField>
          <FormField label="Details" htmlFor="p-desc" error={errors.description?.message} required className="sm:col-span-2" hint="What did you observe and when? Don't include personal information about others.">
            <Textarea rows={4} {...fieldAria("p-desc", errors.description?.message)} {...form.register("description")} />
          </FormField>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Where?" htmlFor="p-loc" error={errors.location_label?.message} required className="min-w-56 flex-1">
              <Input list="campus-locs" placeholder="Building, floor or landmark" {...fieldAria("p-loc", errors.location_label?.message)} {...form.register("location_label", {
                onChange: (e) => {
                  const preset = CAMPUS_LOCATIONS.find((l) => l.label === e.target.value);
                  if (preset) setPoint(preset.lat, preset.lng);
                },
              })} />
              <datalist id="campus-locs">{CAMPUS_LOCATIONS.map((l) => <option key={l.label} value={l.label} />)}</datalist>
            </FormField>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={locating}
              onClick={() => {
                if (!navigator.geolocation) return void toast.error("Location isn't available in this browser.");
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setLocating(false);
                    const { latitude, longitude } = pos.coords;
                    if (latitude < 10.88 || latitude > 10.93 || longitude < 76.88 || longitude > 76.93) return void toast.error("You appear to be outside campus — pick the spot on the map instead.");
                    setPoint(Number(latitude.toFixed(6)), Number(longitude.toFixed(6)));
                  },
                  () => {
                    setLocating(false);
                    toast.error("Couldn't get your location. Pick it on the map instead.");
                  },
                  { enableHighAccuracy: true, timeout: 8000 },
                );
              }}
            >
              {locating ? <LoaderCircle className="animate-spin" /> : <Crosshair />} Use my location
            </Button>
          </div>
          <CampusMap points={[]} picked={lat != null && lng != null ? [lat, lng] : null} onPick={(la, ln) => setPoint(la, ln)} height={300} zoom={16} />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {lat != null && lng != null ? `Pin set. The public map shows it rounded to ~100 m; responders see the exact point.` : "Optional: click the map to drop a pin. Pins help detect duplicate reports."}
            {lat != null && (
              <button type="button" className="ml-1 text-primary hover:underline" onClick={() => { form.setValue("lat", null); form.setValue("lng", null); }}>Clear</button>
            )}
          </p>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <p className="mb-1 text-sm font-medium">Photos (optional)</p>
          <p className="mb-3 text-xs text-muted-foreground">Never required. Only responders can view them. {safety && "Do not get closer to take a photo."}</p>
          <div className="flex flex-wrap gap-3">
            {photos.length < 3 && (
              <ImageUpload key={photos.length} bucket="pulse-evidence" userId={userId} onUploaded={(p) => setPhotos((x) => [...x, p])} label="Add photo" />
            )}
            {photos.length > 0 && <span className="self-center text-xs text-muted-foreground">{photos.length} photo{photos.length > 1 ? "s" : ""} attached</span>}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={pending} className="h-9 px-4">{pending && <LoaderCircle className="animate-spin" />} Submit report</Button>
        </div>
      </form>

      <Dialog open={similar !== null} onOpenChange={(o) => !o && setSimilar(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Is this already reported?</DialogTitle>
            <DialogDescription>We found active reports of the same type nearby. Confirming an existing report raises its priority and avoids duplicate alerts.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {similar?.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.ref_code} · {s.location_label} · ~{s.distance_m} m away</p>
                  <div className="mt-1"><PulseStatusBadge status={s.status as PulseStatus} /></div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const res = await confirmPulseReport({ reportId: s.id });
                    if (!res.ok && !res.error.includes("submitted this")) return void toast.error(res.error);
                    toast.success(res.ok ? res.message : "This is your own report");
                    router.push(`/pulse/${s.id}`);
                  }}
                >
                  <ThumbsUp /> Same issue
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimilar(null)}>Back</Button>
            <Button disabled={pending} onClick={form.handleSubmit((v) => { setSimilar(null); submit(v, true); })}>
              {pending && <LoaderCircle className="animate-spin" />} It&apos;s different — submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
