// Synthetic test strings only — no real people are referenced.
import { describe, expect, it } from "vitest";
import { contextSignals, detectPersonalInfo, evaluate, getThresholds, mapScores, redactForProvider } from "@/lib/shield/policy";
import { MockModerationProvider, OpenAIModerationProvider, ProviderError, UnconfiguredProvider, getModerationProvider } from "@/lib/shield/providers";

const T = { review: 0.45, high: 0.75, critical: 0.9 };
const opts = { thresholds: T, providerLabel: "test" };

describe("CampusShield policy", () => {
  it("does not flag ordinary content", () => {
    const r = evaluate({ harassment: 0.02, hate: 0.01, violence: 0.01 }, "Great talk on robotics today, thanks everyone!", opts);
    expect(r.risk).toBe("low");
    expect(r.category).toBe("none");
  });

  it("routes clear harassment for review with an explanation that is not a finding", () => {
    const r = evaluate({ harassment: 0.82 }, "you are worthless", opts);
    expect(r.risk).toBe("high");
    expect(r.category).toBe("targeted_harassment");
    expect(r.explanation).toMatch(/not a finding/);
    expect(r.explanation).not.toMatch(/probability/i);
  });

  it("never auto-withholds plain insults, however strongly scored — they get priority human review", () => {
    expect(evaluate({ harassment: 0.99 }, "you absolute loser", opts).risk).toBe("high");
    expect(evaluate({ "hate/threatening": 0.95, hate: 0.95 }, "x", opts).risk).toBe("critical");
  });

  it("treats direct threats, minors and self-harm intent as critical", () => {
    expect(evaluate({ "harassment/threatening": 0.8, harassment: 0.8 }, "x", opts).risk).toBe("critical");
    expect(evaluate({ "sexual/minors": 0.35 }, "x", opts).risk).toBe("critical");
    const sh = evaluate({ "self-harm/intent": 0.7 }, "x", opts);
    expect(sh.risk).toBe("critical");
    expect(sh.reasons.join(" ")).toMatch(/wellbeing/);
  });

  it("downgrades quoted / reported / academic content one level (never critical)", () => {
    expect(evaluate({ harassment: 0.8 }, 'Someone called me "a worthless freak" in the lab today, not ok', opts).risk).toBe("review");
    expect(evaluate({ hate: 0.6 }, "Seminar discussion on the history of hate speech laws", opts).risk).toBe("low");
    expect(evaluate({ "harassment/threatening": 0.95, harassment: 0.95 }, 'He said "I will hurt you"', opts).risk).toBe("critical");
    expect(contextSignals("just a normal sentence")).toEqual([]);
  });

  it("detects exposure of personal information locally and redacts it before sending to the provider", () => {
    const text = "Her number is 98765 43210 and she lives in hostel room 214 — everyone text her";
    const pii = detectPersonalInfo(text);
    expect(pii.kinds).toEqual(expect.arrayContaining(["phone number", "location / residence detail"]));
    expect(pii.score).toBeGreaterThanOrEqual(0.85);
    expect(evaluate({}, text, opts).category).toBe("doxxing");
    expect(redactForProvider(text)).not.toMatch(/98765/);
    expect(redactForProvider("mail me at someone@example.com")).toBe("mail me at [email address]");
  });

  it("maps provider categories onto CampusShield categories", () => {
    const m = mapScores({ hate: 0.3, "hate/threatening": 0.7, sexual: 0.5 }, 0);
    expect(m.hate_discrimination).toBe(0.7);
    expect(m.threats_intimidation).toBe(0.7);
    expect(m.sexual_harassment).toBeCloseTo(0.45);
  });

  it("never labels a single message as repeated bullying (that needs case history)", () => {
    const r = evaluate({ harassment: 0.99 }, "loser", opts);
    expect(r.category).not.toBe("repeated_bullying");
  });

  it("keeps configured thresholds ordered", () => {
    expect(getThresholds({ SHIELD_THRESHOLD_REVIEW: "0.8", SHIELD_THRESHOLD_HIGH: "0.5" })).toEqual({ review: 0.8, high: 0.8, critical: 0.9 });
    expect(getThresholds({ SHIELD_THRESHOLD_REVIEW: "abc" }).review).toBe(0.45);
  });
});

