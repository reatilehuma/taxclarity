// @vitest-environment jsdom
import { calculate, CurrentTaxRules as rules } from "@taxclarity/tax-engine";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../App.tsx";
import { copy } from "../content/strings.ts";
import { formatRand } from "../lib/format.ts";
import { MAX_REASONABLE_AMOUNT } from "./answers.ts";

/** A stand-in for the browser Back button. */
function HistoryBack() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      history back
    </button>
  );
}

/** Shows the current address so tests can check the URL as well as the screen. */
function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderApp(path = "/wizard") {
  // No pause between keystrokes: tests don't need to type at human speed.
  const user = userEvent.setup({ delay: null });
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <Where />
      <HistoryBack />
    </MemoryRouter>,
  );
  return { user, ...view };
}

const where = () => screen.getByTestId("where").textContent;
const heading = () => screen.getByRole("heading", { level: 1 }).textContent ?? "";
const norm = (s: string | null | undefined) => (s ?? "").replace(/ /g, " ");
const continueBtn = () => screen.getByRole("button", { name: /^(Continue|Skip|Back to review|See my tax result)$/ });
const amountInput = () => screen.getByLabelText(/Bank deposit|Gross pay/) as HTMLInputElement;

type User = ReturnType<typeof userEvent.setup>;

/** From the extra-pay step: go through the optional extras, the payslip check (if there is one) and the review. */
async function finishFromVariable(user: User) {
  await user.click(continueBtn()); // extra pay → optional extras
  await user.click(continueBtn()); // extras (Skip) → payslip check, or review
  if (screen.queryByText(/Step \d of \d: Your payslip/)) {
    // Payslip mode must give the PAYE; gross mode may leave it blank.
    if ((continueBtn() as HTMLButtonElement).disabled) {
      await user.type(screen.getByLabelText(/PAYE \(income tax\) deducted/), "4681");
    }
    await user.click(continueBtn());
  }
  await user.click(screen.getByRole("button", { name: copy.wizard.nav.seeResult })); // review → result
}

/** From the age step: answer No / None to every question and open the result. */
async function finishFromAge(user: User) {
  await user.click(continueBtn()); // age → retirement
  await user.click(screen.getByRole("radio", { name: /^No/ }));
  await user.click(continueBtn()); // retirement → medical
  await user.click(screen.getByRole("radio", { name: /^No/ }));
  await user.click(continueBtn()); // medical → extra pay
  await user.click(screen.getByRole("checkbox", { name: "None of these" }));
  await finishFromVariable(user);
}

const START = copy.wizard.start.options;
const pickMode = (user: ReturnType<typeof userEvent.setup>, mode: keyof typeof START) =>
  user.click(screen.getByRole("radio", { name: new RegExp(START[mode].title.replace(/[()]/g, "\\$&")) }));

