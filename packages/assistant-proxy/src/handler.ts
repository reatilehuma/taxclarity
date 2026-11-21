import { PayloadError, SAFE_FALLBACK, assertAllowedPayload, buildMessages, checkRandFigures, type AssistantPayload, type ChatTurn } from "@taxclarity/assistant";
import type { CompleteFn, ModelCall, ModelTurn } from "./types.ts";
import type { RateLimiter } from "./rateLimit.ts";

/**
 * The assistant's one server-side piece (PRD §15, plan D8). It exists only to hold the API key. It accepts a
 * single kind of request, checks it against the same allow-list the app uses, forwards it to the model, checks the
 * reply's figures, and returns the text. It stores nothing and logs nothing about what was asked or answered.
 *
 * It is written against the web-standard Request and Response, so the same code runs as a Cloudflare Pages
 * Function, in a Netlify function or in a small Node server.
 */

export const MAX_BODY_CHARS = 30_000;
export const MAX_QUESTION_CHARS = 500;
export const MAX_HISTORY_TURNS = 8;
export const MAX_TURN_CHARS = 1_000;

export interface ProxyOptions {
  complete: CompleteFn;
  /** Origins allowed to call it (for example ["https://cleartax.example"]). Empty means the site's own origin only. */
  allowedOrigins?: readonly string[];
  limiter?: RateLimiter;
  now?: () => number;
}

const HEADERS = { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" };

function reply(status: number, body: object, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
}

const fail = (status: number, error: string, extra?: Record<string, string>) => reply(status, { error }, extra);

/** Which visitor is this, for the rate limit? Hosts put the real address in one of these headers. */
function visitorOf(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

function originAllowed(request: Request, allowed: readonly string[]): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // browsers always send it on a POST; a bare script does not
  if (allowed.length > 0) return allowed.includes(origin);
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

interface Parsed {
  question: string;
  history: ChatTurn[];
  payload: AssistantPayload;
}

/** Returns the request's contents, or null if it is not exactly what the app sends. */
function parse(text: string): Parsed | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { question, history, payload, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return null; // nothing extra is accepted
  if (typeof question !== "string" || question.trim() === "" || question.length > MAX_QUESTION_CHARS) return null;
  const turns = history ?? [];
  if (!Array.isArray(turns) || turns.length > MAX_HISTORY_TURNS) return null;
  const checked: ChatTurn[] = [];
  for (const t of turns) {
    if (!t || typeof t !== "object") return null;
    const { role, text: turn, ...more } = t as Record<string, unknown>;
    if (Object.keys(more).length > 0 || (role !== "user" && role !== "assistant") || typeof turn !== "string" || turn.length > MAX_TURN_CHARS) return null;
    checked.push({ role, text: turn });
  }
  try {
    return { question, history: checked, payload: assertAllowedPayload(payload) };
  } catch (error) {
    if (error instanceof PayloadError) return null;
    throw error;
  }
}

/** The rules and data become the system part; the conversation is what follows. */
export function toModelCall(request: { question: string; history: ChatTurn[]; payload: AssistantPayload }): ModelCall {
  const messages = buildMessages(request);
  return {
    system: messages.filter((m) => m.role === "system").map((m) => m.content),
    messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  };
}

const retryNote = (invented: number[]) =>
  `Your last answer quoted amounts that are not in DATA (${invented.join(", ")}). Answer again. Copy every rand amount exactly as it appears in DATA, do not round, add or work out any amount, and if DATA does not have the figure you need, say so.`;

export async function handleAssistantRequest(request: Request, options: ProxyOptions): Promise<Response> {
  if (request.method !== "POST") return fail(405, "method_not_allowed", { allow: "POST" });
  if (!originAllowed(request, options.allowedOrigins ?? [])) return fail(403, "forbidden");
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return fail(415, "unsupported_media_type");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_CHARS) return fail(413, "too_large");

  const wait = options.limiter?.hit(visitorOf(request), (options.now ?? Date.now)());
  if (wait !== null && wait !== undefined) return fail(429, "rate_limited", { "retry-after": String(wait) });

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return fail(413, "too_large");
  const parsed = parse(text);
  if (!parsed) return fail(400, "bad_request"); // deliberately says nothing about what was wrong

  try {
    const call = toModelCall(parsed);
    let result = await options.complete(call);
    if (result.kind === "refusal") return reply(200, { text: SAFE_FALLBACK, replaced: true });
    let check = checkRandFigures(result.text, parsed.payload);
    if (!check.ok) {
      // One more try, told exactly what was wrong. If it still quotes a figure it was not given, say nothing of it.
      const again: ModelTurn[] = [...call.messages, { role: "assistant", content: result.text }, { role: "user", content: retryNote(check.invented) }];
      result = await options.complete({ system: call.system, messages: again });
      if (result.kind === "refusal") return reply(200, { text: SAFE_FALLBACK, replaced: true });
      check = checkRandFigures(result.text, parsed.payload);
      if (!check.ok) return reply(200, { text: SAFE_FALLBACK, replaced: true });
    }
    if (result.text.trim() === "") return fail(502, "unavailable");
    return reply(200, { text: result.text });
  } catch (error) {
    // The kind of failure is useful; what was asked and answered is not logged anywhere.
    console.error("assistant: the model call failed:", error instanceof Error ? error.name : "unknown");
    return fail(502, "unavailable");
  }
}
