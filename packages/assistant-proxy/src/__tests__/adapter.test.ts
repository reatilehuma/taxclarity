import { afterEach, describe, expect, it, vi } from "vitest";
import { buildExplanations, buildRecommendations, calculate, CurrentTaxRules as rules } from "@taxclarity/tax-engine";
import { buildPayload } from "@taxclarity/assistant";
import { handleWithEnv } from "../index.ts";

const T1 = { mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" } as const;
const r = calculate(rules, T1);
const payload = buildPayload({ rules, result: r, explanations: buildExplanations(rules, T1, r), recommendations: buildRecommendations(rules, T1, r) });
const req = (ip = "9.9.9.9") =>
  new Request("https://site.test/api/assistant", { method: "POST", headers: { "content-type": "application/json", origin: "https://site.test", "cf-connecting-ip": ip }, body: JSON.stringify({ question: "What is UIF?", history: [], payload }) });

afterEach(() => vi.restoreAllMocks());

describe("running on a host", () => {
  it("without a key it says it is not set up, and asks no one", async () => {
    const res = await handleWithEnv(req(), {});
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('{"error":"not_configured"}');
  });

  it("an empty key counts as no key", async () => {
    expect((await handleWithEnv(req(), { ANTHROPIC_API_KEY: "" })).status).toBe(503);
  });

  it("the stand-in model works without a key, only when explicitly switched on", async () => {
    const ok = await handleWithEnv(req(), { ASSISTANT_FAKE_MODEL: "1" });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { text: string }).text).toContain("Unemployment Insurance Fund");
    expect((await handleWithEnv(req(), { ASSISTANT_FAKE_MODEL: "true" })).status).toBe(503);
  });

  it("the per-minute limit comes from the settings", async () => {
    const env = { ASSISTANT_FAKE_MODEL: "1", RATE_LIMIT_PER_MINUTE: "2" };
    expect((await handleWithEnv(req("7.7.7.7"), env)).status).toBe(200);
    expect((await handleWithEnv(req("7.7.7.7"), env)).status).toBe(200);
    expect((await handleWithEnv(req("7.7.7.7"), env)).status).toBe(429);
  });

  it("allowed origins come from the settings", async () => {
    const env = { ASSISTANT_FAKE_MODEL: "1", ALLOWED_ORIGINS: "https://other.example, https://more.example" };
    expect((await handleWithEnv(req("6.6.6.6"), env)).status).toBe(403);
  });
});