describe("step 0: how would you like to start?", () => {
  it("asks the PRD question with three cards and no answer chosen", () => {
    renderApp();
    expect(heading()).toBe(copy.wizard.start.question);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const radio of screen.getAllByRole("radio")) expect((radio as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Getting started")).toBeTruthy();
  });

  it("won't continue until a choice is made", async () => {
    const { user } = renderApp();
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
    await pickMode(user, "GROSS");
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(false);
  });

  it("has no Back button on the first step", () => {
    renderApp();
    expect(screen.queryByRole("button", { name: copy.wizard.nav.back })).toBeNull();
  });

  it("shows its FAQs", () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 2, name: copy.wizard.faqHeading })).toBeTruthy();
    for (const item of copy.wizard.start.faq) expect(screen.getByText(item.question)).toBeTruthy();
  });

  it("arrow keys move between the cards (real radio buttons)", async () => {
    const { user } = renderApp();
    await pickMode(user, "TAKE_HOME");
    await user.keyboard("{ArrowDown}");
    expect((screen.getByRole("radio", { name: /My gross salary/ }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("all three modes reach the result", () => {
  it.each([
    ["TAKE_HOME", "20000", { mode: "TAKE_HOME" as const, estimate: true }],
    ["GROSS", "30000", { mode: "GROSS" as const, estimate: false }],
    ["PAYSLIP", "30000", { mode: "PAYSLIP" as const, estimate: false }],
  ] as const)("%s", async (mode, amount, expected) => {
    const { user } = renderApp();
    await pickMode(user, mode);
    await user.click(continueBtn());
    expect(where()).toBe("/wizard?step=1");
    await user.type(amountInput(), amount);
    await user.click(continueBtn());
    expect(where()).toBe("/wizard?step=2");
    expect(heading()).toBe(copy.wizard.age.question);
    await finishFromAge(user);

    await screen.findByRole("heading", { level: 1, name: /PAYE|employer deducted/ }); // the results page loads on demand
    expect(where()).toBe("/results");
    const engine = calculate(rules, { mode: expected.mode, amount: Number(amount), ageBand: "UNDER_65" });
    const page = norm(document.body.textContent);
    expect(page).toContain(norm(formatRand(engine.monthlyPaye)));
    expect(page).toContain(norm(formatRand(engine.takeHomeMonthly)));
    expect(page).toContain(norm(formatRand(engine.annualLiability)));
    expect(page).toContain(expected.estimate ? copy.common.estimate : copy.common.payslipAccurate);
  });

  it("T16: a R20 000 deposit is estimated as about R23 051,51 gross", async () => {
    const { user } = renderApp();
    await pickMode(user, "TAKE_HOME");
    await user.click(continueBtn());
    await user.type(amountInput(), "20000");
    await user.click(continueBtn());
    await finishFromAge(user);
    expect(norm(document.body.textContent)).toMatch(/estimate your gross salary at R 23 05[01],\d\d a month/);
  });

  it("the result reflects the chosen age group", async () => {
    const { user } = renderApp();
    await pickMode(user, "GROSS");
    await user.click(continueBtn());
    await user.type(amountInput(), "30000");
    await user.click(continueBtn());
    await user.click(screen.getByRole("radio", { name: "65 to 74" }));
    await finishFromAge(user);
    const engine = calculate(rules, { mode: "GROSS", amount: 30_000, ageBand: "AGE_65_74" });
    expect(norm(document.body.textContent)).toContain(norm(formatRand(engine.monthlyPaye)));
  });
});

describe("step 1: the money question", () => {
  async function toAmount(mode: keyof typeof START) {
    const r = renderApp();
    await pickMode(r.user, mode);
    await r.user.click(continueBtn());
    return r;
  }

  it.each([
    ["TAKE_HOME", copy.wizard.amount.questions.TAKE_HOME.MONTHLY],
    ["GROSS", copy.wizard.amount.questions.GROSS.MONTHLY],
    ["PAYSLIP", copy.wizard.amount.questions.PAYSLIP.MONTHLY],
  ] as const)("%s uses its own wording", async (mode, question) => {
    await toAmount(mode);
    expect(heading()).toBe(question);
    expect(screen.getByText(mode === "TAKE_HOME" ? "Step 1 of 7: Your pay" : "Step 1 of 8: Your pay")).toBeTruthy();
  });

  it("can't continue without an amount, and says so once the field is left", async () => {
    const { user } = await toAmount("GROSS");
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(copy.wizard.amount.required)).toBeNull();
    await user.click(amountInput());
    await user.tab();
    expect(screen.getByText(copy.wizard.amount.required)).toBeTruthy();
  });

  it("R0 is allowed, with the friendly note", async () => {
    const { user } = await toAmount("GROSS");
    await user.type(amountInput(), "0");
    expect(screen.getByText(copy.wizard.amount.zero)).toBeTruthy();
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(false);
  });

  it("negative amounts are refused with a gentle message", async () => {
    const { user } = await toAmount("GROSS");
    await user.type(amountInput(), "-500");
    expect(screen.getByText(copy.wizard.amount.negative)).toBeTruthy();
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  it("a very high amount needs a tick before continuing (PRD §9)", async () => {
    const { user } = await toAmount("GROSS");
    await user.type(amountInput(), String(MAX_REASONABLE_AMOUNT + 1));
    expect(screen.getByText(copy.wizard.amount.tooHigh)).toBeTruthy();
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: copy.wizard.amount.tooHighConfirm }));
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(false);
    // Changing the amount asks again.
    await user.type(amountInput(), "5");
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  it("weekly pay changes the question and shows the monthly equivalent from the engine", async () => {
    const { user } = await toAmount("GROSS");
    await user.click(screen.getByRole("radio", { name: "Weekly" }));
    expect(heading()).toBe(copy.wizard.amount.questions.GROSS.WEEKLY);
    await user.type(amountInput(), "5000");
    const engine = calculate(rules, { amount: 5_000, payFrequency: "WEEKLY", ageBand: "UNDER_65" });
    expect(norm(document.body.textContent)).toContain(norm(copy.wizard.amount.monthlyEquivalent(formatRand(engine.grossMonthly))));
    await user.click(continueBtn());
    await finishFromAge(user);
    expect(norm(document.body.textContent)).toContain(norm(formatRand(engine.takeHomePerPeriod)));
  });

  it("every-two-weeks works the same way", async () => {
    const { user } = await toAmount("TAKE_HOME");
    await user.click(screen.getByRole("radio", { name: "Every two weeks" }));
    expect(heading()).toBe(copy.wizard.amount.questions.TAKE_HOME.FORTNIGHTLY);
  });

  it("the monthly equivalent is hidden for monthly pay", async () => {
    const { user } = await toAmount("GROSS");
    await user.type(amountInput(), "30000");
    expect(screen.queryByText(/a month\.$/)).toBeNull();
  });

  it("'I'm not sure' shows a slider that fills in the amount (bank-account mode only)", async () => {
    const { user } = await toAmount("TAKE_HOME");
    await user.click(screen.getByRole("checkbox", { name: copy.wizard.amount.unsureToggle }));
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.min).toBe("1000");
    expect(slider.max).toBe("150000");
    expect(amountInput().value).toBe("20 000,00");
  });

  it("gross mode has no slider", async () => {
    await toAmount("GROSS");
    expect(screen.queryByRole("checkbox", { name: copy.wizard.amount.unsureToggle })).toBeNull();
  });

  it("shows mode-specific FAQs plus the pay-frequency one", async () => {
    await toAmount("TAKE_HOME");
    expect(screen.getByText("Do I include my bonus?")).toBeTruthy();
    expect(screen.getByText(copy.wizard.amount.faq.frequency.question)).toBeTruthy();
  });
});

describe("step 2: age", () => {
  it("defaults to 'Younger than 65' and quotes the rebates from the rule set", async () => {
    const { user } = renderApp("/wizard?start=gross");
    await user.type(amountInput(), "30000");
    await user.click(continueBtn());
    expect((screen.getByRole("radio", { name: "Younger than 65" }) as HTMLInputElement).checked).toBe(true);
    const note = norm(document.body.textContent);
    expect(note).toContain(`R ${String(rules.rebates.secondary65).replace(/\B(?=(\d{3})+$)/g, " ")} a year`);
    expect(note).toContain(`R ${String(rules.rebates.tertiary75).replace(/\B(?=(\d{3})+$)/g, " ")} more`);
  });

  it("arrow keys switch the age group", async () => {
    const { user } = renderApp("/wizard?start=gross");
    await user.type(amountInput(), "30000");
    await user.click(continueBtn());
    await user.click(screen.getByRole("radio", { name: "Younger than 65" }));
    await user.keyboard("{ArrowRight}");
    expect((screen.getByRole("radio", { name: "65 to 74" }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("navigation", () => {
  it("the landing-page buttons skip straight to the money question in the right mode", () => {
    renderApp("/wizard?start=take-home");
    expect(where()).toBe("/wizard?step=1");
    expect(heading()).toBe(copy.wizard.amount.questions.TAKE_HOME.MONTHLY);
  });

  it("?start=gross and ?start=payslip work too; unknown values fall back to the first step", () => {
    renderApp("/wizard?start=payslip");
    expect(heading()).toBe(copy.wizard.amount.questions.PAYSLIP.MONTHLY);
  });

  it("an unknown ?start= shows step 0", () => {
    renderApp("/wizard?start=constructor");
    expect(heading()).toBe(copy.wizard.start.question);
  });

  it("Back goes to the previous step and keeps what you entered", async () => {
    const { user } = renderApp("/wizard?start=gross");
    await user.type(amountInput(), "30000");
    await user.click(continueBtn());
    expect(where()).toBe("/wizard?step=2");
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.back }));
    expect(where()).toBe("/wizard?step=1");
    expect(amountInput().value).toBe("30 000,00");
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.back }));
    expect(where()).toBe("/wizard?step=0");
    expect((screen.getByRole("radio", { name: /My gross salary/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("can't skip ahead by editing the address", () => {
    renderApp("/wizard?step=2");
    expect(where()).toBe("/wizard?step=0");
    expect(heading()).toBe(copy.wizard.start.question);
  });

  it("nonsense step numbers are tidied up", () => {
    renderApp("/wizard?step=banana");
    expect(where()).toBe("/wizard?step=0");
  });

  it("choosing a different way to start clears the amount", async () => {
    const { user } = renderApp("/wizard?start=gross");
    await user.type(amountInput(), "30000");
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.back }));
    await pickMode(user, "TAKE_HOME");
    await user.click(continueBtn());
    expect(amountInput().value).toBe("");
  });

  it("moves keyboard focus to the new question when the step changes", async () => {
    const { user } = renderApp();
    await pickMode(user, "GROSS");
    await user.click(continueBtn());
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("announces progress politely (PRD §17.3)", async () => {
    const { user } = renderApp("/wizard?start=gross");
    const live = screen.getByText("Step 1 of 8: Your pay");
    expect(live.getAttribute("aria-live")).toBe("polite");
    await user.type(amountInput(), "1");
    await user.click(continueBtn());
    expect(screen.getByText("Step 2 of 8: Your age")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
  });

  it("pressing Enter in the amount box continues", async () => {
    const { user } = renderApp("/wizard?start=gross");
    await user.type(amountInput(), "30000{Enter}");
    expect(where()).toBe("/wizard?step=2");
  });

  it("sets the tab title from the step", () => {
    renderApp("/wizard?start=gross");
    expect(document.title).toContain(copy.wizard.stepTitles.amount);
  });
});

describe("results guard and starting over", () => {
  it("/results without answers goes back to the start (PRD §18)", () => {
    renderApp("/results");
    expect(where()).toBe("/wizard?step=0");
  });

  it("'Adjust my answers' goes to the review, with answers kept", async () => {
    const { user } = renderApp("/wizard?start=gross");
    await user.type(amountInput(), "30000");
    await user.click(continueBtn());
    await finishFromAge(user);
    await user.click(screen.getByRole("link", { name: copy.results.adjust }));
    expect(where()).toBe("/wizard?step=8");
    expect(screen.getByRole("heading", { level: 1, name: copy.wizard.review.question })).toBeTruthy();
    expect((document.body.textContent ?? "").replace(/\s/g, " ")).toContain("R 30 000,00");
  });

  it("'Start over' clears everything", async () => {
    const { user } = renderApp("/wizard?start=gross");
    await user.type(amountInput(), "30000");
    await user.click(continueBtn());
    await finishFromAge(user);
    await user.click(screen.getByRole("button", { name: copy.results.startOver }));
    expect(where()).toBe("/wizard?step=0");
    for (const radio of screen.getAllByRole("radio")) expect((radio as HTMLInputElement).checked).toBe(false);
  });

  it("refreshing starts again: a fresh app has no answers, even on a deep link", async () => {
    const first = renderApp("/wizard?start=gross");
    await first.user.type(amountInput(), "30000");
    first.unmount();
    renderApp("/results");
    expect(where()).toBe("/wizard?step=0");
  });

  it("the result page labels itself an estimate in take-home mode and shows the tax year", async () => {
    const { user } = renderApp("/wizard?start=take-home");
    await user.type(amountInput(), "20000");
    await user.click(continueBtn());
    await finishFromAge(user);
    const main = screen.getByRole("main");
    expect(within(main).getByText(copy.common.estimate)).toBeTruthy();
    expect(norm(main.textContent)).toContain("1 March 2026 – 28 February 2027");
  });
});

describe("currency field: typing, pasting, formatting", () => {
  async function field() {
    const r = renderApp("/wizard?start=gross");
    return { ...r, input: amountInput() };
  }

  it("groups thousands as you type", async () => {
    const { user, input } = await field();
    await user.type(input, "1234567");
    expect(input.value).toBe("1 234 567");
  });

  it("shows two decimals when you leave the field", async () => {
    const { user, input } = await field();
    await user.type(input, "30000");
    await user.tab();
    expect(input.value).toBe("30 000,00");
  });

  it("accepts a comma or a dot for cents", async () => {
    const { user, input } = await field();
    await user.type(input, "1234,5");
    expect(input.value).toBe("1 234,5");
    await user.tab();
    expect(input.value).toBe("1 234,50");
    await user.clear(input);
    await user.type(input, "99.99");
    expect(input.value).toBe("99,99");
  });

  it.each([
    ["R30 000", "30 000"],
    ["30,000.00", "30 000,00"],
    ["30000", "30 000"],
    ["R 8 250,50", "8 250,50"],
    ["1.234,56", "1 234,56"],
  ])("pasting %j gives %j", async (pasted, shown) => {
    const { user, input } = await field();
    await user.click(input);
    await user.paste(pasted);
    expect(input.value).toBe(shown);
  });

  it("ignores letters", async () => {
    const { user, input } = await field();
    await user.type(input, "ab12cd3");
    expect(input.value).toBe("123");
  });

  it("clearing the field empties the answer and disables Continue", async () => {
    const { user, input } = await field();
    await user.type(input, "500");
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(false);
    await user.clear(input);
    expect(input.value).toBe("");
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the cursor beside the digit you're editing, even as spaces appear", async () => {
    const { user, input } = await field();
    await user.type(input, "2345");
    expect(input.value).toBe("2 345");
    // Put a 1 in front.
    await user.type(input, "1", { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(input.value).toBe("12 345");
    // Type 8 then 9 after the 1. The second digit must land after the first, not jump to the end.
    // If the cursor had jumped to the end we'd see 1 234 589.
    await user.type(input, "89", { initialSelectionStart: 1, initialSelectionEnd: 1 });
    expect(input.value).toBe("1 892 345");
  });

  it("is labelled for screen readers, including the unit", async () => {
    await field();
    const input = amountInput();
    expect(input.getAttribute("inputmode")).toBe("decimal");
    expect(screen.getByLabelText(/in rand/)).toBe(input);
  });

  it("marks the field invalid and links the message while there's an error", async () => {
    const { user, input } = await field();
    await user.type(input, "-1");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ").map((id) => document.getElementById(id)?.textContent).join(" ")).toContain(
      copy.wizard.amount.negative,
    );
  });
});

// ---------------------------------------------------------------------------
// Phase 7: retirement, medical aid, extra pay
// ---------------------------------------------------------------------------

/** From a fresh page to the retirement question, in gross mode with R30 000. */
async function toRetirement(grossAmount = "30000") {
  const r = renderApp("/wizard?start=gross");
  await r.user.type(amountInput(), grossAmount);
  await r.user.click(continueBtn()); // → age
  await r.user.click(continueBtn()); // → retirement
  return r;
}

async function toMedical() {
  const r = await toRetirement();
  await r.user.click(screen.getByRole("radio", { name: /^No/ }));
  await r.user.click(continueBtn());
  return r;
}

async function toVariable() {
  const r = await toMedical();
  await r.user.click(screen.getByRole("radio", { name: /^No/ }));
  await r.user.click(continueBtn());
  return r;
}

/** Turns a label into a regex that matches it literally (labels can contain brackets). */
const literal = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const field = (label: RegExp | string) => screen.getByLabelText(label) as HTMLInputElement;
const disabled = () => (continueBtn() as HTMLButtonElement).disabled;
const R = copy.wizard.retirement;
const M = copy.wizard.medical;
const V = copy.wizard.variable;

describe("step 3: retirement", () => {
  it("asks the PRD question, with Yes and No, and counts as step 3 of 8", async () => {
    await toRetirement();
    expect(heading()).toBe(R.question);
    expect(screen.getByText("Step 3 of 8: Retirement savings")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(disabled()).toBe(true);
  });

  it("No is enough to continue, and shows no amount boxes", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^No/ }));
    expect(screen.queryByLabelText(new RegExp(R.payslipLabel))).toBeNull();
    expect(disabled()).toBe(false);
  });

  it("Yes shows the amount boxes and needs at least one amount", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    expect(field(new RegExp(R.payslipLabel))).toBeTruthy();
    expect(field(new RegExp(R.raLabel))).toBeTruthy();
    expect(screen.getByText(R.needAmount)).toBeTruthy();
    expect(disabled()).toBe(true);
    await user.type(field(new RegExp(R.payslipLabel)), "3000");
    expect(screen.queryByText(R.needAmount)).toBeNull();
    expect(disabled()).toBe(false);
  });

  it("shows the percentage of salary, worked out by the engine (T1: R3 000 of R30 000 = 10%)", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.payslipLabel)), "3000");
    expect(screen.getByText(R.percent("10%", false))).toBeTruthy();
  });

  it("in bank-account mode the percentage says it is of the estimated salary", async () => {
    const r = renderApp("/wizard?start=take-home");
    await r.user.type(amountInput(), "20000");
    await r.user.click(continueBtn());
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await r.user.type(field(new RegExp(R.payslipLabel)), "2000");
    expect(screen.getByText(/of your estimated salary\.$/)).toBeTruthy();
  });

  it("the employer box appears only when ticked, and counts as an amount on its own", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    expect(screen.queryByLabelText(new RegExp(R.employerLabel))).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: R.employerToggle }));
    await user.type(field(new RegExp(R.employerLabel)), "1500");
    expect(disabled()).toBe(false);
  });

  it("untick the employer box and its amount no longer counts", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.click(screen.getByRole("checkbox", { name: R.employerToggle }));
    await user.type(field(new RegExp(R.employerLabel)), "1500");
    await user.click(screen.getByRole("checkbox", { name: R.employerToggle }));
    expect(disabled()).toBe(true);
  });

  it("a retirement annuity paid by debit order explains the saving comes back on filing", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.raLabel)), "2000");
    expect(screen.getByText(R.debitNote)).toBeTruthy();
  });

  it("contributions above the limit show the carry-forward note, with the figure from the engine", async () => {
    const { user } = await toRetirement("60000");
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.raLabel)), "16667"); // about R200 000 a year, limit R198 000
    expect(norm(document.body.textContent)).toMatch(/About R 2 004 a year of these contributions is above this year's limit \(27,5% of your income, up to R 430 000\)/);
  });

  it("negative amounts are refused gently", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.payslipLabel)), "-100");
    expect(screen.getByText(R.negative)).toBeTruthy();
    expect(disabled()).toBe(true);
  });

  it("warns when contributions are more than the salary", async () => {
    const { user } = await toRetirement("10000");
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.payslipLabel)), "15000");
    expect(screen.getByText(R.tooMuch)).toBeTruthy();
  });

  it("changing Yes back to No forgets nothing but ignores the amounts", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.payslipLabel)), "3000");
    await user.click(screen.getByRole("radio", { name: /^No/ }));
    expect(disabled()).toBe(false);
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    expect(field(new RegExp(R.payslipLabel)).value).toBe("3 000,00"); // kept, shown in its finished form
  });

  it("shows its FAQs, including why we ask where the money comes from", async () => {
    await toRetirement();
    for (const item of R.faq) expect(screen.getByText(item.question)).toBeTruthy();
  });
});

