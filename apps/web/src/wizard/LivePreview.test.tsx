// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../App.tsx";
import { copy } from "../content/strings.ts";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";
import { formatRand } from "../lib/format.ts";
import { applyPatch, INITIAL_ANSWERS, toEngineInputs, type WizardAnswers } from "./answers.ts";
import { DESKTOP_QUERY, LivePreview, PREVIEW_DEBOUNCE_MS } from "./LivePreview.tsx";
import { calculate, WizardProvider } from "./WizardContext.tsx";

const t = copy.live;

/** The preview contains the tax-year selector, which lives in the wizard's store, so it renders inside one. */
function Preview(props: React.ComponentProps<typeof LivePreview>) {
  return (
    <WizardProvider>
      <LivePreview {...props} />
    </WizardProvider>
  );
}

/** Makes the page "phone sized" (the default in jsdom) or "desktop sized". */
function setDesktop(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop && query === DESKTOP_QUERY,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const gross = (amount: number | null, extra: Partial<WizardAnswers> = {}) =>
  applyPatch(applyPatch(INITIAL_ANSWERS, { mode: "GROSS" }), { amount, ...extra });

const bank = (amount: number | null) => applyPatch(applyPatch(INITIAL_ANSWERS, { mode: "TAKE_HOME" }), { amount });

const norm = (s: string | null) => (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const engine = (a: WizardAnswers) => calculate(toEngineInputs(a));

beforeEach(() => {
  vi.useFakeTimers();
  setDesktop(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.style.overflow = "";
});

const settle = () => act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS));

describe("useDebouncedValue", () => {
  it("uses the first value at once", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 150));
    expect(result.current).toBe("a");
  });

  it("waits until the value stops changing", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 150), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 3 });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(1); // still waiting: it only went quiet 100 ms ago
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe(3); // and the in-between value 2 was never used
  });
});

