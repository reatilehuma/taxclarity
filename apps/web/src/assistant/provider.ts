import { LocalExplainer, RemoteAssistant, type TaxAssistantProvider } from "@taxclarity/assistant";

/**
 * Which assistant this build uses. The default answers on the device. A build made with
 * `VITE_ASSISTANT_PROVIDER=remote` talks to this site's own `/api/assistant` (docs/DEPLOY.md), which holds the
 * AI service's key. The choice is made when the site is built, so a visitor's browser never has to guess.
 */
export function createProvider(): TaxAssistantProvider {
  return import.meta.env.VITE_ASSISTANT_PROVIDER === "remote" ? new RemoteAssistant() : new LocalExplainer();
}
