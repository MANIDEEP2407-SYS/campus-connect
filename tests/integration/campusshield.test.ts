// CampusShield + Microsoft identity integration tests against the seeded local database.
// All "harmful" strings are synthetic test phrases between fictional demo accounts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { scanContent } from "@/lib/shield/service";
import { MockModerationProvider, ProviderError, type ModerationProvider } from "@/lib/shield/providers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
const dbUrl = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const enabled = Boolean(url && anon && service && password);
const DOMAIN = "demo.campusconnect.test";
const mock = new MockModerationProvider();

type Client = SupabaseClient<Database>;
const c: Record<string, Client> = {};
const ids: Record<string, string> = {};

async function as(user: string) {
  const client = createClient<Database>(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: `${user}@${DOMAIN}`, password: password! });
  if (error) throw new Error(`sign-in ${user}: ${error.message}`);
  ids[user] = data.user.id;
  c[user] = client;
}

async function post(user: string, body: string) {
  const { data, error } = await c[user]!.from("posts").insert({ author_id: ids[user]!, body }).select("id").single();
  if (error) throw new Error(`post ${user}: ${error.message}`);
  return data.id;
}
async function comment(user: string, postId: string, body: string) {
  const { data, error } = await c[user]!.from("comments").insert({ post_id: postId, author_id: ids[user]!, body }).select("id").single();
  if (error) throw new Error(`comment ${user}: ${error.message}`);
  return data.id;
}
const caseFor = async (type: string, id: string) =>
  (await c.moderator!.from("moderation_cases").select("*").eq("content_type", type as never).eq("content_id", id).maybeSingle()).data;