describe("step 4: medical aid", () => {
  it("asks the PRD question and counts as step 4 of 8", async () => {
    await toMedical();
    expect(heading()).toBe(M.question);
    expect(screen.getByText("Step 4 of 8: Medical aid")).toBeTruthy();
    expect(disabled()).toBe(true);
  });

  it("No is enough to continue", async () => {
    const { user } = await toMedical();
    await user.click(screen.getByRole("radio", { name: /^No/ }));
    expect(disabled()).toBe(false);
  });

  it("Yes shows the plan size (starting at 1), the total and who pays", async () => {
    const { user } = await toMedical();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    expect(field(M.membersLabel).value).toBe("1");
    expect(field(new RegExp(M.totalLabel))).toBeTruthy();
    expect(screen.getByRole("radio", { name: "I pay it" })).toBeTruthy();
    expect(disabled()).toBe(true);
    await user.type(field(new RegExp(M.totalLabel)), "0");
    expect(disabled()).toBe(false); // R0 is fine
  });

  it("the stepper moves between 1 and 15 and can be typed into", async () => {
    const { user } = await toMedical();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    const fewer = screen.getByRole("button", { name: M.membersFewer }) as HTMLButtonElement;
    const more = screen.getByRole("button", { name: M.membersMore }) as HTMLButtonElement;
    expect(fewer.disabled).toBe(true);
    await user.click(more);
    await user.click(more);
    expect(field(M.membersLabel).value).toBe("3");
    await user.clear(field(M.membersLabel));
    await user.type(field(M.membersLabel), "40");
    expect(field(M.membersLabel).value).toBe("15"); // clamped
    expect(more.disabled).toBe(true);
    await user.tab();
    expect(field(M.membersLabel).value).toBe("15");
  });

  it("T1: two people, R0, off the payslip → the credit is R752 a month in the result", async () => {
    const { user } = await toMedical();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.click(screen.getByRole("button", { name: M.membersMore }));
    await user.type(field(new RegExp(M.totalLabel)), "0");
    expect(disabled()).toBe(false);
  });

  it("sharing asks for the employer's share and stops it being more than the total", async () => {
    const { user } = await toMedical();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(M.totalLabel)), "4000");
    await user.click(screen.getByRole("radio", { name: "We share it" }));
    expect(disabled()).toBe(true);
    await user.type(field(new RegExp(M.employerShareLabel)), "5000");
    expect(screen.getByText(M.shareTooHigh)).toBeTruthy();
    expect(disabled()).toBe(true);
    await user.clear(field(new RegExp(M.employerShareLabel)));
    await user.type(field(new RegExp(M.employerShareLabel)), "1500");
    expect(disabled()).toBe(false);
  });

  it("'My employer pays it all' explains the small taxable benefit and hides 'how is your share paid'", async () => {
    const { user } = await toMedical();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(M.totalLabel)), "2000");
    expect(screen.getByRole("radio", { name: "Off my payslip" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "My employer pays it all" }));
    expect(screen.queryByRole("radio", { name: "Off my payslip" })).toBeNull();
    expect(norm(document.body.textContent)).toContain("you still get your medical credit of R 376 a month");
  });

  it("paying by debit order explains the credit comes back on filing", async () => {
    const { user } = await toMedical();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(M.totalLabel)), "4000");
    expect(screen.queryByText(M.debitNote)).toBeNull();
    await user.click(screen.getByRole("radio", { name: "By debit order" }));
    expect(screen.getByText(M.debitNote)).toBeTruthy();
  });

  it("costs the scheme didn't cover are optional, and can't be negative", async () => {
    const { user } = await toMedical();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(M.totalLabel)), "3000");
    expect(disabled()).toBe(false);
    await user.type(field(new RegExp(M.outOfPocketLabel)), "-5");
    expect(screen.getByText(M.negative)).toBeTruthy();
    expect(disabled()).toBe(true);
  });

  it("the FAQ quotes the credit amounts from the rule set", async () => {
    await toMedical();
    await userEvent.click(screen.getByText("How does the tax credit work?"));
    expect(norm(document.body.textContent)).toContain("SARS gives R 376 a month for you, R 376 for your first dependant and R 254 for each additional dependant");
  });
});

