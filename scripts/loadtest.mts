// Synthetic load test for incident reports, against the LOCAL stack only.
// Usage: node --env-file=.env.local scripts/loadtest.mts [baseUrl]   (default http://localhost:3002, a `next start` build)
// Seeds ~20k fictional incidents (titles start with "[loadtest]"), measures RLS query latency under
// concurrency, checks concurrency safety of the write RPCs, load-tests the pages, then cleans up.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const password = process.env.DEMO_PASSWORD!;
const base = process.argv[2] ?? "http://localhost:3002";
if (!url || !anon || !service || !password) throw new Error("Missing env (see .env.example)");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error(`Refusing to load-test a non-local database: ${url}`);

const DOMAIN = "demo.campusconnect.test";
const TAG = "[loadtest]";
const SEED_ROWS = 20_000;
const db = createClient(url, service, { auth: { persistSession: false } });

const DEPTS = ["Computer Science & Engineering", "Artificial Intelligence & Data Science", "Electronics & Communication Engineering",
  "Electrical & Electronics Engineering", "Mechanical Engineering", "Civil Engineering", "Biomedical Engineering", "Cyber Security", "Mathematics", "Physics"];
const CATS = ["harassment", "sexual_harassment", "verbal_abuse", "discrimination", "threat_or_violence", "unprofessional_conduct", "academic_misconduct", "other"] as const;
const STATUSES = ["submitted", "under_review", "action_taken", "unsubstantiated", "false_report", "withdrawn"] as const;
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;

async function signIn(handle: string): Promise<SupabaseClient> {
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email: `${handle}@${DOMAIN}`, password });
  if (error) throw new Error(`sign-in ${handle}: ${error.message}`);
  return c;
}

function stats(ms: number[]) {
  const s = [...ms].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]?.toFixed(0) ?? "-";
  return { n: s.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s.at(-1)?.toFixed(0) ?? "-" };
}

/** Run `fn` from `concurrency` workers for `seconds`; returns latency stats and error count. */
async function hammer(seconds: number, concurrency: number, fn: () => Promise<void>) {
  const lat: number[] = [];
  const errors: string[] = [];
  const end = Date.now() + seconds * 1000;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (Date.now() < end) {
      const t = performance.now();
      try { await fn(); lat.push(performance.now() - t); } catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
    }
  }));
  return { ...stats(lat), rps: (lat.length / seconds).toFixed(0), errors: errors.length, firstError: errors[0] };
}

const must = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
};

async function seed() {
  const people = await must(db.from("profiles").select("id, handle").in("handle", ["aditi", "rahul", "sneha", "arjun", "fatima", "vikram", "divya", "nikhil", "karthik"]));
  const t = performance.now();
  for (let i = 0; i < SEED_ROWS; i += 1000) {
    const rows = Array.from({ length: Math.min(1000, SEED_ROWS - i) }, (_, k) => {
      const created = new Date(Date.now() - Math.random() * 180 * 86_400_000);
      return {
        reporter_id: pick(people).id, direction: "about_staff" as const, category: pick(CATS), subject_name: `Synthetic subject ${i + k}`,
        department: pick(DEPTS), title: `${TAG} synthetic incident ${i + k}`, status: pick(STATUSES), is_demo: true,
        description: "Synthetic load-test incident. Fictional text long enough to satisfy the length check.",
        occurred_on: created.toISOString().slice(0, 10), created_at: created.toISOString(),
      };
    });
    const ids = await must(db.from("incidents").insert(rows).select("id"));
    await must(db.from("incident_updates").insert(ids.flatMap(({ id }) => [
      { incident_id: id, kind: "status", to_status: "submitted", note: "Report submitted", is_internal: false },
      { incident_id: id, kind: "note", to_status: null, note: "Synthetic internal note", is_internal: true },
    ])));
  }
  console.log(`Seeded ${SEED_ROWS} incidents + ${SEED_ROWS * 2} updates in ${((performance.now() - t) / 1000).toFixed(1)}s`);
}

