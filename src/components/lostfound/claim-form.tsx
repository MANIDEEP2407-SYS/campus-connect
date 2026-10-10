"use client";

import { useState, useTransition } from "react";
import { Lock, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField, selectClass } from "@/components/common/form-field";
import { submitClaim } from "@/lib/actions/lostfound";

export function ClaimForm({ itemId, myLostItems }: { itemId: string; myLostItems: { id: string; title: string }[] }) {
  const [details, setDetails] = useState("");
  const [lostItemId, setLostItemId] = useState(myLostItems[0]?.id ?? "");
  const [pending, start] = useTransition();
  return (
    <section className="space-y-4 rounded-xl border border-primary/30 bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Lock className="size-3.5" /> Is this yours? Claim it privately</h2>
        <p className="mt-1 text-xs text-muted-foreground">Only the finder and moderators see your claim. Describe details that aren&apos;t in the public listing — contents, marks, wallpaper, stickers.</p>
      </div>
      <FormField label="Distinguishing details" htmlFor="claim-details" hint="Don't include full ID, card or phone numbers.">
        <Textarea id="claim-details" rows={4} maxLength={1500} value={details} onChange={(e) => setDetails(e.target.value)} />
      </FormField>
      {myLostItems.length > 0 && (
        <FormField label="Link to your lost report (optional)" htmlFor="claim-link">
          <select id="claim-link" className={selectClass} value={lostItemId} onChange={(e) => setLostItemId(e.target.value)}>
            <option value="">None</option>
            {myLostItems.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </FormField>
      )}
      <Button
        className="w-full"
        disabled={pending || details.trim().length < 10}
        onClick={() =>
          start(async () => {
            const res = await submitClaim({ item_id: itemId, details, lost_item_id: lostItemId || null });
            if (res.ok) toast.success(res.message);
            else toast.error(res.error);
          })
        }
      >
        {pending && <LoaderCircle className="animate-spin" />} Submit private claim
      </Button>
    </section>
  );
}