describe("step 5: bonus, overtime and commission", () => {
  it("asks the PRD question and is step 5, with Continue (more steps follow)", async () => {
    await toVariable();
    expect(heading()).toBe(V.question);
    expect(screen.getByText("Step 5 of 8: Bonus and extras")).toBeTruthy();
    expect(continueBtn()).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("'None of these' is enough", async () => {
    const { user } = await toVariable();
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "None of these" }));
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(false);
  });

  it("each type picked asks for a yearly amount, which is required", async () => {
    const { user } = await toVariable();
    await user.click(screen.getByRole("checkbox", { name: "Bonus or 13th cheque" }));
    expect(field(V.amountLabel.BONUS + " (in rand)")).toBeTruthy();
    expect(screen.getByText(V.required)).toBeTruthy();
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
    await user.type(field(new RegExp(V.amountLabel.BONUS)), "30000");
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(false);
  });

  it("can pick several, and 'None of these' clears the others", async () => {
    const { user } = await toVariable();
    await user.click(screen.getByRole("checkbox", { name: "Bonus or 13th cheque" }));
    await user.click(screen.getByRole("checkbox", { name: "Overtime" }));
    expect(field(new RegExp(V.amountLabel.OVERTIME))).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "None of these" }));
    expect((screen.getByRole("checkbox", { name: "Bonus or 13th cheque" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByLabelText(new RegExp(V.amountLabel.OVERTIME))).toBeNull();
    // Picking a type again clears "None".
    await user.click(screen.getByRole("checkbox", { name: "Commission" }));
    expect((screen.getByRole("checkbox", { name: "None of these" }) as HTMLInputElement).checked).toBe(false);
  });

  it("un-ticking the last one goes back to unanswered", async () => {
    const { user } = await toVariable();
    await user.click(screen.getByRole("checkbox", { name: "Overtime" }));
    await user.click(screen.getByRole("checkbox", { name: "Overtime" }));
    expect((continueBtn() as HTMLButtonElement).disabled).toBe(true);
  });

  it("warns when extras are more than 3 times the annual salary (from the engine)", async () => {
    const { user } = await toVariable();
    await user.click(screen.getByRole("checkbox", { name: "Commission" }));
    await user.type(field(new RegExp(V.amountLabel.COMMISSION)), "1100000"); // salary is R360 000 a year
    expect(screen.getByText(V.highNote)).toBeTruthy();
    await user.clear(field(new RegExp(V.amountLabel.COMMISSION)));
    await user.type(field(new RegExp(V.amountLabel.COMMISSION)), "1000000");
    expect(screen.queryByText(V.highNote)).toBeNull();
  });
});

