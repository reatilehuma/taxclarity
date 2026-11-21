import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const constructed: unknown[] = [];
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
    constructor(options: unknown) {
      constructed.push(options);
    }
  },
}));

const { anthropicComplete, DEFAULT_MODEL } = await import("../anthropic.ts");

beforeEach(() => {
  create.mockReset();
  constructed.length = 0;
});

const call = { system: ["RULES", "DATA\n{}"], messages: [{ role: "user" as const, content: "QUESTION:\nhi" }] };

describe("the Claude call", () => {
  it("asks the current model for a short answer, with fallbacks on and nothing the model does not accept", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "Hello." }] });
    const result = await anthropicComplete({ apiKey: "k" })(call);
    expect(result).toEqual({ kind: "text", text: "Hello." });
    const params = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.model).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("claude-opus-5-5");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.fallbacks).toBe("default");
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params.system).toEqual([{ type: "text", text: "RULES" }, { type: "text", text: "DATA\n{}" }]);
    expect(params.messages).toEqual(call.messages);
    // Things this model rejects, or that the assistant must never use.
    for (const forbidden of ["thinking", "temperature", "top_p", "top_k", "tool_choice", "tools", "stream"]) expect(params).not.toHaveProperty(forbidden);
    expect(params.max_tokens).toBeGreaterThanOrEqual(1_024);
  });

  it("uses the model named in the settings, and only the key it is given", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] });
    await anthropicComplete({ apiKey: "sk-test", model: "claude-haiku-5-5" })(call);
    expect((create.mock.calls[0]![0] as { model: string }).model).toBe("claude-haiku-5-5");
    expect(constructed[0]).toMatchObject({ apiKey: "sk-test", maxRetries: 1 });
  });

  it("joins the text blocks and ignores thinking and other blocks", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: "One." }, { type: "text", text: "Two." }],
    });
    expect(await anthropicComplete({ apiKey: "k" })(call)).toEqual({ kind: "text", text: "One.\n\nTwo." });
  });

  it("a refusal (the whole fallback chain declined) is reported as one", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", stop_details: { category: "general_harms" }, content: [] });
    expect(await anthropicComplete({ apiKey: "k" })(call)).toEqual({ kind: "refusal" });
  });

  it("lets a failure out for the proxy to turn into 'unavailable'", async () => {
    create.mockRejectedValue(new Error("boom"));
    await expect(anthropicComplete({ apiKey: "k" })(call)).rejects.toThrow("boom");
  });
});