describe("Moderation providers", () => {
  const okBody = {
    id: "modr-1", model: "omni-moderation-latest",
    results: [{ flagged: true, categories: { harassment: true, "illicit/violent": null }, category_scores: { harassment: 0.91, hate: 0.01 }, category_applied_input_types: { harassment: ["text"] } }],
  };
  const fakeFetch = (impl: () => Promise<Response>) => (async () => impl()) as unknown as typeof fetch;

  it("parses a valid OpenAI moderation response and sends only model + input", async () => {
    let sent: unknown;
    const f = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify(okBody), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await new OpenAIModerationProvider("sk-test", "omni-moderation-latest", f).classify("hello");
    expect(r).toMatchObject({ provider: "openai", isMock: false, flagged: true });
    expect(r.scores.harassment).toBe(0.91);
    expect(sent).toEqual({ model: "omni-moderation-latest", input: "hello" });
  });

  it("raises (never fabricates) on HTTP errors, invalid responses, network failures and timeouts", async () => {
    const http = new OpenAIModerationProvider("k", undefined, fakeFetch(async () => new Response("rate limited", { status: 429 })));
    await expect(http.classify("x")).rejects.toMatchObject({ kind: "http" });
    const invalid = new OpenAIModerationProvider("k", undefined, fakeFetch(async () => new Response(JSON.stringify({ results: [{ flagged: "yes" }] }), { status: 200 })));
    await expect(invalid.classify("x")).rejects.toMatchObject({ kind: "invalid_response" });
    const outOfRange = new OpenAIModerationProvider("k", undefined, fakeFetch(async () => new Response(JSON.stringify({ ...okBody, results: [{ ...okBody.results[0], category_scores: { harassment: 7 } }] }), { status: 200 })));
    await expect(outOfRange.classify("x")).rejects.toMatchObject({ kind: "invalid_response" });
    const network = new OpenAIModerationProvider("k", undefined, fakeFetch(async () => { throw new TypeError("fetch failed"); }));
    await expect(network.classify("x")).rejects.toMatchObject({ kind: "network" });
    const hang = (async (_u: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    const slow = new OpenAIModerationProvider("k", undefined, hang);
    await expect(slow.classify("x", { timeoutMs: 50 })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("labels the mock as a mock and is deterministic", async () => {
    const m = new MockModerationProvider();
    const a = await m.classify("you are a worthless loser");
    const b = await m.classify("you are a worthless loser");
    expect(a.isMock).toBe(true);
    expect(a.provider).toBe("mock");
    expect(a.scores).toEqual(b.scores);
    expect((await m.classify("See you at the hackathon!")).flagged).toBe(false);
  });

  it("mock: severe threats are withheld, other threats reviewed, chat spellings included", async () => {
    const m = new MockModerationProvider();
    const risk = async (t: string) => evaluate((await m.classify(t)).scores, t, { providerLabel: "mock" }).risk;
    for (const t of ["i will kill u", "I will kill you", "ill kill u", "gonna kill ya", "I'm going to stab you", "kill u"]) {
      expect(await risk(t), t).toBe("critical");
    }
    for (const t of ["I will hit u", "i'll slap you", "imma beat u", "watch ur back"]) {
      expect(await risk(t), t).not.toBe("low");
    }
    for (const t of ["I'll hit you up after class", "this bug will kill us", "u killed it at the fest!", "Will you join us?"]) {
      expect(await risk(t), t).toBe("low");
    }
  });

  it("selects providers from configuration and fails closed when unconfigured", async () => {
    expect(getModerationProvider({ MODERATION_PROVIDER: "mock" }).isMock).toBe(true);
    expect(getModerationProvider({ MODERATION_PROVIDER: "openai", OPENAI_API_KEY: "sk" })).toBeInstanceOf(OpenAIModerationProvider);
    const missingKey = getModerationProvider({ MODERATION_PROVIDER: "openai" });
    expect(missingKey).toBeInstanceOf(UnconfiguredProvider);
    await expect(missingKey.classify("x")).rejects.toBeInstanceOf(ProviderError);
    expect(getModerationProvider({})).toBeInstanceOf(UnconfiguredProvider);
  });
});