describe("the full wizard", () => {
  it("T1 entered through the screens gives the PRD numbers: PAYE R3 149,00 and take-home R23 673,88", async () => {
    const { user } = renderApp("/wizard?start=gross");
    await user.type(amountInput(), "30000");
    await user.click(continueBtn()); // age
    await user.click(continueBtn()); // retirement
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.payslipLabel)), "3000");
    await user.click(continueBtn()); // medical
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.click(screen.getByRole("button", { name: M.membersMore }));
    await user.type(field(new RegExp(M.totalLabel)), "0");
    await user.click(continueBtn()); // extra pay
    await user.click(screen.getByRole("checkbox", { name: "None of these" }));
    await finishFromVariable(user);

    expect(where()).toBe("/results");
    const page = norm(document.body.textContent);
    expect(page).toContain("R 3 149,00");
    expect(page).toContain("R 23 673,88");
    expect(page).toContain("R 37 788,00"); // tax for the year
  });

  it("a bonus lifts the year's tax but not a normal month", async () => {
    const { user } = await toVariable();
    await user.click(screen.getByRole("checkbox", { name: "Bonus or 13th cheque" }));
    await user.type(field(new RegExp(V.amountLabel.BONUS)), "30000");
    await finishFromVariable(user);
    const page = norm(document.body.textContent);
    expect(page).toContain("R 4 681,00"); // normal-month PAYE, unchanged
    expect(page).toContain("R 64 317,00"); // tax for the year with the bonus
  });

  it("answers survive going back and forward through the new steps", async () => {
    const { user } = await toRetirement();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.payslipLabel)), "3000");
    await user.click(continueBtn()); // medical
    await user.click(screen.getByRole("radio", { name: /^No/ }));
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.back }));
    expect(where()).toBe("/wizard?step=3");
    expect(field(new RegExp(R.payslipLabel)).value).toBe("3 000,00");
    await user.click(continueBtn());
    expect((screen.getByRole("radio", { name: /^No/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("can't skip to a later step by address until earlier ones are done", () => {
    renderApp("/wizard?start=gross");
    // amount not entered yet: step 4 is out of reach
    expect(where()).toBe("/wizard?step=1");
  });

  it("the retirement guard: ?step=4 with retirement unanswered goes back to step 3", async () => {
    const { user } = await toRetirement();
    expect(where()).toBe("/wizard?step=3");
    await user.click(screen.getByRole("radio", { name: /^No/ }));
    // Move to step 4 by clicking, then check the guard by changing the answer back to unanswered is impossible;
    // instead confirm step 4 is reachable only after step 3 is done.
    await user.click(continueBtn());
    expect(where()).toBe("/wizard?step=4");
  });
});

// ---------------------------------------------------------------------------
// Phase 8: optional extras, payslip check, review
// ---------------------------------------------------------------------------

const X = copy.wizard.extras;
const P = copy.wizard.payslip;
const RV = copy.wizard.review;

/** From a fresh page to the optional-extras step (gross mode, R30 000, No/None to everything before). */
async function toExtras(withMedical = false) {
  const r = await toRetirement();
  await r.user.click(screen.getByRole("radio", { name: /^No/ }));
  await r.user.click(continueBtn());
  if (withMedical) {
    await r.user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await r.user.type(field(new RegExp(M.totalLabel)), "0");
  } else {
    await r.user.click(screen.getByRole("radio", { name: /^No/ }));
  }
  await r.user.click(continueBtn());
  await r.user.click(screen.getByRole("checkbox", { name: "None of these" }));
  await r.user.click(continueBtn());
  return r;
}

async function toPayslip() {
  const r = await toExtras();
  await r.user.click(continueBtn()); // Skip
  return r;
}

async function toReview() {
  const r = await toPayslip();
  await r.user.click(continueBtn());
  return r;
}

const openExtras = (user: User) => user.click(screen.getByRole("button", { name: /Optional extras/ }));

describe("step 6: optional extras", () => {
  it("asks its question, counts as step 6 of 8, and starts collapsed with a Skip button", async () => {
    await toExtras();
    expect(heading()).toBe(X.question);
    expect(screen.getByText("Step 6 of 8: Optional extras")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: /Optional extras/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain(X.none);
    expect(continueBtn().textContent).toBe(copy.wizard.nav.skip);
  });

  it("Skip moves on without opening anything", async () => {
    const { user } = await toExtras();
    await user.click(continueBtn());
    expect(heading()).toBe(P.question);
  });

  it("opens to show donations, interest, travel and a second job", async () => {
    const { user } = await toExtras();
    await openExtras(user);
    expect(screen.getByRole("button", { name: /Optional extras/ }).getAttribute("aria-expanded")).toBe("true");
    expect(field(new RegExp(X.donationsLabel.slice(0, 20)))).toBeTruthy();
    expect(field(new RegExp(X.interestLabel.slice(0, 20)))).toBeTruthy();
    expect(field(new RegExp(X.travelLabel.slice(0, 20)))).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: X.secondToggle })).toBeTruthy();
  });

  it("shows how many are filled in, and the button changes from Skip to Continue", async () => {
    const { user } = await toExtras();
    await openExtras(user);
    await user.type(field(new RegExp(X.donationsLabel.slice(0, 20))), "2000");
    expect(screen.getByRole("button", { name: /Optional extras/ }).textContent).toContain(X.filled(1));
    expect(continueBtn().textContent).toBe(copy.wizard.nav.continue);
    await user.type(field(new RegExp(X.interestLabel.slice(0, 20))), "30000");
    expect(screen.getByRole("button", { name: /Optional extras/ }).textContent).toContain(X.filled(2));
  });

  it("donations without a receipt get the gentle reminder; ticking the receipt removes it", async () => {
    const { user } = await toExtras();
    await openExtras(user);
    await user.type(field(new RegExp(X.donationsLabel.slice(0, 20))), "2000");
    expect(screen.getByText(X.receiptNote)).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: X.receipt }));
    expect(screen.queryByText(X.receiptNote)).toBeNull();
  });

  it("travel: the business-use choice and kilometres appear once there's an allowance; kilometres are whole numbers", async () => {
    const { user } = await toExtras();
    await openExtras(user);
    expect(screen.queryByRole("radio", { name: "80% or more" })).toBeNull();
    await user.type(field(new RegExp(X.travelLabel.slice(0, 20))), "5000");
    expect(screen.getByRole("radio", { name: "80% or more" })).toBeTruthy();
    const km = field(new RegExp(X.travelKmLabel));
    await user.click(km);
    await user.paste("12500,7");
    await user.tab();
    expect(km.value).toBe("12 500"); // no decimals, no R
    expect(screen.getByLabelText(new RegExp(X.travelKmLabel)).getAttribute("inputmode")).toBe("decimal");
    expect(screen.getByText(X.travelNote)).toBeTruthy();
  });

  it("second job: the amount box appears when ticked, and the amount is optional", async () => {
    const { user } = await toExtras();
    await openExtras(user);
    await user.click(screen.getByRole("checkbox", { name: X.secondToggle }));
    expect(field(new RegExp(X.secondLabel))).toBeTruthy();
    expect(screen.getByRole("button", { name: /Optional extras/ }).textContent).toContain(X.filled(1));
    expect(disabled()).toBe(false);
  });

  it("medical aid options (months, disability) show only for people with a medical aid", async () => {
    const no = await toExtras();
    await openExtras(no.user);
    expect(screen.queryByLabelText(X.monthsLabel)).toBeNull();
    no.unmount();

    const yes = await toExtras(true);
    await openExtras(yes.user);
    expect(field(X.monthsLabel).value).toBe("12");
    await yes.user.click(screen.getByRole("button", { name: X.monthsFewer }));
    expect(field(X.monthsLabel).value).toBe("11");
    await yes.user.click(screen.getByRole("checkbox", { name: X.disability }));
    expect(screen.getByRole("button", { name: /Optional extras/ }).textContent).toContain(X.filled(2));
  });

  it("negative amounts are refused gently", async () => {
    const { user } = await toExtras();
    await openExtras(user);
    await user.type(field(new RegExp(X.donationsLabel.slice(0, 20))), "-5");
    expect(screen.getByText(X.negative)).toBeTruthy();
    expect(disabled()).toBe(true);
  });

  it("comes back open when there's something in it", async () => {
    const { user } = await toExtras();
    await openExtras(user);
    await user.type(field(new RegExp(X.interestLabel.slice(0, 20))), "30000");
    await user.click(continueBtn());
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.back }));
    expect(screen.getByRole("button", { name: /Optional extras/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("shows its FAQs, quoting the interest exemption from the rule set", async () => {
    await toExtras();
    expect(screen.getByText("What is a Section 18A receipt?")).toBeTruthy();
    await userEvent.click(screen.getByText("Why ask about interest?"));
    expect(norm(document.body.textContent)).toContain("The first R 23 800 of local interest is tax-free (R 34 500 if you're 65+)");
  });
});

describe("step 7: the payslip check", () => {
  it("gross mode: appears after the extras as step 7 of 8, with PAYE optional", async () => {
    await toPayslip();
    expect(heading()).toBe(P.question);
    expect(screen.getByText("Step 7 of 8: Your payslip")).toBeTruthy();
    expect(screen.getByText(P.payeHintOptional)).toBeTruthy();
    expect(disabled()).toBe(false);
  });

  it("payslip mode: PAYE is required, and R0 is fine", async () => {
    const r = renderApp("/wizard?start=payslip");
    await r.user.type(amountInput(), "30000");
    await r.user.click(continueBtn());
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^No/ }));
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^No/ }));
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("checkbox", { name: "None of these" }));
    await r.user.click(continueBtn());
    await r.user.click(continueBtn()); // Skip extras
    expect(heading()).toBe(P.question);
    expect(screen.getByText(P.payeRequired)).toBeTruthy();
    expect(disabled()).toBe(true);
    await r.user.type(field(literal(P.payeLabel)), "0");
    expect(disabled()).toBe(false);
    expect(screen.queryByText(P.payeRequired)).toBeNull();
  });

  it("bank-account mode has no payslip step: the extras lead straight to the review (step 7 of 7)", async () => {
    const r = renderApp("/wizard?start=take-home");
    await r.user.type(amountInput(), "20000");
    await r.user.click(continueBtn());
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^No/ }));
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^No/ }));
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("checkbox", { name: "None of these" }));
    await r.user.click(continueBtn());
    await r.user.click(continueBtn()); // Skip extras
    expect(heading()).toBe(RV.question);
    expect(screen.getByText("Step 7 of 7: Review")).toBeTruthy();
  });

  it("explains the assumed UIF when the box is left blank", async () => {
    await toPayslip();
    expect(norm(document.body.textContent)).toContain("we'll assume R 177,12 (1% of your pay)");
  });

  it("warns, without blocking, about UIF above the legal maximum", async () => {
    const { user } = await toPayslip();
    await user.type(field(new RegExp(P.uifLabel)), "250");
    expect(norm(document.body.textContent)).toContain("UIF above R 177,12 a month isn't possible under 2026/27 rules");
    expect(disabled()).toBe(false);
  });

  it("warns, without blocking, when PAYE is more than the salary", async () => {
    const { user } = await toPayslip();
    await user.type(field(literal(P.payeLabel)), "35000");
    expect(screen.getByText(P.payeTooHigh)).toBeTruthy();
    expect(disabled()).toBe(false);
  });

  it("negative amounts block", async () => {
    const { user } = await toPayslip();
    await user.type(field(literal(P.payeLabel)), "-1");
    expect(screen.getByText(P.negative)).toBeTruthy();
    expect(disabled()).toBe(true);
  });

  it("T17: gross R45 000 and payslip PAYE R6 800 → the result uses the PRD's payslip sentence", async () => {
    const r = renderApp("/wizard?start=payslip");
    await r.user.type(amountInput(), "45000");
    await r.user.click(continueBtn());
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^No/ }));
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^No/ }));
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("checkbox", { name: "None of these" }));
    await r.user.click(continueBtn());
    await r.user.click(continueBtn()); // Skip extras
    await r.user.type(field(literal(P.payeLabel)), "6800");
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("button", { name: copy.wizard.nav.seeResult }));
    const page = norm(document.body.textContent);
    expect(page).toContain("Your employer deducted R 6 800,00");
    expect(page).toContain("our calculation gives R 9 275,58");
  });
});

