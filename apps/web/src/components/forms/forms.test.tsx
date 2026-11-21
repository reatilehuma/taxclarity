// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChipGroup } from "./ChipGroup.tsx";
import { ChoiceCards } from "./ChoiceCards.tsx";
import { CurrencyField } from "./CurrencyField.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { Stepper } from "./Stepper.tsx";

afterEach(cleanup);

const nbsp = (s: string) => s.replace(/ /g, " ");

/** A field wired to state, the way the wizard uses it, remembering every value it emitted. */
function Currency({ initial = null, emitted, ...props }: { initial?: number | null; emitted: (number | null)[]; unit?: "rand" | "km"; error?: string | null; hint?: string; optional?: boolean }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <CurrencyField
      label="Gross pay"
      value={value}
      onChange={(v) => {
        emitted.push(v);
        setValue(v);
      }}
      {...props}
    />
  );
}

describe("CurrencyField", () => {
  it("is a labelled text box with a decimal keyboard on phones", () => {
    render(<Currency emitted={[]} />);
    const input = screen.getByRole("textbox", { name: /Gross pay/ }) as HTMLInputElement;
    expect(input.inputMode).toBe("decimal");
    expect(input.type).toBe("text");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.placeholder).toBe("0,00");
  });

  it("says the unit to screen readers", () => {
    render(<Currency emitted={[]} />);
    expect(screen.getByLabelText(/\(in rand\)/)).toBeTruthy();
    cleanup();
    render(<Currency emitted={[]} unit="km" />);
    expect(screen.getByLabelText(/\(in kilometres\)/)).toBeTruthy();
  });

  it("groups thousands while typing and reports a plain number", async () => {
    const user = userEvent.setup({ delay: null });
    const emitted: (number | null)[] = [];
    render(<Currency emitted={emitted} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "30000");
    expect(nbsp(input.value)).toBe("30 000");
    expect(emitted.at(-1)).toBe(30_000);
  });

  it("shows two decimals once you leave the field", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Currency emitted={[]} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "30000");
    await user.tab();
    expect(nbsp(input.value)).toBe("30 000,00");
  });

  it.each([
    ["R30 000", 30_000],
    ["30,000.50", 30_000.5],
    ["30 000,5", 30_000.5],
    ["1500", 1_500],
  ])("accepts %s however it is written", async (typed, expected) => {
    const user = userEvent.setup({ delay: null });
    const emitted: (number | null)[] = [];
    render(<Currency emitted={emitted} />);
    await user.type(screen.getByRole("textbox"), typed);
    expect(emitted.at(-1)).toBe(expected);
  });

  it("accepts a pasted amount", async () => {
    const user = userEvent.setup({ delay: null });
    const emitted: (number | null)[] = [];
    render(<Currency emitted={emitted} />);
    await user.click(screen.getByRole("textbox"));
    await user.paste("R 45 000,00");
    expect(emitted.at(-1)).toBe(45_000);
  });

  it("clears to null, not zero", async () => {
    const user = userEvent.setup({ delay: null });
    const emitted: (number | null)[] = [];
    render(<Currency emitted={emitted} initial={500} />);
    await user.clear(screen.getByRole("textbox"));
    expect(emitted.at(-1)).toBeNull();
  });

  it("kilometres are whole numbers", async () => {
    const user = userEvent.setup({ delay: null });
    const emitted: (number | null)[] = [];
    render(<Currency emitted={emitted} unit="km" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "12500");
    await user.tab();
    expect(nbsp(input.value)).toBe("12 500");
    expect(emitted.at(-1)).toBe(12_500);
  });

  it("links its hint and its error to the field, and marks it invalid only with an error", () => {
    const { rerender } = render(<Currency emitted={[]} hint="Rand per month." />);
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(input.getAttribute("aria-describedby")!)!.textContent).toBe("Rand per month.");
    rerender(<Currency emitted={[]} hint="Rand per month." error="Amounts can't be negative." />);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toHaveLength(2);
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toContain("Amounts can't be negative.");
  });

  it("an error is announced politely", () => {
    render(<Currency emitted={[]} error="Please enter an amount." />);
    const message = screen.getByText("Please enter an amount.");
    expect(message.closest("[aria-live]")?.getAttribute("aria-live") ?? message.getAttribute("aria-live")).toBe("polite");
  });

  it("marks an optional field as optional", () => {
    render(<Currency emitted={[]} optional />);
    expect(screen.getByText("(optional)")).toBeTruthy();
  });

  it("shows a value that changes from outside, but never rewrites what you are typing", async () => {
    const user = userEvent.setup({ delay: null });
    function Outer() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <>
          <CurrencyField label="Amount" value={value} onChange={setValue} />
          <button onClick={() => setValue(1234.5)}>set</button>
        </>
      );
    }
    render(<Outer />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.type(input, "12");
    expect(input.value).toBe("12");
    await user.click(screen.getByRole("button", { name: "set" }));
    expect(nbsp(input.value)).toBe("1 234,50");
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "MONTHLY", label: "Monthly" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "FORTNIGHTLY", label: "Every two weeks" },
  ] as const;

  function Controlled({ onPick }: { onPick?: (v: string) => void }) {
    const [value, setValue] = useState<(typeof options)[number]["value"]>("MONTHLY");
    return (
      <SegmentedControl
        legend="How often are you paid?"
        name="freq"
        value={value}
        onChange={(v) => {
          onPick?.(v);
          setValue(v);
        }}
        options={[...options]}
      />
    );
  }

  it("is a radio group named by its legend, with the chosen option checked", () => {
    render(<Controlled />);
    expect(screen.getByRole("group", { name: "How often are you paid?" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect((screen.getByRole("radio", { name: "Monthly" }) as HTMLInputElement).checked).toBe(true);
  });

  it("picking an option with a tap on its label", async () => {
    const user = userEvent.setup({ delay: null });
    const picked: string[] = [];
    render(<Controlled onPick={(v) => picked.push(v)} />);
    await user.click(screen.getByText("Weekly"));
    expect(picked).toEqual(["WEEKLY"]);
    expect((screen.getByRole("radio", { name: "Weekly" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Monthly" }) as HTMLInputElement).checked).toBe(false);
  });

  it("arrow keys move between options and choose them (PRD §9)", async () => {
    const user = userEvent.setup({ delay: null });
    const picked: string[] = [];
    render(<Controlled onPick={(v) => picked.push(v)} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Monthly" }));
    await user.keyboard("{ArrowRight}");
    expect(picked.at(-1)).toBe("WEEKLY");
    await user.keyboard("{ArrowRight}");
    expect(picked.at(-1)).toBe("FORTNIGHTLY");
    await user.keyboard("{ArrowLeft}");
    expect(picked.at(-1)).toBe("WEEKLY");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Weekly" }));
  });

  it("is one tab stop: Tab leaves the group instead of walking through every option", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <Controlled />
        <button>after</button>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));
  });

  it("can hide its legend visually while screen readers still hear it", () => {
    render(<SegmentedControl legend="Pay frequency" hideLegend name="x" value="A" onChange={() => {}} options={[{ value: "A", label: "A" }, { value: "B", label: "B" }]} />);
    expect(screen.getByText("Pay frequency").className).toContain("sr-only");
    expect(screen.getByRole("group", { name: "Pay frequency" })).toBeTruthy();
  });
});

describe("ChoiceCards", () => {
  it("is a radio group of cards; Space picks and the arrow keys move", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(
      <ChoiceCards
        legend="How would you like to start?"
        name="start"
        value={null}
        onChange={onChange}
        options={[
          { value: "A", title: "Bank amount", description: "Easiest" },
          { value: "B", title: "Gross salary" },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "How would you like to start?" })).toBeTruthy();
    await user.tab();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("A");
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("B");
  });
});

describe("ChipGroup", () => {
  it("chips are checkboxes: several can be on, each toggles with Space", async () => {
    const user = userEvent.setup({ delay: null });
    function Chips() {
      const [picked, setPicked] = useState<string[]>([]);
      return (
        <ChipGroup
          legend="Do you earn any of these?"
          isChecked={(v) => picked.includes(v)}
          onToggle={(v) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
          options={[
            { value: "BONUS", label: "Bonus" },
            { value: "OVERTIME", label: "Overtime" },
          ]}
        />
      );
    }
    render(<Chips />);
    const bonus = screen.getByRole("checkbox", { name: "Bonus" }) as HTMLInputElement;
    const overtime = screen.getByRole("checkbox", { name: "Overtime" }) as HTMLInputElement;
    await user.click(screen.getByText("Bonus"));
    await user.tab();
    expect(document.activeElement).toBe(overtime);
    await user.keyboard(" ");
    expect(bonus.checked && overtime.checked).toBe(true);
    await user.keyboard(" ");
    expect(overtime.checked).toBe(false);
  });
});

describe("Stepper", () => {
  function Counter({ min = 1, max = 5 }: { min?: number; max?: number }) {
    const [value, setValue] = useState(2);
    return <Stepper label="People" value={value} min={min} max={max} onChange={setValue} moreLabel="One more" fewerLabel="One fewer" />;
  }

  it("plus and minus change the number and stop at the limits", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Counter />);
    const box = screen.getByRole("textbox", { name: "People" }) as HTMLInputElement;
    await user.click(screen.getByRole("button", { name: "One more" }));
    expect(box.value).toBe("3");
    await user.click(screen.getByRole("button", { name: "One fewer" }));
    await user.click(screen.getByRole("button", { name: "One fewer" }));
    expect(box.value).toBe("1");
    expect((screen.getByRole("button", { name: "One fewer" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("typed numbers are kept inside the limits and settle on leaving", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Counter />);
    const box = screen.getByRole("textbox", { name: "People" }) as HTMLInputElement;
    await user.clear(box);
    await user.type(box, "99");
    await user.tab();
    expect(box.value).toBe("5"); // 99 is too many: it settles on the limit
    await user.clear(box);
    await user.tab();
    expect(box.value).toBe("5");
  });
});