describe.skipIf(!enabled)("CampusShield (AI-assisted moderation)", () => {
  beforeAll(async () => {
    await Promise.all(["aditi", "rahul", "sneha", "fatima", "vikram", "arjun", "moderator", "admin"].map(as));
  });

  it("does not flag ordinary harmless content", async () => {
    const id = await post("aditi", "Our robotics team finally got the line follower working — thanks to everyone who helped!");
    const r = await scanContent("post", id, mock);
    expect(r).toMatchObject({ status: "ok", caseId: null, risk: "low" });
    expect(await caseFor("post", id)).toBeNull();
  });

  it("routes clearly abusive test content for human review and labels mock output", async () => {
    const id = await post("rahul", "TEST: you are a worthless loser and nobody likes you");
    const r = await scanContent("post", id, mock);
    expect(r.status).toBe("ok");
    const k = await caseFor("post", id);
    expect(k).toMatchObject({ source: "ai", category: "targeted_harassment", review_status: "open", model_provider: "mock" });
    expect(["review", "high"]).toContain(k!.risk_level);
    expect(k!.decision).toBeNull(); // AI never decides
    // Not critical → content stays visible to others.
    const { data: seen } = await c.sneha!.from("posts").select("id").eq("id", id);
    expect(seen).toHaveLength(1);
  });

  it("withholds critical content pending review (visible only to its author) and tells the author", async () => {
    const id = await post("vikram", "TEST: watch your back, I will hurt you");
    await scanContent("post", id, mock);
    const k = await caseFor("post", id);
    expect(k!.risk_level).toBe("critical");
    expect((await c.sneha!.from("posts").select("id").eq("id", id)).data).toHaveLength(0);
    expect((await c.vikram!.from("posts").select("shield_state").eq("id", id).single()).data!.shield_state).toBe("held");
    const { data: n } = await c.vikram!.from("notifications").select("type").eq("type", "shield.held");
    expect(n!.length).toBeGreaterThan(0);
  });

  it("provider failures and timeouts are recorded without classifications or cases, and content survives", async () => {
    const failing: ModerationProvider = { name: "openai", model: "test", isMock: false, classify: async () => { throw new ProviderError("Moderation provider timed out", "timeout"); } };
    const id = await post("arjun", "TEST: you are a worthless loser");
    const r = await scanContent("post", id, failing);
    expect(r).toMatchObject({ status: "error" });
    const { data: scans } = await c.moderator!.from("moderation_scans").select("status, model_category, policy_risk, provider_scores").eq("content_id", id);
    expect(scans).toEqual([{ status: "error", model_category: null, policy_risk: null, provider_scores: null }]);
    expect(await caseFor("post", id)).toBeNull();
    expect((await c.sneha!.from("posts").select("id").eq("id", id)).data).toHaveLength(1);
  });

  it("links repeated reports to one case, and never treats the reporter's quoted text as their violation", async () => {
    const target = await post("fatima", "Sharing my CTF write-up from last weekend.");
    const abusive = await comment("arjun", target, "TEST: shut up, everyone hates you");
    for (const u of ["fatima", "sneha"]) {
      const { error } = await c[u]!.from("moderation_reports").insert({
        reporter_id: ids[u]!, target_type: "comment", target_id: abusive, category: "harassment",
        reason: `They wrote "shut up, everyone hates you" under my post — reporting it.`,
      });
      expect(error).toBeNull();
    }
    const k = await caseFor("comment", abusive);
    expect(k).toMatchObject({ report_count: 2, source: "report", content_author_id: ids.arjun, target_user_id: ids.fatima });
    const { data: againstReporters } = await c.moderator!.from("moderation_cases").select("id").in("content_author_id", [ids.fatima!, ids.sneha!]).eq("source", "report");
    expect(againstReporters).toHaveLength(0);
    // Reporter identities are not visible to other users.
    expect((await c.vikram!.from("moderation_reports").select("id").eq("target_id", abusive)).data).toHaveLength(0);
    // Self-reporting your own content is rejected.
    const own = await c.arjun!.from("moderation_reports").insert({ reporter_id: ids.arjun!, target_type: "comment", target_id: abusive, reason: "testing self report" });
    expect(own.error).not.toBeNull();
  });

  it("regular users cannot read, create or alter cases, scans or moderation state", async () => {
    const id = await post("rahul", "TEST: pathetic idiot");
    await scanContent("post", id, mock);
    expect((await c.rahul!.from("moderation_cases").select("id")).data).toHaveLength(0);
    expect((await c.aditi!.from("moderation_scans").select("id")).data).toHaveLength(0);
    expect((await c.aditi!.from("moderation_events").select("id")).data).toHaveLength(0);
    const ins = await c.aditi!.from("moderation_cases").insert({ content_type: "post", content_id: id, source: "ai" });
    expect(ins.error).not.toBeNull();
    const k = await caseFor("post", id);
    const upd = await c.rahul!.from("moderation_cases").update({ decision: "no_action", review_status: "resolved" }).eq("id", k!.id).select();
    expect(upd.data ?? []).toHaveLength(0);
    const decide = await c.rahul!.rpc("shield_decide", { p_case: k!.id, p_decision: "dismissed_false_positive" });
    expect(decide.error?.message).toMatch(/Moderators only/);
    const ingest = await c.rahul!.rpc("shield_ingest_scan" as never, {} as never);
    expect(ingest.error).not.toBeNull();
    const state = await c.vikram!.from("posts").update({ shield_state: "visible" }).eq("author_id", ids.vikram!).eq("shield_state", "held");
    expect(state.error?.message).toMatch(/CampusShield/);
  });

  it("a moderator can dismiss a false positive, restoring held content", async () => {
    const id = await post("sneha", 'Quoting the villain from our drama club play: "watch your back, I will hurt you" — auditions Friday!');
    await scanContent("post", id, mock);
    const k = await caseFor("post", id);
    expect(k!.risk_level).toBe("critical"); // direct-threat phrasing stays critical even when quoted
    const { error } = await c.moderator!.rpc("shield_decide", { p_case: k!.id, p_decision: "dismissed_false_positive", p_internal_note: "Quoted play script" });
    expect(error).toBeNull();
    expect((await caseFor("post", id))!.review_status).toBe("dismissed");
    expect((await c.aditi!.from("posts").select("id").eq("id", id)).data).toHaveLength(1);
  });

  it("decisions are executed and audited; restrictions block posting; authors see notices and can appeal", async () => {
    const id = await post("arjun", "TEST: you are an ugly freak");
    await scanContent("post", id, mock);
    const k = await caseFor("post", id);
    expect((await c.moderator!.rpc("shield_decide", { p_case: k!.id, p_decision: "restricted" })).error?.message).toMatch(/explanation/);
    expect((await c.moderator!.rpc("shield_decide", { p_case: k!.id, p_decision: "restricted", p_reason: "Personal insults break the community guidelines.", p_restrict_days: 2 })).error).toBeNull();
    expect((await c.sneha!.from("posts").select("id").eq("id", id)).data).toHaveLength(0); // removed for others
    const blocked = await c.arjun!.from("posts").insert({ author_id: ids.arjun!, body: "Trying to post while restricted" });
    expect(blocked.error).not.toBeNull();
    const { data: audit } = await c.admin!.from("audit_logs").select("action").eq("target_id", k!.id);
    expect(audit!.map((a) => a.action)).toContain("shield.restricted");

    // The author sees a plain notice; nobody else does; no scores or reporter data are exposed.
    const { data: notice } = await c.arjun!.from("my_moderation_notices").select("*").eq("id", k!.id).single();
    expect(notice).toMatchObject({ decision: "restricted", decision_reason: "Personal insults break the community guidelines." });
    expect(notice).not.toHaveProperty("model_scores");
    expect((await c.sneha!.from("my_moderation_notices").select("id").eq("id", k!.id)).data).toHaveLength(0);

    // Only the author can appeal; overturning restores content and lifts the restriction.
    expect((await c.sneha!.rpc("shield_appeal", { p_case: k!.id, p_statement: "Not my post but appealing anyway" })).error).not.toBeNull();
    expect((await c.arjun!.rpc("shield_appeal", { p_case: k!.id, p_statement: "It was a joke between friends in our club." })).error).toBeNull();
    const { data: appeal } = await c.moderator!.from("moderation_appeals").select("id").eq("case_id", k!.id).single();
    expect((await c.admin!.rpc("shield_resolve_appeal", { p_appeal: appeal!.id, p_overturn: true, p_resolution: "Context shows friendly banter; reversed." })).error).toBeNull();
    expect((await c.sneha!.from("posts").select("id").eq("id", id)).data).toHaveLength(1);
    const again = await c.arjun!.from("posts").insert({ author_id: ids.arjun!, body: "Posting again after the appeal" }).select("id").single();
    expect(again.error).toBeNull();
    expect((await c.arjun!.from("my_moderation_notices").select("appeal_status").eq("id", k!.id).single()).data!.appeal_status).toBe("overturned");
  });

  it("detects repeated targeting only from prior reviewed outcomes", async () => {
    const target = await post("aditi", "Anyone up for a study group for signals & systems?");
    const first = await comment("vikram", target, "TEST: nobody likes you, loser");
    await scanContent("comment", first, mock);
    const k1 = await caseFor("comment", first);
    expect(k1!.category).toBe("targeted_harassment"); // first message: not "repeated"
    await c.moderator!.rpc("shield_decide", { p_case: k1!.id, p_decision: "warning", p_reason: "Please keep comments respectful." });
    const second = await comment("vikram", target, "TEST: shut up, pathetic loser");
    await scanContent("comment", second, mock);
    const k2 = await caseFor("comment", second);
    expect(k2!.category).toBe("repeated_bullying");
    expect(k2!.pattern_evidence).toMatchObject({ prior_actioned_cases_same_target: 1 });
  });

  it("does not scan private DMs unless a participant reports one; outsiders cannot report them", async () => {
    const { data: cid } = await c.fatima!.rpc("start_conversation", { p_other: ids.sneha! });
    const { data: dm } = await c.fatima!.from("direct_messages").insert({ conversation_id: cid as string, sender_id: ids.fatima!, body: "TEST: you are worthless" }).select("id").single();
    expect(await caseFor("direct_message", dm!.id)).toBeNull();
    const outsider = await c.vikram!.from("moderation_reports").insert({ reporter_id: ids.vikram!, target_type: "direct_message", target_id: dm!.id, reason: "I want to see this" });
    expect(outsider.error).not.toBeNull();
    const inside = await c.sneha!.from("moderation_reports").insert({ reporter_id: ids.sneha!, target_type: "direct_message", target_id: dm!.id, category: "harassment", reason: "Received this message" });
    expect(inside.error).toBeNull();
    const k = await caseFor("direct_message", dm!.id);
    expect(k).toMatchObject({ content_excerpt: "TEST: you are worthless", target_user_id: ids.sneha });
    // Moderators still cannot read the conversation itself.
    expect((await c.moderator!.from("direct_messages").select("id").eq("conversation_id", cid as string)).data).toHaveLength(0);
  });

  it("removes the scan job when content is deleted before it is scanned", async () => {
    const admin = createClient<Database>(url!, service!, { auth: { persistSession: false } });
    const id = await post("sneha", "Draft I'm about to delete");
    expect((await admin.from("moderation_jobs").select("status").eq("content_id", id)).data).toEqual([{ status: "pending" }]);
    await c.sneha!.from("posts").delete().eq("id", id);
    expect((await admin.from("moderation_jobs").select("status").eq("content_id", id)).data).toHaveLength(0);
  });

  it("blocking prevents DMs and comments between the pair", async () => {
    await c.rahul!.from("user_blocks").upsert({ blocker_id: ids.rahul!, blocked_id: ids.vikram!, kind: "block" });
    expect((await c.vikram!.rpc("start_conversation", { p_other: ids.rahul! })).error?.message).toMatch(/cannot message/);
    const p = await post("rahul", "My ECG board v2 is finally done.");
    const cm = await c.vikram!.from("comments").insert({ post_id: p, author_id: ids.vikram!, body: "nice" });
    expect(cm.error).not.toBeNull();
    await c.rahul!.from("user_blocks").delete().eq("blocker_id", ids.rahul!);
  });
});