describe("live preview on a phone", () => {
  it("shows placeholders until there is an amount", () => {
    render(<Preview answers={gross(null)} stepIndex={1} />);
    const bar = screen.getByRole("button", { name: /Take-home/ });
    expect(norm(bar.textContent)).toBe(`Take-home${t.bar.empty}PAYE${t.bar.empty}${t.bar.open}`);
    expect(screen.getByTestId("preview-announcer").textContent).toBe("");
  });

  it("opens the empty state in the sheet", () => {
    render(<Preview answers={gross(null)} stepIndex={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Take-home/ }));
    const dialog = screen.getByRole("dialog", { name: t.sheet.title });
    expect(within(dialog).getByText(t.emptyTitle)).toBeTruthy();
    expect(within(dialog).getByText(t.emptyCaption)).toBeTruthy();
  });

  it("shows the engine's take-home and PAYE for the current answers", () => {
    const a = gross(30_000);
    render(<Preview answers={a} stepIndex={1} />);
    const r = engine(a);
    const text = norm(screen.getByRole("button", { name: /Take-home/ }).textContent);
    expect(text).toContain(formatRand(r.takeHomeMonthly).replace(/ /g, " "));
    expect(text).toContain(formatRand(r.monthlyPaye).replace(/ /g, " "));
  });

  it("waits 150 ms after the answers change, then matches the engine again", () => {
    const first = gross(30_000);
    const second = gross(45_000);
    const { rerender } = render(<Preview answers={first} stepIndex={1} />);
    rerender(<Preview answers={second} stepIndex={1} />);

    const bar = () => norm(screen.getByRole("button", { name: /Take-home/ }).textContent);
    const money = (n: number) => formatRand(n).replace(/ /g, " ");
    expect(bar()).toContain(money(engine(first).monthlyPaye)); // not yet
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 1));
    expect(bar()).toContain(money(engine(first).monthlyPaye));
    act(() => vi.advanceTimersByTime(1));
    expect(bar()).toContain(money(engine(second).monthlyPaye));
    expect(bar()).toContain(money(engine(second).takeHomeMonthly));
  });

  it("goes back to the placeholders if the amount is cleared", () => {
    const { rerender } = render(<Preview answers={gross(30_000)} stepIndex={1} />);
    rerender(<Preview answers={gross(null)} stepIndex={1} />);
    settle();
    expect(norm(screen.getByRole("button", { name: /Take-home/ }).textContent)).toContain(t.bar.empty);
  });

  describe("the sheet", () => {
    const open = () => {
      const a = gross(30_000);
      const view = render(<Preview answers={a} stepIndex={2} />);
      const trigger = screen.getByRole("button", { name: /Take-home/ });
      fireEvent.click(trigger);
      return { ...view, trigger, a };
    };

    it("is a modal dialog showing the same numbers as the engine, and tells the page it is open", () => {
      const { trigger, a } = open();
      const dialog = screen.getByRole("dialog", { name: t.sheet.title });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
      const r = engine(a);
      expect(norm(dialog.textContent)).toContain(formatRand(r.takeHomeMonthly).replace(/ /g, " "));
      expect(norm(dialog.textContent)).toContain(formatRand(r.annualLiability).replace(/ /g, " "));
    });

    it("moves focus into the sheet and stops the page behind from scrolling", () => {
      open();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: new RegExp(t.sheet.close) }));
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("keeps Tab inside the sheet, wrapping at both ends", async () => {
      vi.useRealTimers();
      const user = userEvent.setup({ delay: null });
      const a = gross(30_000);
      render(<Preview answers={a} stepIndex={2} />);
      await user.click(screen.getByRole("button", { name: /Take-home/ }));
      const dialog = screen.getByRole("dialog");
      const inside = () => dialog.contains(document.activeElement);
      for (let i = 0; i < 25; i++) {
        await user.tab();
        expect(inside()).toBe(true);
      }
      for (let i = 0; i < 25; i++) {
        await user.tab({ shift: true });
        expect(inside()).toBe(true);
      }
    });

    it("closes with Escape and puts focus back on the bar", () => {
      const { trigger } = open();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(document.body.style.overflow).toBe("");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });

    it("closes with its Close button", () => {
      const { trigger } = open();
      fireEvent.click(screen.getByRole("button", { name: new RegExp(t.sheet.close) }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it("closes when you move to another step, without taking focus", () => {
      const a = gross(30_000);
      const { rerender } = render(
        <>
          <h1 tabIndex={-1} data-testid="heading">
            Question
          </h1>
          <Preview answers={a} stepIndex={2} />
        </>,
      );
      fireEvent.click(screen.getByRole("button", { name: /Take-home/ }));
      expect(screen.getByRole("dialog")).toBeTruthy();
      screen.getByTestId("heading").focus(); // what the wizard does when the step changes
      rerender(
        <>
          <h1 tabIndex={-1} data-testid="heading">
            Question
          </h1>
          <Preview answers={a} stepIndex={3} />
        </>,
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(screen.getByTestId("heading"));
      expect(document.body.style.overflow).toBe("");
    });

    it("releases the page scroll if the whole preview goes away while open", () => {
      const { unmount } = open();
      unmount();
      expect(document.body.style.overflow).toBe("");
    });
  });
});

describe("live preview on a wide screen", () => {
  beforeEach(() => setDesktop(true));

  it("shows a labelled side panel, not the bar or the sheet", () => {
    render(<Preview answers={gross(30_000)} stepIndex={1} />);
    expect(screen.getByRole("complementary", { name: t.regionLabel })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(t.bar.open) })).toBeNull();
  });

  it("shows the empty state first, then the engine's figures", () => {
    const { rerender } = render(<Preview answers={gross(null)} stepIndex={1} />);
    expect(screen.getByTestId("preview-empty")).toBeTruthy();
    // Until there is a result it makes no claim about the numbers being an estimate or accurate.
    expect(screen.queryByText(copy.common.estimate)).toBeNull();
    expect(screen.queryByText(copy.common.payslipAccurate)).toBeNull();
    expect(screen.getByText(t.emptyBadge)).toBeTruthy();

    const a = gross(30_000);
    rerender(<Preview answers={a} stepIndex={1} />);
    settle();
    expect(screen.queryByTestId("preview-empty")).toBeNull();
    const r = engine(a);
    const panel = norm(screen.getByRole("complementary").textContent);
    for (const value of [r.takeHomeMonthly, r.monthlyPaye, r.annualLiability, r.uifMonthly, r.grossMonthly]) {
      expect(panel).toContain(formatRand(value).replace(/ /g, " "));
    }
  });

  it("lists the full SARS bracket table with the person's bracket marked", () => {
    const a = gross(30_000);
    render(<Preview answers={a} stepIndex={1} />);
    const panel = within(screen.getByRole("complementary"));
    expect(panel.getByText(copy.panel.tableToggle)).toBeTruthy();
    expect(panel.getAllByText(copy.panel.youAreHere)).toHaveLength(1);
    expect(engine(a).bracketWalk.filter((b) => b.isTopBracket)).toHaveLength(1);
  });

  it("changes with the answers it is given: retirement lowers the PAYE it shows", () => {
    const plain = gross(30_000);
    const saving = applyPatch(plain, {
      retirement: { ...plain.retirement, has: true, payslipMonthly: 3_000 },
    });
    expect(engine(saving).monthlyPaye).toBeLessThan(engine(plain).monthlyPaye);
    const { rerender } = render(<Preview answers={plain} stepIndex={3} />);
    rerender(<Preview answers={saving} stepIndex={3} />);
    settle();
    expect(norm(screen.getByRole("complementary").textContent)).toContain(formatRand(engine(saving).monthlyPaye).replace(/ /g, " "));
  });
});

