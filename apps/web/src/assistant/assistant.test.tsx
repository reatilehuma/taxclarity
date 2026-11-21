// @vitest-environment jsdom
import { SAFE_FALLBACK, UNAVAILABLE, buildPayload, serialisePayload, type TaxAssistantProvider } from "@taxclarity/assistant";
import { buildExplanations, buildRecommendations, calculate, CurrentTaxRules as rules } from "@taxclarity/tax-engine";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../content/strings.ts";
import { ResultsPage } from "../pages/Results.tsx";
import { applyPatch, INITIAL_ANSWERS, toEngineInputs, type WizardAnswers } from "../wizard/answers.ts";
import { WizardProvider } from "../wizard/WizardContext.tsx";
import { assistantPanel } from "./AssistantButton.tsx";
import AssistantPanel from "./AssistantPanel.tsx";
import { grantConsent } from "./consent.ts";

const t = copy.assistant;
const KEY = "cleartax.assistant";

const T1: WizardAnswers = applyPatch(applyPatch(INITIAL_ANSWERS, { mode: "GROSS" }), {
  amount: 30_000,
  retirement: { ...INITIAL_ANSWERS.retirement, has: true, payslipMonthly: 3_000 },
  medical: { ...INITIAL_ANSWERS.medical, member: true, members: 2, monthlyTotal: 0 },
});

const flat = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

function show(answers = T1) {
  const user = userEvent.setup({ delay: null });
  const view = render(
    <WizardProvider initial={answers}>
      <MemoryRouter initialEntries={["/results"]}>
        <Routes>
          <Route path="results" element={<ResultsPage />} />
          <Route path="wizard" element={<p>wizard</p>} />
        </Routes>
      </MemoryRouter>
    </WizardProvider>,
  );
  return { user, ...view };
}

// The assistant is a separate download in the app; load it up front so the first test is not waiting on that.
beforeAll(async () => {
  await assistantPanel.preload();
});

let fetchSpy: ReturnType<typeof vi.fn>;
let beaconSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.localStorage.clear();
  fetchSpy = vi.fn(() => Promise.reject(new Error("the network was used")));
  beaconSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("XMLHttpRequest", vi.fn());
  Object.defineProperty(navigator, "sendBeacon", { value: beaconSpy, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const openAssistant = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: t.open }));
const noNetwork = () => {
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(beaconSpy).not.toHaveBeenCalled();
};

describe("the entry point", () => {
  it("is on the results page, and nothing has happened before it is used", () => {
    show();
    expect(screen.getByRole("button", { name: t.open }).getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.length).toBe(0);
    noNetwork();
  });
});