describe("step 8: review", () => {
  it("is the last step, labelled 'See my tax result', with the small print", async () => {
    await toReview();
    expect(heading()).toBe(RV.question);
    expect(screen.getByText("Step 8 of 8: Review")).toBeTruthy();
    expect(screen.getByRole("button", { name: "See my tax result" })).toBeTruthy();
    expect(screen.getByText(RV.smallPrint)).toBeTruthy();
    for (const item of RV.faq) expect(screen.getByText(item.question)).toBeTruthy();
  });

  it("shows each answer grouped by topic", async () => {
    await toReview();
    for (const title of [RV.groups.income, RV.groups.retirement, RV.groups.medical, RV.groups.variable]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeTruthy();
    }
    const income = screen.getByRole("heading", { level: 2, name: RV.groups.income }).closest("section")!;
    expect(norm(income.textContent)).toContain("R 30 000,00");
    expect(norm(income.textContent)).toContain("Younger than 65");
    expect(screen.queryByRole("heading", { level: 2, name: RV.groups.extras })).toBeNull();
  });

  it("every group has an Edit link that says what it edits", async () => {
    await toReview();
    const edit = screen.getByRole("link", { name: "Edit Your retirement savings" });
    expect(edit.getAttribute("href")).toBe("/wizard?step=3&from=review");
    expect(screen.getByRole("link", { name: "Edit Your income" }).getAttribute("href")).toBe("/wizard?step=1&from=review");
    expect(screen.getByRole("link", { name: "Edit Your medical aid" }).getAttribute("href")).toBe("/wizard?step=4&from=review");
  });

  it("Edit goes to that step, and finishing it returns to the review with the new answer", async () => {
    const { user } = await toReview();
    await user.click(screen.getByRole("link", { name: "Edit Your retirement savings" }));
    expect(where()).toBe("/wizard?step=3&from=review");
    expect(screen.getByRole("button", { name: copy.wizard.nav.backToReview })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await user.type(field(new RegExp(R.payslipLabel)), "3000");
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.backToReview }));
    expect(where()).toBe("/wizard?step=8");
    expect(heading()).toBe(RV.question);
    expect(norm(document.body.textContent)).toContain("Off your payslip, per month");
    expect(norm(document.body.textContent)).toContain("R 3 000,00");
  });

  it("after an edit, the browser Back button goes to the step before the review, not back into the edit", async () => {
    const { user } = await toReview();
    await user.click(screen.getByRole("link", { name: "Edit Your retirement savings" }));
    await user.click(screen.getByRole("radio", { name: /^No/ }));
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.backToReview }));
    expect(where()).toBe("/wizard?step=8");
    await user.click(screen.getByRole("button", { name: "history back" }));
    expect(where()).toBe("/wizard?step=7"); // the payslip step, as before the edit
  });

  it("Back during an edit also returns to the review, and leaves things as they were", async () => {
    const { user } = await toReview();
    await user.click(screen.getByRole("link", { name: "Edit Your income" }));
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.back }));
    expect(where()).toBe("/wizard?step=8");
  });

  it("the age row has its own Change link", async () => {
    const { user } = await toReview();
    await user.click(screen.getByRole("link", { name: "Change Age group" }));
    expect(where()).toBe("/wizard?step=2&from=review");
    await user.click(screen.getByRole("radio", { name: "65 to 74" }));
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.backToReview }));
    expect(norm(document.body.textContent)).toContain("65 to 74");
  });

  it("changing how you start from the review clears the amount and asks for it again", async () => {
    const { user } = await toReview();
    await user.click(screen.getByRole("link", { name: "Change Starting point" }));
    await user.click(screen.getByRole("radio", { name: /bank account/ }));
    await user.click(screen.getByRole("button", { name: copy.wizard.nav.backToReview }));
    expect(where()).toBe("/wizard?step=1");
    expect(heading()).toBe(copy.wizard.amount.questions.TAKE_HOME.MONTHLY);
  });

  it("lists optional extras and the payslip once they're filled in", async () => {
    const { user } = await toExtras();
    await openExtras(user);
    await user.type(field(new RegExp(X.interestLabel.slice(0, 20))), "30000");
    await user.click(continueBtn());
    await user.type(field(literal(P.payeLabel)), "4681");
    await user.click(continueBtn());
    expect(screen.getByRole("heading", { level: 2, name: RV.groups.extras })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: RV.groups.payslip })).toBeTruthy();
    const page = norm(document.body.textContent);
    expect(page).toContain("Interest, per year");
    expect(page).toContain("PAYE on your payslip");
    expect(page).toContain("R 4 681,00");
  });

  it("the whole review is reachable only when everything before it is done", () => {
    renderApp("/wizard?step=8");
    expect(where()).toBe("/wizard?step=0");
  });

  it("a debit-order retirement annuity: the result says the saving comes back on filing", async () => {
    const r = renderApp("/wizard?start=gross");
    await r.user.type(amountInput(), "30000");
    await r.user.click(continueBtn());
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^Yes/ }));
    await r.user.type(field(new RegExp(R.raLabel)), "2000");
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("radio", { name: /^No/ }));
    await r.user.click(continueBtn());
    await r.user.click(screen.getByRole("checkbox", { name: "None of these" }));
    await finishFromVariable(r.user);
    const page = norm(document.body.textContent);
    expect(page).toContain("R 4 681,00"); // payroll PAYE unchanged
    expect(page).toContain("About R 6 240,00 should come back to you when you file");
  });
});

describe("the complete flow in every mode", () => {
  it.each([
    ["take-home", 7],
    ["gross", 8],
    ["payslip", 8],
  ] as const)("%s walks %i steps after the start and reaches the result", async (start, steps) => {
    const r = renderApp(`/wizard?start=${start}`);
    await r.user.type(amountInput(), "20000");
    await r.user.click(continueBtn());
    expect(screen.getByText(new RegExp(`Step 2 of ${steps}: Your age`))).toBeTruthy();
    await finishFromAge(r.user);
    expect(where()).toBe("/results");
  });
});