describe("what a screen reader is told", () => {
  it("only the mode badge is announced, and nothing else in the preview is a live region", () => {
    for (const desktop of [false, true]) {
      setDesktop(desktop);
      const { container, unmount } = render(<Preview answers={bank(20_000)} stepIndex={1} />);
      const live = container.querySelectorAll("[aria-live], [role=status], [role=alert], [role=log]");
      expect(live).toHaveLength(1);
      expect(live[0]!.getAttribute("aria-live")).toBe("polite");
      expect(live[0]!.textContent).toBe(t.announce.estimate);
      unmount();
    }
  });

  it("shows the Estimate badge for a bank amount and Payslip-accurate for gross pay", () => {
    setDesktop(true);
    const { rerender } = render(<Preview answers={bank(20_000)} stepIndex={1} />);
    const panel = () => within(screen.getByRole("complementary"));
    expect(panel().getByText(copy.common.estimate)).toBeTruthy();
    expect(panel().queryByText(copy.common.payslipAccurate)).toBeNull();
    rerender(<Preview answers={gross(30_000)} stepIndex={1} />);
    settle();
    expect(panel().getByText(copy.common.payslipAccurate)).toBeTruthy();
    expect(panel().queryByText(copy.common.estimate)).toBeNull();
    expect(screen.getByTestId("preview-announcer").textContent).toBe(t.announce.accurate);
  });

  it("says nothing before there is a result, then follows the engine's confidence", () => {
    const empty = applyPatch(INITIAL_ANSWERS, { mode: "PAYSLIP" });
    const withPayslip = applyPatch(applyPatch(empty, { amount: 30_000 }), { payslip: { paye: 3_149, uif: 177.12 } });
    const { rerender } = render(<Preview answers={empty} stepIndex={1} />);
    expect(screen.getByTestId("preview-announcer").textContent).toBe("");
    rerender(<Preview answers={withPayslip} stepIndex={1} />);
    settle();
    expect(engine(withPayslip).confidence).toBe("PAYSLIP_ACCURATE");
    expect(screen.getByTestId("preview-announcer").textContent).toBe(t.announce.accurate);
    rerender(<Preview answers={bank(20_000)} stepIndex={1} />);
    settle();
    expect(engine(bank(20_000)).confidence).toBe("ESTIMATE");
    expect(screen.getByTestId("preview-announcer").textContent).toBe(t.announce.estimate);
  });
});

describe("inside the wizard", () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    );

  beforeEach(() => vi.useRealTimers());

  it("has no preview on the very first screen", () => {
    renderAt("/wizard?step=0");
    expect(screen.queryByTestId("preview-announcer")).toBeNull();
    expect(screen.queryByRole("button", { name: /Take-home/ })).toBeNull();
  });

  it("has the preview from the amount question onward, empty at first, filled once you type", async () => {
    const user = userEvent.setup({ delay: null });
    renderAt("/wizard?start=gross");
    await screen.findByRole("heading", { level: 1 });
    expect(norm(screen.getByRole("button", { name: /Take-home/ }).textContent)).toContain(t.bar.empty);

    await user.type(screen.getByLabelText(/Gross pay/), "30000");
    const expected = engine(gross(30_000));
    await vi.waitFor(() => {
      const text = norm(screen.getByRole("button", { name: /Take-home/ }).textContent);
      expect(text).toContain(formatRand(expected.monthlyPaye).replace(/ /g, " "));
    });
  });

  it("keeps Tab inside an open sheet even though the form is right behind it", async () => {
    const user = userEvent.setup({ delay: null });
    renderAt("/wizard?start=gross");
    await user.type(await screen.findByLabelText(/Gross pay/), "30000");
    await user.click(screen.getByRole("button", { name: /Take-home/ }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});