describe("consent (PRD §15.2.2)", () => {
  it("the first use asks, says what happens, and sends nothing yet", async () => {
    const { user } = show();
    await openAssistant(user);
    const dialog = await screen.findByRole("dialog", { name: t.consent.title });
    for (const line of t.consent.onDevice) expect(within(dialog).getByText(line)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: t.consent.yes })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: t.consent.no })).toBeTruthy();
    expect(window.localStorage.length).toBe(0);
    noNetwork();
  });

  it("focus starts on 'Enable assistant'", async () => {
    const { user } = show();
    await openAssistant(user);
    expect(document.activeElement).toBe(await screen.findByRole("button", { name: t.consent.yes }));
  });

  it("'No thanks' closes it, stores nothing, says the assistant is unavailable, and leaves the results exactly as they were", async () => {
    const { user } = show();
    const before = flat(screen.getByRole("heading", { level: 1 }).textContent);
    await openAssistant(user);
    await user.click(await screen.findByRole("button", { name: t.consent.no }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(t.unavailable)).toBeTruthy();
    expect(window.localStorage.length).toBe(0);
    expect(flat(screen.getByRole("heading", { level: 1 }).textContent)).toBe(before);
    noNetwork();
  });

  it("Escape counts as 'No thanks'", async () => {
    const { user } = show();
    await openAssistant(user);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(t.unavailable)).toBeTruthy();
    expect(window.localStorage.length).toBe(0);
  });

  it("after a 'no' it asks again next time", async () => {
    const { user } = show();
    await openAssistant(user);
    await user.click(await screen.findByRole("button", { name: t.consent.no }));
    await openAssistant(user);
    expect(await screen.findByRole("dialog", { name: t.consent.title })).toBeTruthy();
    expect(screen.queryByText(t.unavailable)).toBeNull();
  });

  it("'Enable assistant' remembers one thing only: that you agreed to this assistant", async () => {
    const { user } = show();
    await openAssistant(user);
    await user.click(await screen.findByRole("button", { name: t.consent.yes }));
    expect(await screen.findByRole("dialog", { name: t.drawerTitle })).toBeTruthy();
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem(KEY)).toBe("local-explainer");
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    noNetwork();
  });

  it("a remembered yes skips the question next time", async () => {
    grantConsent("local-explainer");
    const { user } = show();
    await openAssistant(user);
    expect(await screen.findByRole("dialog", { name: t.drawerTitle })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: t.consent.title })).toBeNull();
  });

  it("a yes given to a different assistant does not carry over", async () => {
    window.localStorage.setItem(KEY, "some-outside-service");
    const { user } = show();
    await openAssistant(user);
    expect(await screen.findByRole("dialog", { name: t.consent.title })).toBeTruthy();
  });

  it("if the browser refuses storage, the assistant still works and simply asks again later", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { user } = show();
    await openAssistant(user);
    await user.click(await screen.findByRole("button", { name: t.consent.yes }));
    expect(await screen.findByRole("dialog", { name: t.drawerTitle })).toBeTruthy();
  });

  it("the wording for an outside service is ready, says what is sent, and is not shown for the local assistant", () => {
    const external = t.consent.external.join(" ");
    expect(external).toContain("sent to that service");
    expect(external).toContain("never your name, ID or tax number");
    expect(external).toContain("We store nothing");
    expect(t.consent.onDevice.join(" ")).not.toContain("external AI service. If you continue");
  });
});

