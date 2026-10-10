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
import { createServer, updateServer } from "@/lib/actions/communities";
import { serverSchema } from "@/lib/validation";
import { SERVER_CATEGORIES } from "@/lib/constants";

type Values = z.input<typeof serverSchema>;
const ICONS = ["💬", "🤖", "🔐", "🧬", "🎸", "📷", "♟️", "⚽", "🚀", "🌱", "📚", "🎨", "💡", "🧪", "🎭", "🛰️"];

export function CreateServerDialog({ existing }: { existing?: Values & { id: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const uid = useId();
  const fid = (s: string) => `${uid}-${s}`;
  const [pending, start] = useTransition();
  const form = useForm<Values, unknown, z.output<typeof serverSchema>>({
    resolver: zodResolver(serverSchema),
    defaultValues: existing ?? { name: "", description: "", icon: "💬", category: "General", visibility: "public", cover_url: "" },
  });
  const { errors } = form.formState;
  const icon = form.watch("icon");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={existing ? "outline" : "default"} />}>
        {existing ? "Edit details" : <><Plus /> Create community</>}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit community" : "Create a community"}</DialogTitle>
          <DialogDescription>You&apos;ll be the owner and can appoint moderators. A #general channel is created automatically.</DialogDescription>
        </DialogHeader>
        <form
          id={fid("server-form")}
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            start(async () => {
              if (existing) {
                const res = await updateServer({ ...values, serverId: existing.id });
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.message);
                setOpen(false);
                return;
              }
              const res = await createServer(values);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              setOpen(false);
              router.push(res.data.channelId ? `/communities/${res.data.id}/${res.data.channelId}` : `/communities/${res.data.id}`);
            }),
          )}
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Icon</legend>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((i) => (
                <button key={i} type="button" onClick={() => form.setValue("icon", i)} aria-pressed={icon === i} aria-label={`Icon ${i}`}
                  className={`grid size-9 place-items-center rounded-lg border text-lg ${icon === i ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>
                  {i}
                </button>
              ))}
            </div>
          </fieldset>
          <FormField label="Name" htmlFor={fid("sname")} error={errors.name?.message} required>
            <Input {...fieldAria(fid("sname"), errors.name?.message)} {...form.register("name")} placeholder="e.g. Robotics Builders" />
          </FormField>
          <FormField label="Description" htmlFor={fid("sdesc")} error={errors.description?.message}>
            <Textarea rows={3} {...fieldAria(fid("sdesc"))} {...form.register("description")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor={fid("scat")}>
              <select className={selectClass} {...fieldAria(fid("scat"))} {...form.register("category")}>
                {SERVER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Visibility" htmlFor={fid("svis")} hint="Private: people must request access or use an invite.">
              <select className={selectClass} {...fieldAria(fid("svis"))} {...form.register("visibility")}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </FormField>
          </div>
          <CoverField value={form.watch("cover_url")} onChange={(url) => form.setValue("cover_url", url, { shouldDirty: true })} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form={fid("server-form")} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />} {existing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
