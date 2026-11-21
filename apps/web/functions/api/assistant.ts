import { handleWithEnv, type ProxyEnv } from "@taxclarity/assistant-proxy";

/**
 * Cloudflare Pages Function at /api/assistant: the only server-side code in the project. It holds the AI service's
 * key (set as a secret in the Pages dashboard, never in the repository) and forwards allow-listed requests.
 * See docs/DEPLOY.md. The same code runs under scripts/serve.mjs for local and browser testing.
 */
export const onRequest = (context: { request: Request; env: ProxyEnv }): Promise<Response> => handleWithEnv(context.request, context.env);
