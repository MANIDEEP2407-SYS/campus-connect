"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { BadgeCheck, Bookmark, Ellipsis, Flag, Heart, LoaderCircle, Lock, Megaphone, MessageSquare, Pencil, Send, Trash } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/common/user-avatar";
import { FlagButton } from "@/components/common/flag-button";
import { ToneBadge } from "@/components/common/tone-badge";
import { addComment, deleteComment, deletePost, editPost, toggleBookmark, toggleLike } from "@/lib/actions/social";
import { useDraftGuard } from "@/components/shield/draft-guard";
import { ShieldAlert } from "lucide-react";
import { AFFILIATION_LABELS } from "@/lib/constants";
import type { FeedPost } from "@/lib/queries/feed";
import { cn } from "@/lib/utils";

const ago = (d: string) => formatDistanceToNowStrict(new Date(d), { addSuffix: true });

export function PostCard({ post, canModerate }: { post: FeedPost; canModerate: boolean }) {
  const [likeState, setLike] = useOptimistic({ liked: post.likedByMe, count: post.likeCount });
  const [saved, setSaved] = useOptimistic(post.savedByMe);
  const [, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [showComments, setShowComments] = useState(post.comments.length > 0 && post.comments.length <= 2);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagCommentId, setFlagCommentId] = useState<string | null>(null);
  const { guard, dialog } = useDraftGuard();

  const like = () =>
    start(async () => {
      setLike({ liked: !likeState.liked, count: likeState.count + (likeState.liked ? -1 : 1) });
      const res = await toggleLike({ postId: post.id, liked: likeState.liked });
      if (!res.ok) toast.error(res.error);
    });
  const save = () =>
    start(async () => {
      setSaved(!saved);
      const res = await toggleBookmark({ postId: post.id, saved });
      if (!res.ok) toast.error(res.error);
      else if (res.message) toast.success(res.message);
    });

  const authorName = post.author?.full_name ?? "Campus member";

  return (
    <article id={`post-${post.id}`} className={cn("scroll-mt-24 rounded-xl border bg-card", post.isAnnouncement && "border-primary/30", post.shieldState !== "visible" && "border-warning/40")}>
      {dialog}
      {flagCommentId && <FlagButton targetType="comment" targetId={flagCommentId} open onOpenChange={(o) => !o && setFlagCommentId(null)} />}
      {post.shieldState !== "visible" && (
        <p className="flex items-center gap-2 rounded-t-xl border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">
          <ShieldAlert className="size-3.5" />
          {post.shieldState === "held" ? "Pending moderator review — only you can see this post right now." : "Removed by moderators — only you can see this post."}{" "}
          <Link href="/safety" className="underline">Details & appeals</Link>
        </p>
      )}
      <header className="flex items-start gap-3 p-4 pb-0">
        {post.club && post.isAnnouncement ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-lg" aria-hidden>{post.club.logo}</span>
        ) : (
          <UserAvatar name={authorName} src={post.author?.avatar_url} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {post.club && post.isAnnouncement ? (
              <>
                <Link href={`/clubs/${post.club.slug}`} className="font-medium hover:underline">{post.club.name}</Link>
                {post.club.is_official ? (
                  <ToneBadge tone="primary"><BadgeCheck className="size-3" /> Official club</ToneBadge>
                ) : (
                  <ToneBadge>Student club</ToneBadge>
                )}
                <ToneBadge tone="warning"><Megaphone className="size-3" /> Announcement</ToneBadge>
              </>
            ) : post.author ? (
              <Link href={`/profile/${post.author.handle}`} className="font-medium hover:underline">{authorName}</Link>
            ) : (
              <span className="font-medium">{authorName}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {post.club && post.isAnnouncement && post.author ? <>by {authorName} · </> : post.author ? <>{AFFILIATION_LABELS[post.author.affiliation as keyof typeof AFFILIATION_LABELS]} · </> : null}
            <time dateTime={post.createdAt} suppressHydrationWarning>{ago(post.createdAt)}</time>
            {post.edited && " · edited"}
            {post.audienceLabel && (
              <span className="ml-1.5 inline-flex items-center gap-1 align-middle" title="Who can see this post">
                · <Lock className="size-3" aria-hidden /> <span className="sr-only">Visible to </span>{post.audienceLabel}
              </span>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Post options" />}>
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {post.mine && (
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </DropdownMenuItem>
            )}
            {(post.mine || canModerate) && (
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  if (!confirm("Delete this post? This cannot be undone.")) return;
                  const res = await deletePost({ id: post.id });
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.error);
                }}
              >
                <Trash /> Delete
              </DropdownMenuItem>
            )}
            {!post.mine && (
              <DropdownMenuItem onClick={() => setFlagOpen(true)}>
                <Flag /> Report
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <FlagButton targetType="post" targetId={post.id} open={flagOpen} onOpenChange={setFlagOpen} />
      </header>

      <div className="px-4 pt-3">
        {editing ? (
          <div className="space-y-2">
            <label htmlFor={`edit-${post.id}`} className="sr-only">Edit post</label>
            <Textarea id={`edit-${post.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} rows={4} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setDraft(post.body); }}>Cancel</Button>
              <Button
                size="sm"
                disabled={busy || !draft.trim()}
                onClick={async () => {
                  setBusy(true);
                  const res = await editPost({ id: post.id, body: draft });
                  setBusy(false);
                  if (res.ok) setEditing(false);
                  else toast.error(res.error);
                }}
              >
                {busy && <LoaderCircle className="animate-spin" />} Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{post.body}</p>
        )}
      </div>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" loading="lazy" className="mt-3 max-h-[480px] w-full border-y object-cover" />
      )}

      <footer className="flex items-center gap-1 px-2 py-2">
        <Button variant="ghost" size="sm" onClick={like} aria-pressed={likeState.liked} className={cn(likeState.liked && "text-rose-400")}>
          <Heart className={cn(likeState.liked && "fill-current")} /> <span className="tabular-nums">{likeState.count}</span>
          <span className="sr-only">likes</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments}>
          <MessageSquare /> <span className="tabular-nums">{post.comments.length}</span>
          <span className="sr-only">comments</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={save} aria-pressed={saved} className={cn("ml-auto", saved && "text-primary")}>
          <Bookmark className={cn(saved && "fill-current")} /> {saved ? "Saved" : "Save"}
        </Button>
      </footer>

      {showComments && (
        <div className="space-y-3 border-t px-4 py-3">
          {post.comments.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              <UserAvatar name={c.author?.full_name ?? "Member"} src={c.author?.avatar_url} size="xs" className="mt-0.5" />
              <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
                <p className="text-xs">
                  {c.author ? <Link href={`/profile/${c.author.handle}`} className="font-medium hover:underline">{c.author.full_name}</Link> : <span className="font-medium">Member</span>}{" "}
                  <span className="text-muted-foreground" suppressHydrationWarning>· {ago(c.createdAt)}</span>
                </p>
                <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
                {c.shieldState !== "visible" && (
                  <p className="mt-1 text-[11px] text-warning">{c.shieldState === "held" ? "Pending review — only you can see this" : "Removed by moderators — only you can see this"}</p>
                )}
              </div>
              {!c.mine && (
                <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Report comment" onClick={() => setFlagCommentId(c.id)}>
                  <Flag />
                </Button>
              )}
              {c.canDelete && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Delete comment"
                  onClick={async () => {
                    const res = await deleteComment({ id: c.id });
                    if (!res.ok) toast.error(res.error);
                  }}
                >
                  <Trash />
                </Button>
              )}
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              await guard(comment, async () => {
                setBusy(true);
                const res = await addComment({ post_id: post.id, body: comment });
                setBusy(false);
                if (res.ok) setComment("");
                else toast.error(res.error);
              });
            }}
          >
            <label htmlFor={`c-${post.id}`} className="sr-only">Write a comment</label>
            <input
              id={`c-${post.id}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              placeholder="Write a comment…"
              className="h-8 flex-1 rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" size="icon" disabled={busy || !comment.trim()} aria-label="Send comment">
              {busy ? <LoaderCircle className="animate-spin" /> : <Send />}
            </Button>
          </form>
        </div>
      )}
    </article>
  );
}
