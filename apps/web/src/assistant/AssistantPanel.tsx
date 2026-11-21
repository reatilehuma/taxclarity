import {
  AuditLog,
  askSafely,
  serialisePayload,
  buildPayload,
  type AssistantPayload,
  type ChatTurn,
  type TaxAssistantProvider,
} from "@taxclarity/assistant";
import type { CalculationResult, Explanation, Recommendation } from "@taxclarity/tax-engine";
import { useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon.tsx";
import { Modal } from "../components/Modal.tsx";
import { Button } from "../components/ui.tsx";
import { copy } from "../content/strings.ts";
import { rulesFor } from "../lib/years.ts";
import { grantConsent, hasConsent } from "./consent.ts";
import { createProvider } from "./provider.ts";

const t = copy.assistant;

interface Message {
  role: "user" | "assistant";
  text: string;
  /** For assistant messages: how many quoted figures were checked, and whether the draft was swapped. */
  checked?: number;
  replaced?: boolean;
}

/**
 * The assistant: a consent question the first time, then a chat drawer. It is downloaded only when opened, so
 * the calculator never depends on it (PRD §17.6). Nothing is asked of any provider until the person has said yes.
 */
export default function AssistantPanel({
  result,
  explanations,
  recommendations,
  onClose,
  onDeclined,
  provider: injected,
}: {
  result: CalculationResult;
  explanations: readonly Explanation[];
  recommendations: readonly Recommendation[];
  onClose: () => void;
  onDeclined: () => void;
  /** Tests (and, later, the real service) can supply their own provider. */
  provider?: TaxAssistantProvider;
}) {
  const provider = useMemo<TaxAssistantProvider>(() => injected ?? createProvider(), [injected]);
  const [agreed, setAgreed] = useState(() => hasConsent(provider.id));

  const payload = useMemo(() => buildPayload({ rules: rulesFor(result.taxYear), result, explanations, recommendations }), [result, explanations, recommendations]);

  if (!agreed) {
    return (
      <ConsentWindow
        provider={provider}
        payload={payload}
        onYes={() => {
          grantConsent(provider.id);
          setAgreed(true);
        }}
        onNo={onDeclined}
      />
    );
  }
  return <ChatDrawer provider={provider} result={result} explanations={explanations} recommendations={recommendations} onClose={onClose} />;
}

function ConsentWindow({
  provider,
  payload,
  onYes,
  onNo,
}: {
  provider: TaxAssistantProvider;
  payload: AssistantPayload;
  onYes: () => void;
  onNo: () => void;
}) {
  const c = t.consent;
  const lines = provider.runsOnDevice ? c.onDevice : c.external;
  return (
    <Modal title={c.title} onClose={onNo} initialFocus={() => document.getElementById("assistant-yes")}>
      <div
        role="region"
        aria-label={c.title}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="space-y-3 overflow-y-auto p-5 text-[15px] leading-relaxed text-ink-700 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {!provider.runsOnDevice && (
          <details className="rounded-xl bg-ink-50 px-3 py-1 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink-800">{c.previewSummary}</summary>
            <p className="pb-2 text-ink-600">{c.previewNote}</p>
            <pre
              className="mb-2 max-h-56 overflow-auto rounded-lg bg-surface p-3 text-xs break-all whitespace-pre-wrap text-ink-800 ring-1 ring-ink-200"
              // The preview scrolls, so it must be reachable by keyboard.
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              aria-label={c.previewSummary}
            >
              {JSON.stringify(JSON.parse(serialisePayload(payload)), null, 2)}
            </pre>
          </details>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-ink-200 p-4">
        <Button variant="ghost" onClick={onNo}>
          {c.no}
        </Button>
        <Button id="assistant-yes" onClick={onYes}>
          {c.yes}
        </Button>
      </div>
    </Modal>
  );
}

function ChatDrawer({
  provider,
  result,
  explanations,
  recommendations,
  onClose,
}: {
  provider: TaxAssistantProvider;
  result: CalculationResult;
  explanations: readonly Explanation[];
  recommendations: readonly Recommendation[];
  onClose: () => void;
}) {
  const payload = useMemo<AssistantPayload>(() => buildPayload({ rules: rulesFor(result.taxYear), result, explanations, recommendations }), [result, explanations, recommendations]);
  const [audit] = useState(() => new AuditLog());
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [, bump] = useState(0);
  const end = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setPending(true);
    try {
      const answer = await askSafely(provider, { question: q, payload, history }, audit);
      setMessages((m) => [...m, { role: "assistant", text: answer.text, checked: answer.matched.length, replaced: answer.verdict === "replaced" }]);
    } finally {
      setPending(false);
      bump((n) => n + 1);
      requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" }));
    }
  }

  return (
    <Modal title={t.drawerTitle} onClose={onClose} variant="drawer" initialFocus={() => document.getElementById("assistant-question")}>
      <div className="border-b border-ink-100 bg-ink-50 px-4 py-2 text-xs font-medium text-ink-600">{provider.runsOnDevice ? t.chip : t.chipExternal}</div>

      <div
        role="region"
        aria-label={t.conversation}
        // The conversation scrolls, so it must be reachable by keyboard.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <p className="text-[15px] text-ink-700">{t.greeting}</p>

        {messages.length === 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500">{t.suggestionsLabel}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {t.suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void ask(s)}
                    className="min-h-11 rounded-full bg-surface px-4 py-2 text-left text-sm font-medium text-brand-800 ring-1 ring-ink-300 hover:bg-brand-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* New answers are read out politely as they arrive. */}
        <div role="log" aria-live="polite" aria-relevant="additions" className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}>
              <p className="mb-1 text-xs font-semibold text-ink-500">{m.role === "user" ? t.you : t.assistant}</p>
              <div className={`max-w-[92%] space-y-2 rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.role === "user" ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-900"}`}>
                {m.text.split("\n\n").map((para, j) => (
                  <p key={j} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
              {m.role === "assistant" && (m.replaced || (m.checked ?? 0) > 0) && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-600">
                  <Icon name="checkCircle" className="h-3.5 w-3.5" />
                  {m.replaced ? t.replaced : t.checked(m.checked ?? 0)}
                </p>
              )}
            </div>
          ))}
          {pending && (
            <p className="text-sm text-ink-600">
              {t.assistant}: {t.thinking}…
            </p>
          )}
        </div>
        <div ref={end} />
      </div>

      <details className="border-t border-ink-100 px-4 py-2 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink-700">{t.logHeading}</summary>
        {audit.entries().length === 0 ? (
          <p className="pb-2 text-ink-600">{t.logEmpty}</p>
        ) : (
          <ol className="space-y-1 pb-2 text-ink-700">
            {audit.entries().map((e) => (
              <li key={e.at + e.question}>
                <span className="font-medium">{e.question}</span>: {t.logRow(e.matched.length, e.invented.length)}
              </li>
            ))}
          </ol>
        )}
      </details>

      <form
        className="border-t border-ink-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="assistant-question" className="mb-1 block text-sm font-semibold text-ink-800">
          {t.inputLabel}
        </label>
        <div className="flex items-end gap-2">
          <input
            id="assistant-question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            autoComplete="off"
            aria-describedby="assistant-hint"
            className="min-h-12 min-w-0 flex-1 rounded-xl bg-surface px-3 text-base text-ink-950 ring-1 ring-ink-300 focus:ring-2 focus:ring-brand-600 focus:outline-none"
          />
          <Button type="submit" disabled={pending || question.trim() === ""}>
            {t.send}
          </Button>
        </div>
        <p id="assistant-hint" className="mt-1.5 text-xs text-ink-600">
          {t.inputHint}
        </p>
        <p className="mt-2 text-xs text-ink-600">{t.attribution}</p>
      </form>
    </Modal>
  );
}
