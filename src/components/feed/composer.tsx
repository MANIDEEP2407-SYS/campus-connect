"use client";

import { useId, useState, useTransition } from "react";
import { LoaderCircle, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/common/user-avatar";
import { ImageUpload } from "@/components/common/image-upload";
import { createPost } from "@/lib/actions/social";
import { useDraftGuard } from "@/components/shield/draft-guard";
import Link from "next/link";

export function Composer({
  userId,
  name,
  avatar,
  clubs = [],
  fixedClubId,
  placeholder = "Share a project, achievement or question with campus…",
}: {
  userId: string;
  name: string;
  avatar: string | null;
  clubs?: { id: string; name: string }[];
  fixedClubId?: string;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string>(fixedClubId ?? "");
  const [uploadKey, setUploadKey] = useState(0);
  const [pending, start] = useTransition();
  const { guard, checking, dialog } = useDraftGuard();
  const composerId = useId();

  const publish = () =>
    start(async () => {
      const res = await createPost({ body, image_path: image, club_id: clubId || null, is_announcement: Boolean(clubId) });
      if (!res.ok) return void toast.error(res.error);
      toast.success(clubId ? "Announcement published" : "Posted");
      setBody("");
      setImage(null);
      setUploadKey((k) => k + 1);
    });
  const submit = () => guard(body, publish);

  return (
    <div className="rounded-xl border bg-card p-4">
      {dialog}
      <div className="flex gap-3">
        <UserAvatar name={name} src={avatar} />
        <div className="min-w-0 flex-1 space-y-3">
          <label htmlFor={composerId} className="sr-only">New post</label>
          <Textarea
            id={composerId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={body ? 4 : 2}
            placeholder={placeholder}
            className="resize-none border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) submit();
            }}
          />
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <ImageUpload key={uploadKey} bucket="post-images" userId={userId} onUploaded={(p) => setImage(p)} onRemoved={() => setImage(null)} label="Photo" />
            {clubs.length > 0 && !fixedClubId && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Megaphone className="size-3.5" />
                <span className="sr-only">Post as</span>
                <select value={clubId} onChange={(e) => setClubId(e.target.value)} className="h-7 rounded-md border bg-transparent px-1.5 text-xs [&>option]:bg-popover">
                  <option value="">Personal post</option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>Announcement · {c.name}</option>
                  ))}
                </select>
              </label>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{body.length}/2000</span>
            <Button onClick={submit} disabled={pending || checking || !body.trim()} size="sm" className="px-3">
              {(pending || checking) && <LoaderCircle className="animate-spin" />} {clubId ? "Announce" : "Post"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Posts are checked by <Link href="/safety" className="text-primary hover:underline">CampusShield</Link>, an AI-assisted safety system — moderators, not the AI, make decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
