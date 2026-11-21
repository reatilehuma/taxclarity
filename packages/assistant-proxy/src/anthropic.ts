import Anthropic from "@anthropic-ai/sdk";
import type { CompleteFn } from "./types.ts";

/** The default model. Cheaper ones (for example "claude-haiku-5-5") are a one-line change through ASSISTANT_MODEL. */
export const DEFAULT_MODEL = "claude-opus-5-5";

/**
 * Asks Claude. Short answers, so low effort; thinking stays on because this model cannot turn it off. If a
 * safety classifier declines, the platform retries on a fallback model by itself (server-side fallbacks); if the
 * whole chain declines, the result is a refusal and the caller shows a plain apology.
 */
export function anthropicComplete(options: { apiKey: string; model?: string | undefined }): CompleteFn {
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 30_000 });
  const model = options.model || DEFAULT_MODEL;
  return async ({ system, messages }) => {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 2_048,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: system.map((text) => ({ type: "text" as const, text })),
      messages,
    });
    if (response.stop_reason === "refusal") return { kind: "refusal" };
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n\n")
      .trim();
    return { kind: "text", text };
  };
}
