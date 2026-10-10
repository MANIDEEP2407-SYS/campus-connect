// Authorization & business-rule tests against a real (local) Supabase database.
// Prerequisites: `npm run db:reset` (migrations + seed) and .env.local with the local keys.
// These use only the public anon key + demo sign-ins — exactly what a malicious client could do.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD;
const enabled = Boolean(url && anon && password);
const DOMAIN = "demo.campusconnect.test";

type Client = SupabaseClient<Database>;
const clients: Record<string, Client> = {};
const ids: Record<string, string> = {};

async function as(user: string): Promise<Client> {
  if (clients[user]) return clients[user]!;
  const c = createClient<Database>(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: `${user}@${DOMAIN}`, password: password! });
  if (error) throw new Error(`sign-in ${user}: ${error.message}`);
  ids[user] = data.user.id;
  clients[user] = c;
  return c;
}

describe.skipIf(!enabled)("authorization rules (RLS + RPC)", () => {
  let healthServerId: string;
  let healthChannelId: string;

  beforeAll(async () => {
    await Promise.all(["aditi", "rahul", "sneha", "fatima", "security", "admin", "priya", "vikram", "nikhil", "arjun"].map(as));
    const { data } = await clients.aditi!.from("servers").select("id").eq("name", "Healthcare Innovation Lab").single();
    healthServerId = data!.id;
    const { data: ch } = await clients.aditi!.from("channels").select("id").eq("server_id", healthServerId).eq("name", "datasets").single();
    healthChannelId = ch!.id;
  });

  it("anonymous clients can read nothing", async () => {
    const anonClient = createClient<Database>(url!, anon!, { auth: { persistSession: false } });
    const [{ data: profiles }, { data: posts }, { data: pulse }] = await Promise.all([
      anonClient.from("profiles").select("id"),
      anonClient.from("posts").select("id"),
      anonClient.from("pulse_feed").select("id"),
    ]);
    expect(profiles ?? []).toHaveLength(0);
    expect(posts ?? []).toHaveLength(0);
    expect(pulse ?? []).toHaveLength(0);
  });

  describe("private communities", () => {
    it("members can read private channel messages", async () => {
      const { data } = await clients.aditi!.from("messages").select("id").eq("channel_id", healthChannelId);
      expect(data!.length).toBeGreaterThan(0);
    });

    it("non-members cannot read channels, members or messages of a private server", async () => {
      const [{ data: msgs }, { data: chans }, { data: members }] = await Promise.all([
        clients.fatima!.from("messages").select("id").eq("server_id", healthServerId),
        clients.fatima!.from("channels").select("id").eq("server_id", healthServerId),
        clients.fatima!.from("server_members").select("user_id").eq("server_id", healthServerId),
      ]);
      expect(msgs).toHaveLength(0);
      expect(chans).toHaveLength(0);
      expect(members).toHaveLength(0);
    });

    it("non-members cannot post into a private channel or self-join it", async () => {
      const { error } = await clients.fatima!.from("messages").insert({ channel_id: healthChannelId, server_id: healthServerId, author_id: ids.fatima!, body: "let me in" });
      expect(error).not.toBeNull();
      const { error: joinErr } = await clients.fatima!.rpc("join_public_server", { sid: healthServerId });
      expect(joinErr?.message).toMatch(/private/i);
      const { error: insErr } = await clients.fatima!.from("server_members").insert({ server_id: healthServerId, user_id: ids.fatima! });
      expect(insErr).not.toBeNull();
    });

    it("a user can join a public server and then exchange messages", async () => {
      const { data: s } = await clients.vikram!.from("servers").select("id").eq("name", "AI & ML Collective").single();
      await clients.vikram!.rpc("join_public_server", { sid: s!.id });
      const { data: ch } = await clients.vikram!.from("channels").select("id").eq("server_id", s!.id).eq("name", "general").single();
      const { error } = await clients.vikram!.from("messages").insert({ channel_id: ch!.id, server_id: s!.id, author_id: ids.vikram!, body: "Hello from the integration test" });
      expect(error).toBeNull();
      const { data: seen } = await clients.aditi!.from("messages").select("body").eq("channel_id", ch!.id).eq("author_id", ids.vikram!);
      expect(seen!.some((m) => m.body === "Hello from the integration test")).toBe(true);
    });

    it("users cannot forge messages as someone else", async () => {
      const { data: s } = await clients.vikram!.from("servers").select("id").eq("name", "AI & ML Collective").single();
      const { data: ch } = await clients.vikram!.from("channels").select("id").eq("server_id", s!.id).eq("name", "general").single();
      const { error } = await clients.vikram!.from("messages").insert({ channel_id: ch!.id, server_id: s!.id, author_id: ids.aditi!, body: "impersonation" });
      expect(error).not.toBeNull();
    });
  });

  describe("direct messages", () => {
    it("non-participants cannot read a conversation", async () => {
      const { data: mine } = await clients.aditi!.from("direct_messages").select("conversation_id").limit(1).single();
      const { data } = await clients.fatima!.from("direct_messages").select("id").eq("conversation_id", mine!.conversation_id);
      expect(data).toHaveLength(0);
    });
  });

  describe("roles and privilege escalation", () => {
    it("users cannot grant themselves roles directly or via the admin RPC", async () => {
      const { error: insErr } = await clients.aditi!.from("user_roles").insert({ user_id: ids.aditi!, role: "platform_admin" });
      expect(insErr).not.toBeNull();
      const { error: rpcErr } = await clients.aditi!.rpc("admin_set_role", { p_user: ids.aditi!, p_role: "safety_responder", p_grant: true });
      expect(rpcErr?.message).toMatch(/administrators/i);
      const { data: roles } = await clients.aditi!.from("user_roles").select("role").eq("user_id", ids.aditi!);
      expect(roles).toHaveLength(0);
    });

    it("internal helpers (notify, audit) are not callable over the API", async () => {
      const { error: n } = await clients.aditi!.rpc("notify" as never, { p_user: ids.rahul!, p_type: "spam", p_title: "spam" } as never);
      expect(n).not.toBeNull();
      const { error: a } = await clients.aditi!.rpc("audit" as never, { p_action: "fake", p_target_type: "x", p_target_id: "y" } as never);
      expect(a).not.toBeNull();
    });

    it("non-admins cannot mark a club official", async () => {
      const { data: c } = await clients.vikram!.from("clubs").select("id").eq("slug", "green-campus").single();
      const { error } = await clients.vikram!.from("clubs").update({ is_official: true }).eq("id", c!.id);
      expect(error).not.toBeNull();
      const { data: after } = await clients.vikram!.from("clubs").select("is_official").eq("id", c!.id).single();
      expect(after!.is_official).toBe(false);
    });

    it("only admins can read the audit log", async () => {
      const [{ data: student }, { data: admin }] = await Promise.all([
        clients.aditi!.from("audit_logs").select("id"),
        clients.admin!.from("audit_logs").select("id"),
      ]);
      expect(student).toHaveLength(0);
      expect(Array.isArray(admin)).toBe(true);
    });
  });

  describe("CampusPulse", () => {
    let reportId: string;

    it("a student submits a report; it is hidden from others until verified", async () => {
      const { data, error } = await clients.fatima!.rpc("pulse_submit", {
        p_category: "maintenance_infrastructure", p_subcategory: "Broken furniture", p_title: `Broken bench test ${Date.now()}`,
        p_description: "Integration test: bench slats broken near AB3", p_severity: "low", p_lat: 10.9022, p_lng: 76.9019, p_location_label: "Academic Block III",
      });
      expect(error).toBeNull();
      reportId = data as string;
      const { data: own } = await clients.fatima!.from("pulse_feed").select("id, is_mine").eq("id", reportId).single();
      expect(own!.is_mine).toBe(true);
      const { data: other } = await clients.aditi!.from("pulse_feed").select("id").eq("id", reportId);
      expect(other).toHaveLength(0);
    });

    it("the public feed never exposes reporter identity or precise coordinates", async () => {
      const { data } = await clients.aditi!.from("pulse_feed").select("*").limit(1).single();
      expect(data).not.toHaveProperty("reporter_id");
      const { data: raw } = await clients.aditi!.from("reports").select("reporter_id").neq("reporter_id", ids.aditi!);
      expect(raw).toHaveLength(0);
      const { data: locs } = await clients.aditi!.from("report_locations").select("lat");
      const { data: mineLocs } = await clients.aditi!.from("reports").select("id").eq("reporter_id", ids.aditi!);
      expect(locs!.length).toBe(mineLocs!.length);
    });

    it("students cannot verify, assign or resolve reports", async () => {
      const { error } = await clients.aditi!.rpc("pulse_transition", { rid: reportId, p_to: "verified" });
      expect(error?.message).toMatch(/responders/i);
      // No UPDATE policy exists on reports: a direct write silently affects zero rows.
      const { data: updated } = await clients.fatima!.from("reports").update({ status: "resolved" }).eq("id", reportId).select();
      expect(updated ?? []).toHaveLength(0);
      const { data: still } = await clients.fatima!.from("reports").select("status").eq("id", reportId).single();
      expect(still!.status).toBe("submitted");
    });

    it("responders move reports through legal transitions only", async () => {
      const r = clients.security!;
      expect((await r.rpc("pulse_transition", { rid: reportId, p_to: "resolved", p_note: "skip" })).error?.message).toMatch(/Cannot move/);
      expect((await r.rpc("pulse_transition", { rid: reportId, p_to: "verified" })).error).toBeNull();
      expect((await r.rpc("pulse_transition", { rid: reportId, p_to: "assigned" })).error?.message).toMatch(/assign/i);
      expect((await r.rpc("pulse_transition", { rid: reportId, p_to: "assigned", p_assignee: ids.aditi! })).error?.message).toMatch(/responder/i);
      expect((await r.rpc("pulse_transition", { rid: reportId, p_to: "assigned", p_assignee: ids.security! })).error).toBeNull();
      expect((await r.rpc("pulse_transition", { rid: reportId, p_to: "in_progress" })).error).toBeNull();
      expect((await r.rpc("pulse_transition", { rid: reportId, p_to: "resolved" })).error?.message).toMatch(/resolved/i);
      expect((await r.rpc("pulse_transition", { rid: reportId, p_to: "resolved", p_note: "Bench repaired" })).error).toBeNull();
      const { data } = await clients.aditi!.from("pulse_feed").select("status, resolution_note").eq("id", reportId).single();
      expect(data).toMatchObject({ status: "resolved", resolution_note: "Bench repaired" });
      const { data: notes } = await clients.fatima!.from("notifications").select("type").eq("type", "pulse.status");
      expect(notes!.length).toBeGreaterThan(0);
    });

    it("internal notes are hidden and the timeline masks who reported", async () => {
      await clients.security!.rpc("pulse_add_note", { rid: reportId, p_note: "Internal only", p_internal: true });
      const { data } = await clients.aditi!.from("pulse_timeline").select("note, actor_label, is_internal").eq("report_id", reportId);
      expect(data!.some((u) => u.is_internal)).toBe(false);
      expect(data!.every((u) => !["Fatima Zahra"].includes(u.actor_label ?? ""))).toBe(true);
      const { data: raw } = await clients.aditi!.from("report_updates").select("id").eq("report_id", reportId);
      expect(raw).toHaveLength(0);
    });

    it("duplicate submissions and reporter self-confirmation are blocked", async () => {
      const title = `Leaking pipe test ${Date.now()}`;
      const args = { p_category: "water_sanitation" as const, p_subcategory: "", p_title: title, p_description: "Integration test duplicate check", p_severity: "low" as const, p_lat: 10.9031, p_lng: 76.8998, p_location_label: "Academic Block I" };
      const first = await clients.nikhil!.rpc("pulse_submit", args);
      expect(first.error).toBeNull();
      expect((await clients.nikhil!.rpc("pulse_submit", args)).error?.message).toMatch(/already submitted/i);
      expect((await clients.nikhil!.rpc("pulse_confirm", { rid: first.data as string })).error?.message).toMatch(/You submitted/);
      const { data: similar } = await clients.arjun!.rpc("pulse_find_similar", { p_category: "water_sanitation", p_lat: 10.9031, p_lng: 76.8999 });
      expect(similar!.some((s) => s.id === first.data)).toBe(true);
    });
  });

  describe("events", () => {
    it("enforces capacity and prevents duplicate registration", async () => {
      const { data: e } = await clients.aditi!.from("events").select("id, capacity").ilike("title", "Campus Clean-up Drive%").single();
      expect(e!.capacity).toBe(3);
      expect((await clients.aditi!.rpc("register_for_event", { eid: e!.id })).error).toBeNull();
      expect((await clients.aditi!.rpc("register_for_event", { eid: e!.id })).error?.message).toMatch(/already registered/i);
      expect((await clients.fatima!.rpc("register_for_event", { eid: e!.id })).error?.message).toMatch(/full/i);
      const { data: counts } = await clients.fatima!.rpc("event_counts", { ids: [e!.id] });
      expect(counts![0]!.registered).toBe(3);
      // Participant identities stay private to organisers.
      const { data: visible } = await clients.fatima!.from("event_registrations").select("user_id").eq("event_id", e!.id);
      expect(visible).toHaveLength(0);
    });
  });

  describe("research", () => {
    it("students can apply; only the lead sees applications and restricted details", async () => {
      const { data: p } = await clients.fatima!.from("research_projects").select("id").ilike("title", "Low-cost wearable ECG patch").single();
      const res = await clients.fatima!.rpc("apply_to_project", { pid: p!.id, p_statement: "I have built analog front-ends and would like to contribute to the PCB design.", p_skills: ["Embedded Systems"], p_availability: "5 hrs/week" });
      expect(res.error).toBeNull();
      const { data: forStudent } = await clients.vikram!.from("research_applications").select("id").eq("project_id", p!.id);
      expect(forStudent).toHaveLength(0);
      const { data: forLead } = await clients.priya!.from("research_applications").select("id").eq("project_id", p!.id);
      expect(forLead!.length).toBeGreaterThanOrEqual(2);
      expect((await clients.vikram!.rpc("review_application", { aid: res.data as string, p_status: "accepted" })).error).not.toBeNull();
      expect((await clients.priya!.rpc("review_application", { aid: res.data as string, p_status: "accepted", p_note: "Welcome aboard" })).error).toBeNull();
      const { data: priv } = await clients.vikram!.from("project_private_details").select("budget_note");
      expect(priv).toHaveLength(0);
    });

    it("students cannot publish projects", async () => {
      const { error } = await clients.aditi!.from("research_projects").insert({ lead_id: ids.aditi!, title: "Fake project title", abstract: "This should be rejected by the trigger guard.", area: "Other", commitment: "1 hr" });
      expect(error?.message).toMatch(/faculty/i);
    });
  });

});
