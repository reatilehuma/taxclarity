// @vitest-environment jsdom
import { calculate, CurrentTaxRules as rules } from "@taxclarity/tax-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppRoutes } from "../App.tsx";
import { EXAMPLE_INPUTS, EXAMPLE_RESULT } from "../content/example.ts";
import { copy, PRODUCT_NAME, ruleCopy } from "../content/strings.ts";
import { formatRand } from "../lib/format.ts";

beforeAll(() => {
  // jsdom has no matchMedia or scrolling; the app only reads them.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  window.scrollTo = () => {};
});

afterEach(cleanup);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

/** Text with non-breaking spaces normalised, for matching formatted money. */
const norm = (s: string | null) => (s ?? "").replace(/ /g, " ");

describe("landing page", () => {
  it("shows the required headline as the only h1 (PRD §2.5)", () => {
    renderAt("/");
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]!.textContent).toBe("Understand Your Salary. Pay the Right Tax. Keep More of Your Money.");
  });

  it("has every PRD §13.1 section", () => {
    renderAt("/");
    for (const name of [copy.how.heading, copy.preview.heading, copy.capabilities.heading, copy.privacy.heading]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    // The first trust line names the tax year, so it is built from the chosen year's rules.
    for (const line of [ruleCopy(rules).trustSars, ...copy.trust.slice(1)]) expect(screen.getByText(line)).toBeTruthy();
    expect(screen.getByText(copy.footer.disclaimer)).toBeTruthy();
    expect(screen.getByText(copy.footer.madeFor)).toBeTruthy();
  });

  it("hero CTAs start the wizard in the right mode", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: copy.hero.primaryCta }).getAttribute("href")).toBe("/wizard?start=take-home");
    expect(screen.getByRole("link", { name: copy.hero.secondaryCta }).getAttribute("href")).toBe("/wizard?start=gross");
    expect(screen.getAllByRole("link", { name: copy.nav.cta })[0]!.getAttribute("href")).toBe("/wizard");
  });

  it("has the landmarks and skip link (PRD §17.3)", () => {
    renderAt("/");
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main").id).toBe("main");
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("link", { name: copy.common.skipToContent }).getAttribute("href")).toBe("#main");
  });

  it("labels the dashboard preview as an example", () => {
    renderAt("/");
    const preview = screen.getByRole("heading", { level: 2, name: copy.preview.heading }).closest("section")!;
    expect(within(preview).getByText(copy.common.example)).toBeTruthy();
    expect(within(preview).getByText(copy.preview.exampleLabel)).toBeTruthy();
  });

  it("shows example figures straight from the engine", () => {
    renderAt("/");
    const fresh = calculate(rules, EXAMPLE_INPUTS);
    expect(EXAMPLE_RESULT.takeHomeMonthly).toBe(fresh.takeHomeMonthly);
    const preview = screen.getByRole("heading", { level: 2, name: copy.preview.heading }).closest("section")!;
    expect(norm(preview.textContent)).toContain(norm(formatRand(fresh.takeHomeMonthly)));
    expect(norm(preview.textContent)).toContain(norm(formatRand(fresh.monthlyPaye)));
  });

  it("the bracket table marks one row as 'You are here'", () => {
    renderAt("/");
    expect(screen.getAllByText(copy.panel.youAreHere)).toHaveLength(1);
  });

  it("sets the tab title", () => {
    renderAt("/");
    expect(document.title).toBe(copy.meta.landingTitle);
    expect(document.title).toContain(PRODUCT_NAME);
  });
});

describe("routing", () => {
  it("unknown paths show a friendly not-found page", () => {
    renderAt("/nope");
    expect(screen.getByRole("heading", { level: 1, name: copy.notFound.title })).toBeTruthy();
  });
});

describe("moving to the questions", () => {
  it("tapping a start button lands on the first question with focus on its heading, so a screen reader announces it", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderAt("/");
    await userEvent.setup({ delay: null }).click(screen.getAllByRole("link", { name: copy.hero.secondaryCta })[0]!);
    const heading = await screen.findByRole("heading", { level: 1, name: /gross monthly salary/ });
    expect(document.activeElement).toBe(heading);
  });

  it("opening a question address directly leaves focus alone, so the skip link is still the first stop", () => {
    renderAt("/wizard?step=1");
    expect(document.activeElement).toBe(document.body);
  });
});

describe("landing page: the tax year (Phase 19)", () => {
  const blurb = (title: string) => norm(screen.getByRole("heading", { level: 3, name: title }).parentElement!.textContent);

  it("quotes the default year's figures and has no example note", () => {
    renderAt("/");
    expect(screen.getByText("Based on official SARS 2026/27 rules")).toBeTruthy();
    expect(blurb("UIF")).toContain("R 177,12");
    expect(blurb("Pension, provident & RA")).toContain("R 430 000");
    expect(blurb("Medical aid credits")).toContain("R 376");
    expect(screen.queryByTestId("example-year-note")).toBeNull();
  });

  it("choosing 2025/26 changes the trust line and the capability figures, and says the example stays on 2026/27", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    renderAt("/");
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2025-26");
    expect(screen.getByText("Based on official SARS 2025/26 rules")).toBeTruthy();
    expect(screen.queryByText("Based on official SARS 2026/27 rules")).toBeNull();
    expect(blurb("Pension, provident & RA")).toContain("R 350 000");
    expect(blurb("Pension, provident & RA")).not.toContain("R 430 000");
    expect(blurb("Medical aid credits")).toContain("R 364");
    expect(blurb("Medical aid credits")).toContain("R 246");
    expect(blurb("Medical aid credits")).not.toContain("R 376");
    expect(screen.getByTestId("example-year-note").textContent).toBe("The example below always uses the 2026/27 rules, whichever tax year you choose.");
    // The example itself is still the default year's.
    expect(norm(document.body.textContent)).toContain(norm(formatRand(EXAMPLE_RESULT.takeHomeMonthly)));
    expect(EXAMPLE_RESULT.taxYear).toBe("2026-27");
    // Back to the default year: the note goes.
    await user.selectOptions(screen.getByLabelText(copy.taxYear.label), "2026-27");
    expect(screen.queryByTestId("example-year-note")).toBeNull();
    expect(blurb("Pension, provident & RA")).toContain("R 430 000");
  });
});
