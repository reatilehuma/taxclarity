import { anthropicComplete } from "./anthropic.ts";
import { fakeModel } from "./fake.ts";
import { handleAssistantRequest } from "./handler.ts";
import { createRateLimiter, type RateLimiter } from "./rateLimit.ts";

/** The settings a host provides. Every one is optional except the key, which is a secret set in the host's dashboard. */
export interface ProxyEnv {
  ANTHROPIC_API_KEY?: string | undefined;
  /** Defaults to claude-opus-5-5. A cheaper model (for example claude-haiku-5-5) is a change of this one value. */
  ASSISTANT_MODEL?: string | undefined;
  /** Comma-separated origins allowed to call it. Empty: this site only. */
  ALLOWED_ORIGINS?: string | undefined;
  /** Requests per visitor per minute. Default 12. */
  RATE_LIMIT_PER_MINUTE?: string | undefined;
  /** "1" answers with a stand-in model and needs no key. For tests only: never set this on a live site. */
  ASSISTANT_FAKE_MODEL?: string | undefined;
}

let limiter: RateLimiter | null = null;
let limiterFor = "";

/** One entry point for every host: turns settings into a configured proxy and answers the request. */
export function handleWithEnv(request: Request, env: ProxyEnv): Promise<Response> {
  const fake = env.ASSISTANT_FAKE_MODEL === "1";
  if (!fake && !env.ANTHROPIC_API_KEY) {
    // Not set up yet. Say so plainly; the page shows "Assistant unavailable" and the calculator is unaffected.
    return Promise.resolve(new Response('{"error":"not_configured"}', { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } }));
  }
  const perMinute = Math.max(1, Number(env.RATE_LIMIT_PER_MINUTE) || 12);
  if (!limiter || limiterFor !== String(perMinute)) {
    limiter = createRateLimiter(perMinute, 60_000);
    limiterFor = String(perMinute);
  }
  const origins = (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  return handleAssistantRequest(request, {
    complete: fake ? fakeModel() : anthropicComplete({ apiKey: env.ANTHROPIC_API_KEY!, model: env.ASSISTANT_MODEL }),
    allowedOrigins: origins,
    limiter,
  });
}
