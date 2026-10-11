"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";
import { commentSchema, flagSchema, postSchema, profileSchema } from "@/lib/validation";
import { scheduleScan, scheduleSweep } from "@/lib/shield/schedule";

export async function updateProfile(input: unknown, opts?: { onboarding?: boolean }) {
  return withViewer(profileSchema, input, async (v, data) => {
    const { error } = await v.supabase
      .from("profiles")
      .update({ ...data, onboarded: true })
      .eq("id", v.userId);
    if (error) return error.code === "23505" ? fromPg({ message: "That handle is taken.", code: "P0001" }) : fromPg(error);
    if (!opts?.onboarding) refresh();
    return ok(null, "Profile saved");
  });
}

export async function setAvatar(input: unknown) {
  return withViewer(z.object({ url: z.url().nullable() }), input, async (v, { url }) => {
    if (url && !url.includes(`/avatars/${v.userId}/`)) return fromPg({ message: "Invalid avatar", code: "P0001" });
    const { error } = await v.supabase.from("profiles").update({ avatar_url: url }).eq("id", v.userId);
    if (error) return fromPg(error);
    refresh();
    return ok(null);
  });
}

export async function createPost(input: unknown) {
  return withViewer(postSchema, input, async (v, data) => {
    if (data.image_path && !data.image_path.startsWith(`${v.userId}/`)) return fromPg({ message: "Invalid image", code: "P0001" });
    // Club posts require coordinator rights — enforced by the posts_insert RLS policy.
    const { data: row, error } = await v.supabase
      .from("posts")
      .insert({
        author_id: v.userId,
        body: data.body,
        image_path: data.image_path ?? null,
        club_id: data.club_id ?? null,
        is_announcement: Boolean(data.club_id && data.is_announcement),
        // Department and tag normalisation happen in the posts_audience_guard trigger.
        audience: data.audience,
        audience_club_id: data.audience === "club" ? (data.audience_club_id ?? null) : null,
        audience_tags: data.audience === "interests" ? data.audience_tags : [],
      })
      .select("id")
      .single();
    if (error?.code === "42501")
      return fromPg({ message: data.club_id ? "Only club coordinators can post for this club." : "You can't post right now — your posting is temporarily restricted. See Safety & moderation.", code: "P0001" });
    if (error) return fromPg(error);
    scheduleScan("post", row.id);
    refresh();
    return ok(row, "Posted");
  });
}

export async function editPost(input: unknown) {
  return withViewer(z.object({ id: z.uuid(), body: z.string().trim().min(1).max(2000) }), input, async (v, { id, body }) => {
    const { data, error } = await v.supabase.from("posts").update({ body }).eq("id", id).eq("author_id", v.userId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "You can only edit your own posts.", code: "P0001" });
    scheduleScan("post", id);
    refresh();
    return ok(null, "Post updated");
  });
}

export async function deletePost(input: unknown) {
  return withViewer(z.object({ id: z.uuid() }), input, async (v, { id }) => {
    const { data, error } = await v.supabase.from("posts").delete().eq("id", id).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "You can't delete this post.", code: "P0001" });
    refresh();
    return ok(null, "Post deleted");
  });
}

export async function toggleLike(input: unknown) {
  return withViewer(z.object({ postId: z.uuid(), liked: z.boolean() }), input, async (v, { postId, liked }) => {
    const q = liked
      ? v.supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", v.userId)
      : v.supabase.from("post_likes").insert({ post_id: postId, user_id: v.userId });
    const { error } = await q;
    if (error && error.code !== "23505") return fromPg(error);
    refresh();
    return ok(null);
  });
}

export async function toggleBookmark(input: unknown) {
  return withViewer(z.object({ postId: z.uuid(), saved: z.boolean() }), input, async (v, { postId, saved }) => {
    const q = saved
      ? v.supabase.from("bookmarks").delete().eq("post_id", postId).eq("user_id", v.userId)
      : v.supabase.from("bookmarks").insert({ post_id: postId, user_id: v.userId });
    const { error } = await q;
    if (error && error.code !== "23505") return fromPg(error);
    refresh();
    return ok(null, saved ? "Removed from saved" : "Saved");
  });
}

export async function addComment(input: unknown) {
  return withViewer(commentSchema, input, async (v, data) => {
    const { data: row, error } = await v.supabase.from("comments").insert({ ...data, author_id: v.userId }).select("id").single();
    if (error?.code === "42501") return fromPg({ message: "You can't comment here right now (posting restricted, or a block is in place).", code: "P0001" });
    if (error) return fromPg(error);
    scheduleScan("comment", row.id);
    refresh();
    return ok(null);
  });
}

export async function deleteComment(input: unknown) {
  return withViewer(z.object({ id: z.uuid() }), input, async (v, { id }) => {
    const { data, error } = await v.supabase.from("comments").delete().eq("id", id).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "You can't delete this comment.", code: "P0001" });
    refresh();
    return ok(null);
  });
}

export async function toggleFollow(input: unknown) {
  return withViewer(z.object({ userId: z.uuid(), following: z.boolean() }), input, async (v, { userId, following }) => {
    const q = following
      ? v.supabase.from("follows").delete().eq("follower_id", v.userId).eq("followee_id", userId)
      : v.supabase.from("follows").insert({ follower_id: v.userId, followee_id: userId });
    const { error } = await q;
    if (error && error.code !== "23505") return fromPg(error);
    refresh();
    return ok(null, following ? "Unfollowed" : "Following");
  });
}

export async function flagContent(input: unknown) {
  return withViewer(flagSchema, input, async (v, data) => {
    const { error } = await v.supabase.from("moderation_reports").insert({ ...data, reporter_id: v.userId });
    if (error?.code === "23505") return ok(null, "You already reported this — moderators will review it.");
    if (error) return fromPg(error);
    // The report trigger queued a scan of the reported content; drain it soon.
    if (["post", "comment", "message", "direct_message"].includes(data.target_type)) scheduleSweep(3);
    return ok(null, "Report received. Moderators will review it — your identity isn't shared with the author.");
  });
}

export async function markNotificationsRead(input: unknown) {
  return withViewer(z.object({ ids: z.array(z.uuid()).max(200).optional() }), input, async (v, { ids }) => {
    let q = v.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", v.userId).is("read_at", null);
    if (ids?.length) q = q.in("id", ids);
    const { error } = await q;
    if (error) return fromPg(error);
    refresh();
    return ok(null);
  });
}