describe.skipIf(!enabled)("Microsoft identity linking (synthetic identities)", () => {
  const db = new pg.Client({ connectionString: dbUrl });
  const admin = createClient<Database>(url ?? "http://x", service ?? "x", { auth: { persistSession: false } });
  const APPROVED = "11111111-2222-3333-4444-555555555555"; // synthetic, not a real tenant
  let userId: string;
  const email = `ms-linking-test@${DOMAIN}`;

  beforeAll(async () => {
    await db.connect();
    const existing = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of existing.data.users.filter((x) => x.email === email)) await admin.auth.admin.deleteUser(u.id);
    const { data } = await admin.auth.admin.createUser({ email, password: password!, email_confirm: true, user_metadata: { full_name: "MS Linking Test" } });
    userId = data.user!.id;
  });
  afterAll(async () => {
    await admin.auth.admin.deleteUser(userId);
    await db.end();
  });

  const linkAzure = (iss: string, sub: string) =>
    db.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values ($1, $2, $3, 'azure', now(), now(), now())
       on conflict (provider_id, provider) do update set identity_data = excluded.identity_data`,
      [sub, userId, JSON.stringify({ iss, sub, email, full_name: "MS Linking Test" })],
    );

  it("records the tenant from the verified issuer, keeps one profile, and grants no roles", async () => {
    await linkAzure(`https://login.microsoftonline.com/${APPROVED}/v2.0`, "ms-sub-1");
    const { rows } = await db.query("select ms_tenant_id, ms_linked_at from public.profiles where id = $1", [userId]);
    expect(rows[0].ms_tenant_id).toBe(APPROVED);
    const linkedAt = rows[0].ms_linked_at;
    await linkAzure(`https://login.microsoftonline.com/${APPROVED}/v2.0`, "ms-sub-1"); // repeat sign-in
    const { rows: again } = await db.query("select count(*)::int n, max(ms_linked_at) t from public.profiles where id = $1", [userId]);
    expect(again[0]).toMatchObject({ n: 1 });
    expect(new Date(again[0].t).getTime()).toBe(new Date(linkedAt).getTime());
    const { rows: roles } = await db.query("select role from public.user_roles where user_id = $1", [userId]);
    expect(roles).toHaveLength(0);
  });

  it("does not derive a tenant from malformed or multi-tenant issuers", async () => {
    await linkAzure("https://login.microsoftonline.com/common/v2.0", "ms-sub-1");
    const { rows } = await db.query("select ms_tenant_id from public.profiles where id = $1", [userId]);
    expect(rows[0].ms_tenant_id).toBeNull();
  });

  it("users cannot set their own verification fields", async () => {
    const client = createClient<Database>(url!, anon!, { auth: { persistSession: false } });
    await client.auth.signInWithPassword({ email, password: password! });
    const { error } = await client.from("profiles").update({ ms_tenant_id: APPROVED }).eq("id", userId);
    expect(error?.message).toMatch(/cannot be changed/);
    const r = await client.rpc("admin_set_role", { p_user: userId, p_role: "moderator", p_grant: true });
    expect(r.error).not.toBeNull();
  });
});