describe("the chat", () => {
  const open = async () => {
    grantConsent("local-explainer");
    const ui = show();
    await openAssistant(ui.user);
    const dialog = await screen.findByRole("dialog", { name: t.drawerTitle });
    return { ...ui, dialog };
  };

  it("has the honest label, the attribution, a labelled question box with focus, and suggested questions", async () => {
    const { dialog } = await open();
    expect(within(dialog).getByText(t.chip)).toBeTruthy();
    expect(within(dialog).getByText(t.attribution)).toBeTruthy();
    const input = within(dialog).getByLabelText(t.inputLabel);
    expect(document.activeElement).toBe(input);
    for (const s of t.suggestions) expect(within(dialog).getByRole("button", { name: s })).toBeTruthy();
  });

  it("answers a suggested question with the calculator's figures, and says they were checked", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Which tax bracket am I in?" }));
    const log = await within(dialog).findByRole("log");
    await waitFor(() => expect(flat(log.textContent)).toContain("26%"));
    const text = flat(log.textContent).replace(/ /g, " ");
    expect(text).toContain("R 324 000,00");
    expect(text).toContain("R 37 788,00");
    expect(within(dialog).getByText(/Checked: all \d+ figures match your results/)).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Which tax bracket am I in?" })).toBeNull(); // suggestions go once you start
    noNetwork();
  });

  it("every figure in every answer is one the page already shows (the same check the assistant runs)", async () => {
    const { user, dialog } = await open();
    const input = within(dialog).getByLabelText(t.inputLabel);
    for (const q of ["How much would an RA save me?", "Why is my PAYE what it is?", "What is UIF?", "How is my take-home worked out?"]) {
      await user.type(input, q);
      await user.click(within(dialog).getByRole("button", { name: t.send }));
      await waitFor(() => expect(within(dialog).queryByText(`${t.assistant}: ${t.thinking}…`)).toBeNull());
    }
    const inputs = toEngineInputs(T1);
    const r = calculate(rules, inputs);
    const allowed = new Set(
      JSON.stringify([r, buildExplanations(rules, inputs, r), buildRecommendations(rules, inputs, r), rules])
        .match(/-?\d+(\.\d+)?/g)!
        .map((n) => Number(n)),
    );
    const log = flat(within(dialog).getByRole("log").textContent).replace(/ /g, " ");
    const amounts = [...log.matchAll(/R \d[\d ]*(?:,\d\d)?/g)].map((m) => Number(m[0].replace(/R|\s/g, "").replace(",", ".")));
    expect(amounts.length).toBeGreaterThan(5);
    for (const a of amounts) expect(allowed.has(a) || a === 0, `R${a} is not a calculator figure`).toBe(true);
  });

  it("typing a question and pressing Enter sends it; an empty box cannot be sent", async () => {
    const { user, dialog } = await open();
    const send = within(dialog).getByRole("button", { name: t.send }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await user.type(within(dialog).getByLabelText(t.inputLabel), "What is UIF?{Enter}");
    expect(await within(dialog).findByText(/Unemployment Insurance Fund/)).toBeTruthy();
    expect((within(dialog).getByLabelText(t.inputLabel) as HTMLInputElement).value).toBe("");
  });

  it("declines to give advice, politely", async () => {
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText(t.inputLabel), "Should I invest my bonus?{Enter}");
    expect(await within(dialog).findByText(/registered tax practitioner/)).toBeTruthy();
  });

  it("the 'what was checked' list fills as you go", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByText(t.logHeading));
    expect(within(dialog).getByText(t.logEmpty)).toBeTruthy();
    await user.type(within(dialog).getByLabelText(t.inputLabel), "What is UIF?{Enter}");
    await within(dialog).findByText(/Unemployment Insurance Fund/);
    expect(await within(dialog).findByText(/What is UIF\?/, { selector: "li span" })).toBeTruthy();
    expect(within(dialog).queryByText(t.logEmpty)).toBeNull();
  });

  it("Escape closes it and focus goes back to the button that opened it", async () => {
    const { user } = await open();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: t.open }));
  });

  it("keeps Tab inside, and stops the page behind from scrolling while it is open", async () => {
    const { user, dialog } = await open();
    expect(document.body.style.overflow).toBe("hidden");
    for (let i = 0; i < 14; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 14; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.click(within(dialog).getByRole("button", { name: /Close/ }));
    expect(document.body.style.overflow).toBe("");
  });

  it("answers are announced politely as they arrive", async () => {
    const { dialog } = await open();
    const log = within(dialog).getByRole("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
  });
});

