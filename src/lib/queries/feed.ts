import "server-only";
import type { Viewer } from "@/lib/auth";
import { audienceLabel } from "@/lib/audience";

export type FeedTab = "all" | "following" | "announcements" | "saved";

export interface FeedPost {
  id: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  edited: boolean;
  isAnnouncement: boolean;
  author: { id: string; handle: string; full_name: string; avatar_url: string | null; affiliation: string } | null;
  club: { name: string; slug: string; is_official: boolean; logo: string } | null;
  likeCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  mine: boolean;
  shieldState: "visible" | "held" | "removed";
  /** "Who can see this" label; null for posts visible to everyone. */
  audienceLabel: string | null;
  comments: { id: string; body: string; createdAt: string; mine: boolean; canDelete: boolean; shieldState: "visible" | "held" | "removed"; author: { handle: string; full_name: string; avatar_url: string | null } | null }[];
}

const POST_SELECT =
  "id, body, image_path, created_at, updated_at, is_announcement, author_id, shield_state, author:profiles!posts_author_id_fkey(id, handle, full_name, avatar_url, affiliation), club:clubs!posts_club_fk(name, slug, is_official, logo), post_likes(count), audience, audience_department, audience_tags, audience_club:clubs!posts_audience_club_id_fkey(name)";

export async function getFeed(v: Viewer, opts: { tab: FeedTab; before?: string; authorId?: string; clubId?: string; limit?: number }) {
  const limit = opts.limit ?? 20;
  const { data: blocks } = await v.supabase.from("user_blocks").select("blocked_id").eq("blocker_id", v.userId);
  const hidden = (blocks ?? []).map((b) => b.blocked_id);
  let q = v.supabase
    .from("posts")
    .select(POST_SELECT)
    // Held/removed content is visible only to its author here (moderators review it in CampusShield).
    .or(`shield_state.eq.visible,author_id.eq.${v.userId}`)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (hidden.length) q = q.not("author_id", "in", `(${hidden.join(",")})`);

  if (opts.before) q = q.lt("created_at", opts.before);
  if (opts.authorId) q = q.eq("author_id", opts.authorId);
  if (opts.clubId) q = q.eq("club_id", opts.clubId);
  if (opts.tab === "announcements") q = q.eq("is_announcement", true);
  if (opts.tab === "following") {
    const { data: f } = await v.supabase.from("follows").select("followee_id").eq("follower_id", v.userId);
    q = q.in("author_id", [v.userId, ...(f ?? []).map((r) => r.followee_id)]);
  }
  if (opts.tab === "saved") {
    const { data: b } = await v.supabase.from("bookmarks").select("post_id").eq("user_id", v.userId);
    q = q.in("id", (b ?? []).map((r) => r.post_id));
  }

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  const hasMore = (rows?.length ?? 0) > limit;
  const posts = (rows ?? []).slice(0, limit);
  const ids = posts.map((p) => p.id);
  if (!ids.length) return { posts: [] as FeedPost[], nextCursor: null };

  const [{ data: myLikes }, { data: mySaves }, { data: comments }] = await Promise.all([
    v.supabase.from("post_likes").select("post_id").eq("user_id", v.userId).in("post_id", ids),
    v.supabase.from("bookmarks").select("post_id").eq("user_id", v.userId).in("post_id", ids),
    v.supabase
      .from("comments")
      .select("id, post_id, body, created_at, author_id, shield_state, author:profiles!comments_author_id_fkey(handle, full_name, avatar_url)")
      .in("post_id", ids)
      .or(`shield_state.eq.visible,author_id.eq.${v.userId}`)
      .order("created_at", { ascending: true })
      .limit(400),
  ]);
  const liked = new Set((myLikes ?? []).map((r) => r.post_id));
  const saved = new Set((mySaves ?? []).map((r) => r.post_id));

  const result: FeedPost[] = posts.map((p) => ({
    id: p.id,
    body: p.body,
    imageUrl: p.image_path ? v.supabase.storage.from("post-images").getPublicUrl(p.image_path).data.publicUrl : null,
    createdAt: p.created_at,
    edited: new Date(p.updated_at).getTime() - new Date(p.created_at).getTime() > 5000,
    isAnnouncement: p.is_announcement,
    author: p.author,
    club: p.club,
    likeCount: p.post_likes[0]?.count ?? 0,
    likedByMe: liked.has(p.id),
    savedByMe: saved.has(p.id),
    mine: p.author_id === v.userId,
    shieldState: p.shield_state as FeedPost["shieldState"],
    audienceLabel: audienceLabel({ audience: p.audience, clubName: p.audience_club?.name, department: p.audience_department, tags: p.audience_tags }),
    comments: (comments ?? [])
      .filter((c) => c.post_id === p.id && !hidden.includes(c.author_id))
      .map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.created_at,
        mine: c.author_id === v.userId,
        canDelete: c.author_id === v.userId || p.author_id === v.userId || v.isModerator,
        shieldState: c.shield_state as FeedPost["shieldState"],
        author: c.author,
      })),
  }));
  return { posts: result, nextCursor: hasMore ? posts[posts.length - 1]!.created_at : null };
}
