import { LocalExplainer, type AssistantPayload } from "@taxclarity/assistant";
import type { CompleteFn } from "./types.ts";

/**
 * A stand-in for the model, for tests and for the browser tests that run the real page against the real proxy
 * without a key. Ordinary questions are answered from the DATA it was sent (by the local explainer), so replies are
 * realistic. A few trigger words make it misbehave on purpose, to prove the safety net catches each kind of failure:
 * "INVENT" quotes a figure it was not given (and keeps doing so), "RETRY" does so once and then behaves,
 * "REFUSE" declines, and "BREAK" throws.
 */
export function fakeModel(): CompleteFn {
  const explainer = new LocalExplainer();
  return async ({ system, messages }) => {
    const data = system.find((s) => s.startsWith("DATA"));
    const payload = JSON.parse(data!.slice(data!.indexOf("\n") + 1)) as AssistantPayload;
    const last = messages[messages.length - 1]!.content;
    // The question being asked now: the last turn that starts with QUESTION (earlier turns are history).
    const asked = [...messages].reverse().find((m) => m.role === "user" && m.content.startsWith("QUESTION:\n"))!.content.replace(/^QUESTION:\n/, "");
    const retried = last.startsWith("Your last answer quoted amounts");
    if (asked.includes("BREAK")) throw new Error("the model fell over");
    if (asked.includes("REFUSE")) return { kind: "refusal" };
    if (asked.includes("INVENT") || (asked.includes("RETRY") && !retried)) {
      return { kind: "text", text: "A bonus of R 10 000,00 would cost you R 3 900,00 in tax." };
    }
    const reply = await explainer.ask({ question: asked.replace(/RETRY|INVENT/g, ""), payload, history: [] });
    return { kind: "text", text: reply.text };
  };
}