describe("when an answer is not safe, or the assistant fails", () => {
  const panel = (provider: TaxAssistantProvider, onClose = () => {}) => {
    grantConsent(provider.id);
    const inputs = toEngineInputs(T1);
    const result = calculate(rules, inputs);
    return render(
      <AssistantPanel
        result={result}
        explanations={buildExplanations(rules, inputs, result)}
        recommendations={buildRecommendations(rules, inputs, result)}
        onClose={onClose}
        onDeclined={() => {}}
        provider={provider}
      />,
    );
  };
  const make = (ask: TaxAssistantProvider["ask"], over: Partial<TaxAssistantProvider> = {}): TaxAssistantProvider => ({ id: "test-provider", label: "Test", runsOnDevice: true, ask, ...over });

  it("a reply with an invented figure is replaced and never shown, and the log says so", async () => {
    const user = userEvent.setup({ delay: null });
    panel(make(async () => ({ text: "A bonus of R 10 000,00 would cost you R 3 900,00 in tax." })));
    const dialog = await screen.findByRole("dialog", { name: t.drawerTitle });
    await user.click(within(dialog).getByText(t.logHeading));
    await user.type(within(dialog).getByLabelText(t.inputLabel), "What if I got a bonus?{Enter}");
    expect(await within(dialog).findByText(SAFE_FALLBACK)).toBeTruthy();
    expect(dialog.textContent).not.toContain("3 900");
    expect(within(dialog).getByText(t.replaced)).toBeTruthy();
    expect(within(dialog).getByText(/0 matched, 2 not from the calculator \(answer replaced\)/)).toBeTruthy();
  });

  it("if the assistant fails, the chat says it is unavailable and nothing else on the page changes", async () => {
    const user = userEvent.setup({ delay: null });
    panel(make(async () => { throw new Error("service down"); }));
    const dialog = await screen.findByRole("dialog", { name: t.drawerTitle });
    await user.type(within(dialog).getByLabelText(t.inputLabel), "hello{Enter}");
    expect(await within(dialog).findByText(UNAVAILABLE)).toBeTruthy();
  });

  it("an outside-service provider gets the outside-service consent wording and its own chip", async () => {
    window.localStorage.clear();
    const inputs = toEngineInputs(T1);
    const result = calculate(rules, inputs);
    const ask = vi.fn(async () => ({ text: "hello" }));
    render(
      <AssistantPanel
        result={result}
        explanations={buildExplanations(rules, inputs, result)}
        recommendations={buildRecommendations(rules, inputs, result)}
        onClose={() => {}}
        onDeclined={() => {}}
        provider={make(ask, { id: "outside", runsOnDevice: false })}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: t.consent.title });
    expect(within(dialog).getByText(t.consent.external[0]!)).toBeTruthy();
    expect(ask).not.toHaveBeenCalled(); // nothing is asked of the service before a yes
    await userEvent.setup({ delay: null }).click(within(dialog).getByRole("button", { name: t.consent.yes }));
    expect(await screen.findByText(t.chipExternal)).toBeTruthy();
    expect(ask).not.toHaveBeenCalled(); // and not before the first question either
  });

  it("an outside-service assistant shows exactly what would be sent, and it is only calculator figures", async () => {
    const inputs = toEngineInputs(T1);
    const result = calculate(rules, inputs);
    const explanations = buildExplanations(rules, inputs, result);
    const recommendations = buildRecommendations(rules, inputs, result);
    const ask = vi.fn(async () => ({ text: "hello" }));
    render(
      <AssistantPanel result={result} explanations={explanations} recommendations={recommendations} onClose={() => {}} onDeclined={() => {}} provider={make(ask, { id: "outside-2", runsOnDevice: false })} />,
    );
    const dialog = await screen.findByRole("dialog", { name: t.consent.title });
    await userEvent.setup({ delay: null }).click(within(dialog).getByText(t.consent.previewSummary));
    const preview = within(dialog).getByLabelText(t.consent.previewSummary);
    const shown = JSON.parse(preview.textContent ?? "{}") as Record<string, unknown>;
    expect(shown).toEqual(JSON.parse(serialisePayload(buildPayload({ rules, result, explanations, recommendations }))));
    expect(Object.keys(shown).sort()).toEqual(["ageBand", "bracketWalk", "comparison", "confidence", "explanations", "figures", "mode", "payFrequency", "recommendations", "rules", "taxYear"]);
    expect(preview.textContent).not.toMatch(/name|email|employer|bank|account|tax_?ref|idNumber/i);
    expect(within(dialog).getByText(t.consent.previewNote)).toBeTruthy();
    expect(ask).not.toHaveBeenCalled();
  });

  it("the on-device assistant has no 'what would be sent' section: nothing is sent", async () => {
    const { user } = show();
    await user.click(screen.getByRole("button", { name: t.open }));
    await screen.findByRole("dialog", { name: t.consent.title });
    expect(screen.queryByText(t.consent.previewSummary)).toBeNull();
  });
});
