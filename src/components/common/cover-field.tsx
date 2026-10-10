"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/common/image-upload";
import { CoverImage } from "@/components/common/cover-image";

/** Cover photo picker: uploads to the public post-images bucket and reports its public URL. */
export function CoverField({ value, onChange }: { value: string | null | undefined; onChange: (url: string) => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    getBrowserClient().auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Cover photo</p>
      {value && (
        <div className="relative">
          <CoverImage src={value} width={800} className="h-28 w-full rounded-lg ring-1 ring-border" />
          <button type="button" onClick={() => onChange("")} aria-label="Remove cover photo"
            className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-popover/90 ring-1 ring-border hover:bg-popover">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {userId && (
        <ImageUpload
          key={value ?? ""}
          bucket="post-images"
          userId={userId}
          label={value ? "Replace cover" : "Add cover photo"}
          hint="Wide images work best · PNG, JPEG or WebP up to 5 MB"
          onUploaded={(_, url) => url && onChange(url)}
        />
      )}
    </div>
  );
}
