"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fromPg, ok } from "@/lib/action-result";
import { withViewer } from "@/lib/actions/safe";
import { clubSchema, eventSchema } from "@/lib/validation";

export async function createClub(input: unknown) {
  return withViewer(clubSchema, input, async (v, data) => {
    const { data: row, error } = await v.supabase
      .from("clubs")
      .insert({ ...data, created_by: v.userId })
      .select("slug")
      .single();
    if (error?.code === "23505") return fromPg({ message: "That club URL is taken.", code: "P0001" });
    if (error) return fromPg(error);
    return ok(row, "Club created — an administrator can verify it as official.");
  });
}

export async function updateClub(input: unknown) {
  return withViewer(clubSchema.omit({ slug: true }).extend({ clubId: z.uuid() }), input, async (v, { clubId, ...data }) => {
    const { data: rows, error } = await v.supabase.from("clubs").update(data).eq("id", clubId).select("id");
    if (error) return fromPg(error);
    if (!rows?.length) return fromPg({ message: "Only coordinators can edit this club.", code: "P0001" });
    refresh();
    return ok(null, "Club updated");
  });
}

export async function setClubOfficial(input: unknown) {
  return withViewer(z.object({ clubId: z.uuid(), official: z.boolean() }), input, async (v, { clubId, official }) => {
    if (!v.isAdmin) return fromPg({ message: "Only administrators can verify clubs.", code: "P0001" });
    const { error } = await v.supabase.from("clubs").update({ is_official: official }).eq("id", clubId);
    if (error) return fromPg(error);
    refresh();
    return ok(null, official ? "Marked as official" : "Official status removed");
  });
}

export async function joinClub(input: unknown) {
  return withViewer(z.object({ clubId: z.uuid(), note: z.string().trim().max(300).optional() }), input, async (v, d) => {
    const { data, error } = await v.supabase.rpc("join_club", { cid: d.clubId, p_note: d.note || undefined });
    if (error) return fromPg(error);
    refresh();
    return ok(null, data === "approved" ? "You joined the club" : "Membership request sent");
  });
}

export async function leaveClub(input: unknown) {
  return withViewer(z.object({ clubId: z.uuid() }), input, async (v, { clubId }) => {
    const { data, error } = await v.supabase.from("club_members").delete().eq("club_id", clubId).eq("user_id", v.userId).select("club_id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "Coordinators must hand over their role before leaving.", code: "P0001" });
    refresh();
    return ok(null, "You left the club");
  });
}

export async function decideClubMember(input: unknown) {
  return withViewer(z.object({ clubId: z.uuid(), userId: z.uuid(), approve: z.boolean() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("decide_club_member", { cid: d.clubId, p_user: d.userId, p_approve: d.approve });
    if (error) return fromPg(error);
    refresh();
    return ok(null, d.approve ? "Member approved" : "Request declined");
  });
}

export async function setClubCoordinator(input: unknown) {
  return withViewer(z.object({ clubId: z.uuid(), userId: z.uuid(), coordinator: z.boolean() }), input, async (v, d) => {
    const { error } = await v.supabase.rpc("set_club_coordinator", { cid: d.clubId, p_user: d.userId, p_coordinator: d.coordinator });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Role updated");
  });
}

const toIso = (s: string | null | undefined) => (s ? new Date(s).toISOString() : null);

export async function createEvent(input: unknown) {
  return withViewer(eventSchema, input, async (v, d) => {
    if (new Date(d.starts_at) < new Date()) return fromPg({ message: "Events must start in the future.", code: "P0001" });
    const { data, error } = await v.supabase
      .from("events")
      .insert({
        title: d.title,
        description: d.description,
        category: d.category,
        venue: d.venue,
        starts_at: toIso(d.starts_at)!,
        ends_at: toIso(d.ends_at)!,
        capacity: d.capacity ?? null,
        registration_deadline: toIso(d.registration_deadline),
        cover_url: d.cover_url,
        club_id: d.club_id ?? null,
        organizer_id: v.userId,
      })
      .select("id")
      .single();
    if (error) return fromPg(error);
    return ok({ id: data.id }, "Event published");
  });
}

export async function updateEvent(input: unknown) {
  return withViewer(z.object({ eventId: z.uuid(), values: eventSchema }), input, async (v, { eventId, values: d }) => {
    const { data, error } = await v.supabase
      .from("events")
      .update({
        title: d.title,
        description: d.description,
        category: d.category,
        venue: d.venue,
        starts_at: toIso(d.starts_at)!,
        ends_at: toIso(d.ends_at)!,
        capacity: d.capacity ?? null,
        registration_deadline: toIso(d.registration_deadline),
        cover_url: d.cover_url,
      })
      .eq("id", eventId)
      .select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "Only organizers can edit this event.", code: "P0001" });
    refresh();
    return ok(null, "Event updated — registrants were notified of changes");
  });
}

export async function cancelEvent(input: unknown) {
  return withViewer(z.object({ eventId: z.uuid() }), input, async (v, { eventId }) => {
    const { data, error } = await v.supabase.from("events").update({ is_cancelled: true }).eq("id", eventId).select("id");
    if (error) return fromPg(error);
    if (!data?.length) return fromPg({ message: "Only organizers can cancel this event.", code: "P0001" });
    refresh();
    return ok(null, "Event cancelled — registrants were notified");
  });
}

export async function registerForEvent(input: unknown) {
  return withViewer(z.object({ eventId: z.uuid() }), input, async (v, { eventId }) => {
    const { error } = await v.supabase.rpc("register_for_event", { eid: eventId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "You're registered!");
  });
}

export async function cancelRegistration(input: unknown) {
  return withViewer(z.object({ eventId: z.uuid() }), input, async (v, { eventId }) => {
    const { error } = await v.supabase.rpc("cancel_event_registration", { eid: eventId });
    if (error) return fromPg(error);
    refresh();
    return ok(null, "Registration cancelled");
  });
}
