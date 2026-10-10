// Moderation providers. The OpenAI provider calls POST https://api.openai.com/v1/moderations
// (model `omni-moderation-latest`, schema per the official openai-node SDK). The mock provider is a
// keyword heuristic for local development ONLY — its output is always labelled as a mock and must
// never be presented as an AI classification.

import { z } from "zod";
import type { ProviderScores } from "@/lib/shield/policy";

export interface ProviderResult {
  provider: "openai" | "mock";
  model: string;
  isMock: boolean;
  flagged: boolean;
  scores: ProviderScores;
  latencyMs: number;
}

export interface ModerationProvider {
  readonly name: "openai" | "mock";
  readonly model: string;
  readonly isMock: boolean;
  classify(text: string, opts?: { timeoutMs?: number }): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly kind: "unconfigured" | "timeout" | "http" | "invalid_response" | "network") {
    super(message);
    this.name = "ProviderError";
  }
}

const openAiResponse = z.object({
  id: z.string(),
  model: z.string(),
  results: z
    .array(
      z.object({
        flagged: z.boolean(),
        categories: z.record(z.string(), z.boolean().nullable()),
        category_scores: z.record(z.string(), z.number().min(0).max(1)),
      }),
    )
    .min(1),
});

export class OpenAIModerationProvider implements ModerationProvider {
  readonly name = "openai" as const;
  readonly isMock = false;
  constructor(
    private readonly apiKey: string,
    readonly model = "omni-moderation-latest",
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async classify(text: string, opts: { timeoutMs?: number } = {}): Promise<ProviderResult> {
    const started = Date.now();
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/moderations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        // Only the (redacted) text is sent — no names, ids, tokens or metadata.
        body: JSON.stringify({ model: this.model, input: text }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
      });
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError") throw new ProviderError("Moderation provider timed out", "timeout");
      throw new ProviderError(`Moderation provider unreachable: ${(e as Error)?.message ?? "network error"}`, "network");
    }
    if (!res.ok) throw new ProviderError(`Moderation provider returned HTTP ${res.status}`, "http");
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new ProviderError("Moderation provider returned non-JSON", "invalid_response");
    }
    const parsed = openAiResponse.safeParse(json);
    if (!parsed.success) throw new ProviderError("Moderation provider response failed validation", "invalid_response");
    const r = parsed.data.results[0]!;
    return { provider: "openai", model: parsed.data.model, isMock: false, flagged: r.flagged, scores: r.category_scores as ProviderScores, latencyMs: Date.now() - started };
  }
}

// ---------------------------------------------------------------------------
// Development mock (deterministic keyword heuristic — NOT AI)
// ---------------------------------------------------------------------------
const MOCK_LEXICON: { key: keyof ProviderScores; patterns: RegExp[] }[] = [
  { key: "harassment", patterns: [/\b(idiot|loser|stupid|worthless|pathetic|ugly|freak|nobody likes you|everyone hates you|shut up)\b/i] },
  { key: "harassment/threatening", patterns: [/\b(i('| wi)ll (hurt|beat|find|get) you|watch your back|you('| wi)ll regret|kill you|beat you up)\b/i] },
  { key: "hate", patterns: [/\b(people like you|your (caste|religion|kind)|go back to (your|where))\b/i] },
  { key: "sexual", patterns: [/\b(send (me )?nudes|sexy pics|hook up with me)\b/i] },
  { key: "self-harm/intent", patterns: [/\b(kill myself|want to die|end my life)\b/i] },
  { key: "violence", patterns: [/\b(stab|punch|smash) (you|him|her|them)\b/i] },
];

export class MockModerationProvider implements ModerationProvider {
  readonly name = "mock" as const;
  readonly model = "dev-keyword-mock";
  readonly isMock = true;

  async classify(text: string): Promise<ProviderResult> {
    const scores: ProviderScores = {};
    for (const { key, patterns } of MOCK_LEXICON) {
      const hits = patterns.reduce((n, re) => n + (text.match(new RegExp(re.source, "gi"))?.length ?? 0), 0);
      scores[key] = Math.min(0.97, hits ? 0.5 + 0.2 * hits : 0.01);
    }
    if ((scores["harassment/threatening"] ?? 0) > 0.4) scores.harassment = Math.max(scores.harassment ?? 0, scores["harassment/threatening"]!);
    const flagged = Object.values(scores).some((v) => (v ?? 0) >= 0.5);
    return { provider: "mock", model: this.model, isMock: true, flagged, scores, latencyMs: 0 };
  }
}

/** Provider is unavailable — every call fails; callers must not invent a classification. */
export class UnconfiguredProvider implements ModerationProvider {
  readonly name = "openai" as const;
  readonly model = "unconfigured";
  readonly isMock = false;
  constructor(private readonly reason: string) {}
  async classify(): Promise<ProviderResult> {
    throw new ProviderError(this.reason, "unconfigured");
  }
}

/**
 * MODERATION_PROVIDER=openai (requires OPENAI_API_KEY) | mock (development only) | none.
 * Anything else, or missing credentials, yields an unconfigured provider (scans recorded as errors).
 */
export function getModerationProvider(env: Record<string, string | undefined> = process.env): ModerationProvider {
  const choice = (env.MODERATION_PROVIDER ?? "none").toLowerCase();
  if (choice === "openai") {
    if (!env.OPENAI_API_KEY) return new UnconfiguredProvider("MODERATION_PROVIDER=openai but OPENAI_API_KEY is not set");
    return new OpenAIModerationProvider(env.OPENAI_API_KEY, env.OPENAI_MODERATION_MODEL || "omni-moderation-latest");
  }
  if (choice === "mock") return new MockModerationProvider();
  return new UnconfiguredProvider("No moderation provider configured (MODERATION_PROVIDER)");
}

export function providerLabel(p: { name: string; isMock: boolean; model: string }) {
  return p.isMock ? "Development mock (keyword heuristic — not AI)" : `OpenAI ${p.model}`;
}
