import { assertAllowedPayload } from "./allowlist.ts";
import type { AssistantReply, AssistantRequest, TaxAssistantProvider } from "./types.ts";

/**
 * The assistant that runs on an outside AI service, reached through this site's own small proxy (which holds the
 * API key). The request body is built here, after the payload has passed the allow-list, and carries nothing else:
 * no cookies, no referrer, no identifiers. Anything that goes wrong (offline, a refusal, a timeout) is an error, which the
 * caller turns into "Assistant unavailable".
 */
export class RemoteAssistant implements TaxAssistantProvider {
  readonly id = "claude-proxy";
  readonly label = "AI assistant";
  readonly runsOnDevice = false;

  // Plain fields, not constructor parameter properties, so Node can run this file directly (the live check does).
  private readonly endpoint: string;
  private readonly send: typeof fetch;
  private readonly timeoutMs: number;

  constructor(endpoint = "/api/assistant", send: typeof fetch = (input, init) => fetch(input, init), timeoutMs = 35_000) {
    this.endpoint = endpoint;
    this.send = send;
    this.timeoutMs = timeoutMs;
  }

  async ask(request: AssistantRequest): Promise<AssistantReply> {
    const payload = assertAllowedPayload(request.payload);
    const body = JSON.stringify({
      question: request.question.slice(0, 500),
      history: request.history.slice(-8).map((t) => ({ role: t.role, text: t.text.slice(0, 1_000) })),
      payload,
    });
    const response = await this.send(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`the assistant service answered ${response.status}`);
    const data = (await response.json()) as { text?: unknown };
    if (typeof data.text !== "string" || data.text.trim() === "") throw new Error("the assistant service sent no answer");
    return { text: data.text };
  }
}