async function dbLoad() {
  const [reporter, cseReviewer, central] = await Promise.all(["aditi", "maintenance", "security"].map(signIn));
  const { data: sample } = await central!.from("incidents").select("id").like("title", `${TAG}%`).limit(500);
  const ids = sample!.map((r) => r.id);
  const open = ["submitted", "under_review"];
  const check = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) throw new Error(error.message); };

  const scenarios: [string, () => Promise<void>][] = [
    ["reviewer queue (CSE, RLS by dept)", () => check(cseReviewer!.from("incidents").select("id, ref_code, title, category, direction, subject_name, department, status, created_at").in("status", open).order("created_at").limit(200))],
    ["central queue (all departments)", () => check(central!.from("incidents").select("id, ref_code, title, category, direction, subject_name, department, status, created_at").in("status", open).order("created_at").limit(200))],
    ["reporter: my reports", () => check(reporter!.from("incidents").select("id, ref_code, title, status, created_at").order("created_at", { ascending: false }))],
    ["detail + reporter join", () => check(central!.from("incidents").select("*, reporter:profiles!incidents_reporter_id_fkey(full_name, handle)").eq("id", pick(ids)).maybeSingle())],
    ["timeline view", () => check(central!.from("incident_timeline").select("*").eq("incident_id", pick(ids)).order("created_at"))],
  ];
  console.log("\n## Database (PostgREST + RLS), 15s each, 50 concurrent");
  for (const [name, fn] of scenarios) console.log(name.padEnd(36), JSON.stringify(await hammer(15, 50, fn)));
}

async function concurrencyChecks() {
  console.log("\n## Concurrency safety");
  // 1) Rate limit: 20 simultaneous submissions from one user; the limit is 5 per day.
  const vikram = await signIn("vikram");
  const { data: me } = await vikram.auth.getUser();
  await db.from("rate_limit_events").delete().eq("user_id", me.user!.id).eq("action", "incident.submit");
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => vikram.rpc("incident_submit", {
    p_category: "other", p_subject_kind: "staff", p_subject_name: "Synthetic subject", p_department: "Physics", p_title: `${TAG} burst ${i}`,
    p_description: "Synthetic burst submission to test the rate limit under concurrency.", p_occurred_on: new Date().toISOString().slice(0, 10),
    p_location: "", p_context: "", p_witnesses: "", p_declaration: true,
  })));
  const accepted = results.filter((r) => !r.error).length;
  console.log(`rate limit (max 5/day): ${accepted}/20 accepted ${accepted <= 5 ? "OK" : "FAIL — limit bypassed under concurrency"}`);
  await db.from("rate_limit_events").delete().eq("user_id", me.user!.id).eq("action", "incident.submit");

  // 2) Transitions: 20 simultaneous "under_review" moves on one report; exactly one may succeed.
  const central = await signIn("security");
  const target = results.find((r) => !r.error)!.data as string;
  const moves = await Promise.all(Array.from({ length: 20 }, () => central.rpc("incident_transition", { p_id: target, p_to: "under_review" })));
  const moved = moves.filter((r) => !r.error).length;
  const { count } = await db.from("incident_updates").select("id", { count: "exact", head: true }).eq("incident_id", target).eq("to_status", "under_review");
  console.log(`transition race: ${moved}/20 succeeded, ${count} status rows ${moved === 1 && count === 1 ? "OK" : "FAIL"}`);
}

async function httpLoad() {
  // Build the same auth cookies the app's proxy expects by signing in through @supabase/ssr.
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, anon, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) } });
  const { error } = await ssr.auth.signInWithPassword({ email: `security@${DOMAIN}`, password });
  if (error) throw new Error(error.message);
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const { data: one } = await db.from("incidents").select("id").like("title", `${TAG}%`).limit(1).single();

  const get = (path: string, auth: boolean) => async () => {
    const res = await fetch(base + path, { headers: auth ? { cookie } : {}, redirect: "manual" });
    await res.arrayBuffer();
    if (res.status !== 200) throw new Error(`${path} → ${res.status}`);
  };
  console.log(`\n## HTTP (${base}), 15s each, 20 concurrent`);
  for (const [path, auth] of [["/", false], ["/login", false], ["/incidents", true], ["/incidents/review", true], [`/incidents/${one!.id}`, true], ["/incidents/new", true]] as const) {
    console.log(`${path.length > 20 ? "/incidents/[id]" : path}${auth ? " (signed in)" : ""}`.padEnd(36), JSON.stringify(await hammer(15, 20, get(path, auth))));
  }
}

async function cleanup() {
  const ids: string[] = [];
  for (;;) {
    const { data } = await db.from("incidents").select("id").like("title", `${TAG}%`).range(ids.length, ids.length + 999);
    if (!data?.length) break;
    ids.push(...data.map((r) => r.id));
  }
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await db.from("notifications").delete().in("link", chunk.map((id) => `/incidents/${id}`));
    await db.from("audit_logs").delete().in("target_id", chunk);
  }
  const { count } = await db.from("incidents").delete({ count: "exact" }).like("title", `${TAG}%`);
  console.log(`\nCleaned up ${count} synthetic incidents (updates and attachments cascade)`);
}

try {
  await seed();
  await dbLoad();
  await concurrencyChecks();
  await httpLoad();
} finally {
  await cleanup();
}
