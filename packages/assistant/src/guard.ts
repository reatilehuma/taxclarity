import { PayloadError, assertAllowedPayload } from "./allowlist.ts";
import type { AuditLog } from "./audit.ts";
import { checkRandFigures } from "./figures.ts";
import type { AssistantRequest, TaxAssistantProvider } from "./types.ts";

export const SAFE_FALLBACK =
  "I can't give you a reliable answer to that, so I haven't shown one. Every figure on this page is calculated by the calculator, and the explanations on this page show how each part works. You can also try asking in a different way.";

export const UNAVAILABLE =
  "Assistant unavailable. Your results are fully calculated and shown on this page regardless.";

export interface SafeAnswer {
  text: string;
  /** "replaced" when the reply quoted a figure the calculator did not provide. */
  verdict: "shown" | "replaced";
  matched: number[];
}

/**
 * Asks a provider and checks the reply before anyone sees it. The payload is checked against the allow-list
 * first, so nothing off the list can reach a provider. A reply with an invented figure is swapped for a plain
 * apology, and either way what happened is written to the audit log.
 */
export async function askSafely(provider: TaxAssistantProvider, request: AssistantRequest, audit: AuditLog): Promise<SafeAnswer> {
  assertAllowedPayload(request.payload);
  let reply: string;
  try {
    reply = (await provider.ask(request)).text;
  } catch (error) {
    if (error instanceof PayloadError) throw error;
    return { text: UNAVAILABLE, verdict: "replaced", matched: [] };
  }
  const check = checkRandFigures(reply, request.payload);
  const verdict = check.ok ? "shown" : "replaced";
  audit.record({ question: request.question, reply, matched: check.matched, invented: check.invented, verdict });
  return { text: check.ok ? reply : SAFE_FALLBACK, verdict, matched: check.matched };
}
