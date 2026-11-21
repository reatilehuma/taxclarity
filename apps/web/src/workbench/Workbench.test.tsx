// @vitest-environment jsdom
import { getRuleSet, RULE_SETS, TaxRules2025_26, TaxRules2026_27 } from "@taxclarity/tax-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SOURCES } from "../lib/sources.ts";
import { Workbench } from "./Workbench.tsx";
import { compareRows, parameterRows } from "./years.ts";
import { calculate } from "@taxclarity/tax-engine";

afterEach(cleanup);

const flat = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

describe("Workbench: year dropdown", () => {
  it("starts on 2026/27 with no draft banner", () => {
    render(<Workbench />);
    expect((screen.getByLabelText("Tax year") as HTMLSelectElement).value).toBe("2026-27");
    expect(screen.queryByText(/Draft: not signed off/)).toBeNull();
  });

  it("switches to 2025/26: draft banner, its own labels and its own numbers", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Workbench />);
    await user.selectOptions(screen.getByLabelText("Tax year"), "2025-26");
    expect(screen.getByRole("status").textContent).toMatch(/Draft: not signed off/);
    expect(screen.getByText(/Age on 28 February 2026/)).toBeTruthy();
    // R30 000 a month, no extras: 2025/26 final tax is R57 397 a year (hand-worked in rulesets.test.ts).
    expect(flat(document.body.textContent)).toContain("SARS 2025/26 brackets");
    await user.selectOptions(screen.getByLabelText("Tax year"), "2026-27");
    expect(screen.queryByText(/Draft: not signed off/)).toBeNull();
    expect(flat(document.body.textContent)).toContain("SARS 2026/27 brackets");
  });

  it("does not show 2026/27 expected figures against another year", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Workbench />);
    await user.selectOptions(screen.getByLabelText("Load a PRD test vector"), "T1");
    expect(screen.getByText(/Expect \(T1\)/)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Tax year"), "2025-26");
    expect(screen.queryByText(/Expect \(T1\)/)).toBeNull();
    expect(screen.getByText(/T1's expected figures are for 2026\/27/)).toBeTruthy();
  });
});

describe("Workbench: Compare years", () => {
  it("shows both years side by side for the same inputs, highlighting differences", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Workbench />);
    await user.click(screen.getByRole("tab", { name: "Compare years" }));
    const table = screen.getByRole("table", { name: /Comparison of 2025\/26 and 2026\/27/ });
    const rows = within(table).getAllByRole("row");
    const liability = rows.find((r) => within(r).queryByText("Final tax for the year"))!;
    const a = calculate(TaxRules2025_26, { mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" });
    const b = calculate(TaxRules2026_27, { mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" });
    expect(flat(liability.textContent)).toContain(flat(new Intl.NumberFormat("en-ZA").format(a.annualLiability)));
    expect(a.annualLiability).not.toBe(b.annualLiability);
    expect(liability.className).toContain("bg-amber-50");
  });
});

describe("Workbench: Parameters", () => {
  it("lists the chosen year's values with source links", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Workbench />);
    await user.selectOptions(screen.getByLabelText("Tax year"), "2025-26");
    await user.click(screen.getByRole("tab", { name: "Parameters" }));
    expect(screen.getByText("Parameters for 2025/26")).toBeTruthy();
    expect(screen.getByText("Draft: not signed off", { selector: "dd" })).toBeTruthy();
    const link = screen.getAllByRole("link", { name: "S16" })[0]!;
    expect(link.getAttribute("href")).toBe(SOURCES.S16.url);
  });
});

describe("year view data", () => {
  it.each(RULE_SETS.map((r) => [r.label, r] as const))("%s: every parameter row names a source that exists", (_l, rules) => {
    const rows = parameterRows(rules);
    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      expect(row.sources.length, `${row.group} / ${row.label}`).toBeGreaterThan(0);
      for (const id of row.sources) expect(SOURCES[id], id).toBeDefined();
    }
  });

  it("2025/26 rows show the 2025/26 figures, not 2026/27's", () => {
    const text = parameterRows(getRuleSet("2025-26")).map((r) => r.value).join(" | ").replace(/ /g, " ");
    expect(text).toContain("237 100");
    expect(text).not.toContain("245 100");
    expect(text).toContain("R4,76");
  });

  it("compare rows pair each year's own results", () => {
    const i = { mode: "GROSS", amount: 30_000, ageBand: "UNDER_65" } as const;
    const a = calculate(TaxRules2025_26, i);
    const b = calculate(TaxRules2026_27, i);
    const rows = compareRows(a, b);
    const final = rows.find((r) => r.label === "Final tax for the year")!;
    expect([final.a, final.b]).toEqual([a.annualLiability, b.annualLiability]);
  });
});

describe("Workbench: test vectors set the year", () => {
  it("loading a 2025/26 vector switches to 2025/26 and shows its expected figures", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Workbench />);
    expect((screen.getByLabelText("Tax year") as HTMLSelectElement).value).toBe("2026-27");
    await user.selectOptions(screen.getByLabelText("Load a PRD test vector"), "Y1");
    expect((screen.getByLabelText("Tax year") as HTMLSelectElement).value).toBe("2025-26");
    expect(screen.getByText(/Expect \(Y1\)/)).toBeTruthy();
    expect(flat(document.body.textContent)).toContain("Your estimated monthly PAYE is R 3 275,08");
    // And back: a 2026/27 vector returns to its own year.
    await user.selectOptions(screen.getByLabelText("Load a PRD test vector"), "T1");
    expect((screen.getByLabelText("Tax year") as HTMLSelectElement).value).toBe("2026-27");
  });

  it("the provenance panel says which rules produced the numbers", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Workbench />);
    await user.selectOptions(screen.getByLabelText("Tax year"), "2025-26");
    const panel = screen.getByRole("heading", { name: "Rules applied" }).closest("div")!;
    const text = flat(panel.textContent);
    expect(text).toContain("2025/26");
    expect(text).toContain("2025-26-draft-1");
    expect(text).toContain("Draft: not signed off");
    expect(text).toContain("1 March 2025 to 28 February 2026");
    expect(within(panel).getByRole("link", { name: "S16" }).getAttribute("href")).toBe(SOURCES.S16.url);
  });
});
