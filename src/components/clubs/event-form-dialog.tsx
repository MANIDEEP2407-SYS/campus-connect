"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField, fieldAria, selectClass } from "@/components/common/form-field";
import { createEvent, updateEvent } from "@/lib/actions/clubs";
import { eventSchema } from "@/lib/validation";
import { CAMPUS_LOCATIONS, EVENT_CATEGORIES } from "@/lib/constants";
import { toLocalInput } from "@/lib/time";

type Values = z.input<typeof eventSchema>;

/** `datetime-local` values are in the browser's timezone; convert to ISO here so the server never guesses. */
const toIso = (local: string | null | undefined) => (local ? new Date(local).toISOString() : null);

/** `existing` carries ISO timestamps; they're converted to the viewer's local time here, in the browser. */
export function EventFormDialog({ clubId, existing }: { clubId?: string; existing?: Values & { id: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const uid = useId();
  const fid = (s: string) => `${uid}-${s}`;
  const [pending, start] = useTransition();
  const form = useForm<Values, unknown, z.output<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: existing
      ? { ...existing, starts_at: toLocalInput(existing.starts_at), ends_at: toLocalInput(existing.ends_at), registration_deadline: toLocalInput(existing.registration_deadline) }
      : { title: "", description: "", category: "Workshop", venue: "", starts_at: "", ends_at: "", capacity: "", registration_deadline: "", club_id: clubId ?? null },
  });
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={existing ? "outline" : "default"} />}>{existing ? "Edit event" : <><CalendarPlus /> New event</>}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit event" : clubId ? "Create club event" : "Create a community event"}</DialogTitle>
          <DialogDescription>
            {clubId ? "Published under your club. Registrants are notified of changes." : "Events without a club are labelled as community (unofficial) events."}
          </DialogDescription>
        </DialogHeader>
        <form
          id={fid("event-form")}
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            start(async () => {
              const payload = { ...values, starts_at: toIso(values.starts_at)!, ends_at: toIso(values.ends_at)!, registration_deadline: toIso(values.registration_deadline) };
              const res = existing ? await updateEvent({ eventId: existing.id, values: payload }) : await createEvent(payload);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              setOpen(false);
              if (!existing && res.data && typeof res.data === "object" && "id" in res.data) router.push(`/events/${res.data.id}`);
            }),
          )}
        >
          <FormField label="Title" htmlFor={fid("ev-title")} error={errors.title?.message} required>
            <Input {...fieldAria(fid("ev-title"), errors.title?.message)} {...form.register("title")} />
          </FormField>
          <FormField label="Description" htmlFor={fid("ev-desc")} error={errors.description?.message}>
            <Textarea rows={4} {...fieldAria(fid("ev-desc"))} {...form.register("description")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor={fid("ev-cat")}>
              <select className={selectClass} {...fieldAria(fid("ev-cat"))} {...form.register("category")}>
                {EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Venue" htmlFor={fid("ev-venue")} error={errors.venue?.message} required>
              <Input list={fid("ev-venues")} {...fieldAria(fid("ev-venue"), errors.venue?.message)} {...form.register("venue")} />
              <datalist id={fid("ev-venues")}>{CAMPUS_LOCATIONS.map((l) => <option key={l.label} value={l.label} />)}</datalist>
            </FormField>
            <FormField label="Starts" htmlFor={fid("ev-start")} error={errors.starts_at?.message} required>
              <Input type="datetime-local" {...fieldAria(fid("ev-start"), errors.starts_at?.message)} {...form.register("starts_at")} />
            </FormField>
            <FormField label="Ends" htmlFor={fid("ev-end")} error={errors.ends_at?.message} required>
              <Input type="datetime-local" {...fieldAria(fid("ev-end"), errors.ends_at?.message)} {...form.register("ends_at")} />
            </FormField>
            <FormField label="Capacity" htmlFor={fid("ev-cap")} error={errors.capacity?.message} hint="Leave empty for unlimited">
              <Input type="number" min={1} {...fieldAria(fid("ev-cap"), errors.capacity?.message)} {...form.register("capacity")} />
            </FormField>
            <FormField label="Registration deadline" htmlFor={fid("ev-dl")} error={errors.registration_deadline?.message} hint="Defaults to the start time">
              <Input type="datetime-local" {...fieldAria(fid("ev-dl"), errors.registration_deadline?.message)} {...form.register("registration_deadline")} />
            </FormField>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form={fid("event-form")} disabled={pending}>{pending && <LoaderCircle className="animate-spin" />} {existing ? "Save changes" : "Publish event"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
