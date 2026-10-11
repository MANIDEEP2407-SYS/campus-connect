"use client";

import { useId, useState, useTransition } from "react";
import { Eye, LoaderCircle, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/common/user-avatar";
import { ImageUpload } from "@/components/common/image-upload";
import { createPost } from "@/lib/actions/social";
import { useDraftGuard } from "@/components/shield/draft-guard";
import { TagInput } from "@/components/common/tag-input";
import { AUDIENCE_META, POST_AUDIENCES, type PostAudience } from "@/lib/audience";
import { INTEREST_SUGGESTIONS } from "@/lib/constants";
import Link from "next/link";

export function Composer({
  userId,
  name,
  avatar,
  clubs = [],
  memberClubs = [],
  hasDepartment = false,
  fixedClubId,
  placeholder = "Share a project, achievement or question with campus…",
}: {
  userId: string;
  name: string;
  avatar: string | null;
  clubs?: { id: string; name: string }[];
  /** Clubs the author is an approved member of (for club-only audiences). */
  memberClubs?: { id: string; name: string }[];
  hasDepartment?: boolean;
  fixedClubId?: string;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string>(fixedClubId ?? "");
  const [uploadKey, setUploadKey] = useState(0);
  const [audience, setAudience] = useState<PostAudience>("campus");
  const [audienceClubId, setAudienceClubId] = useState(fixedClubId ?? memberClubs[0]?.id ?? "");
  const [audienceTags, setAudienceTags] = useState<string[]>([]);
  const audiences = POST_AUDIENCES.filter((a) => (a !== "club" || memberClubs.length > 0 || fixedClubId) && (a !== "department" || hasDepartment));
  const audienceIncomplete = (audience === "club" && !audienceClubId) || (audience === "interests" && audienceTags.length === 0);
  const [pending, start] = useTransition();
  const { guard, checking, dialog } = useDraftGuard();
  const composerId = useId();

  const publish = () =>
    start(async () => {
      const res = await createPost({
        body, image_path: image, club_id: clubId || null, is_announcement: Boolean(clubId),
        audience, audience_club_id: audience === "club" ? audienceClubId : null, audience_tags: audience === "interests" ? audienceTags : [],
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(clubId ? "Announcement published" : "Posted");
      setBody("");
      setImage(null);
      setUploadKey((k) => k + 1);
      setAudience("campus");
      setAudienceTags([]);
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
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title={AUDIENCE_META[audience].hint}>
              <Eye className="size-3.5" />
              <span className="sr-only">Who can see this</span>
              <select value={audience} onChange={(e) => setAudience(e.target.value as PostAudience)} className="h-7 rounded-md border bg-transparent px-1.5 text-xs [&>option]:bg-popover">
                {audiences.map((a) => <option key={a} value={a}>{AUDIENCE_META[a].label}</option>)}
              </select>
            </label>
            {audience === "club" && !fixedClubId && (
              <label className="text-xs">
                <span className="sr-only">Club</span>
                <select value={audienceClubId} onChange={(e) => setAudienceClubId(e.target.value)} className="h-7 rounded-md border bg-transparent px-1.5 text-xs [&>option]:bg-popover">
                  {memberClubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{body.length}/2000</span>
            <Button onClick={submit} disabled={pending || checking || !body.trim() || audienceIncomplete} size="sm" className="px-3">
              {(pending || checking) && <LoaderCircle className="animate-spin" />} {clubId ? "Announce" : "Post"}
            </Button>
          </div>
          {audience === "interests" && (
            <div className="space-y-1">
              <TagInput value={audienceTags} onChange={setAudienceTags} suggestions={INTEREST_SUGGESTIONS} max={10} placeholder="Topics, e.g. Robotics — press Enter" />
              <p className="text-[11px] text-muted-foreground">Only people with at least one of these interests on their profile will see this post.</p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Posts are checked by <Link href="/safety" className="text-primary hover:underline">CampusShield</Link>, an AI-assisted safety system — moderators, not the AI, make decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
