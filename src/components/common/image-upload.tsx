"use client";

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { getBrowserClient } from "@/lib/supabase/client";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/validation";
import { Button } from "@/components/ui/button";

export type Bucket = "avatars" | "post-images" | "pulse-evidence" | "lostfound";

/**
 * Uploads an image directly to Supabase Storage under `<userId>/…` (enforced by storage RLS)
 * and reports the object path. Type and size are checked here and again by bucket limits.
 */
export function ImageUpload({
  bucket,
  userId,
  onUploaded,
  onRemoved,
  label = "Add photo",
  hint,
}: {
  bucket: Bucket;
  userId: string;
  onUploaded: (path: string, publicUrl: string | null) => void;
  onRemoved?: () => void;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handle(file: File) {
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return toast.error("Use a PNG, JPEG or WebP image.");
    if (file.size > MAX_IMAGE_BYTES) return toast.error("Images must be under 5 MB.");
    setBusy(true);
    const ext = file.type.split("/")[1]!.replace("jpeg", "jpg");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const supabase = getBrowserClient();
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (error) return toast.error(`Upload failed: ${error.message}`);
    setPreview(URL.createObjectURL(file));
    const isPublic = bucket === "avatars" || bucket === "post-images";
    onUploaded(path, isPublic ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null);
  }

  return (
    <div className="flex items-center gap-3">
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected upload preview" className="size-16 rounded-lg object-cover ring-1 ring-border" />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onRemoved?.();
            }}
            className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-popover ring-1 ring-border"
            aria-label="Remove photo"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
          {label}
        </Button>
      )}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
