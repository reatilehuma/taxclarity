import type { Explanation, Recommendation } from "@taxclarity/tax-engine";
import { percent, rand } from "./format.ts";
import type { AssistantPayload, AssistantReply, AssistantRequest, TaxAssistantProvider } from "./types.ts";

/**
 * The local explainer: answers from templates, on the device, using only figures that are in the payload.
 * It never does arithmetic. Where a sentence needs a number, that number is looked up, not worked out.
 * That is what lets the same safety check (figures.ts) pass every reply, and what a real model will be held to.
 */

type Topic =
  | "ADVICE" | "COMPARE" | "FILING" | "VARIABLE" | "RETIREMENT" | "MEDICAL" | "AGE" | "DONATIONS" | "TRAVEL"
  | "INTEREST" | "UIF" | "TAKE_HOME" | "BRACKET" | "PAYE" | "GLOSSARY" | "HELP";

/** Checked in this order: the first topic that matches wins. */
const TOPICS: [Topic, RegExp][] = [
  ["ADVICE", /\b(should i|invest(ing|ment)?|which (medical aid|fund|bank|policy|scheme|plan)|best|crypto|shares?|stocks?|property|bonds?|loan|evade|evasion|avoid (paying )?tax|loophole|hide|am i being cheated|sue)\b/],
  ["COMPARE", /\b(payslip|pay slip|difference|differ|employer (deduct|took|take)|mismatch|compare|comparison|discrepan)/],
  ["FILING", /\b(refund|owe|owing|file|filing|return|efiling|assessment|provisional)/],
  ["VARIABLE", /\b(bonus|13th|thirteenth|overtime|commission)/],
  ["AGE", /\b(rebate|65|75|older|senior|over 65)/],
  ["RETIREMENT", /\b(retirement|pension|provident|ra|annuity|11f|retire)\b/],
  ["MEDICAL", /\b(medical|6a|6b|scheme|dependant|dependent)/],
  ["DONATIONS", /\b(donat|charity|18a)/],
  ["TRAVEL", /\b(travel|logbook|kilomet|car allowance)/],
  ["INTEREST", /\b(interest|tfsa|tax[- ]free (saving|invest)|savings)/],
  ["UIF", /\buif\b|unemployment/],
  ["TAKE_HOME", /\b(take[- ]?home|bank account|deposit|net (pay|salary)|land in|lands in)/],
  ["BRACKET", /\b(bracket|top rate|marginal|highest rate|tax rate|which rate|percent|slice)/],
  ["GLOSSARY", /\bwhat (is|are|does|do)\b.*\b(paye|taxable income|effective rate|fringe|tax year)\b|\b(define|meaning of)\b/],
  ["PAYE", /\b(paye|why .*tax|how .*tax|income tax|tax for the year|liability|worked out|calculated)/],
  ["GLOSSARY", /\b(what (is|are|does)|meaning|define|explain)\b/],
];

export function classify(question: string): Topic {
  const q = question.toLowerCase();
  for (const [topic, pattern] of TOPICS) if (pattern.test(q)) return topic;
  return "HELP";
}

const explanation = <T extends Explanation["id"]>(p: AssistantPayload, id: T) =>
  p.explanations.find((e) => e.id === id) as Extract<Explanation, { id: T }> | undefined;
const advice = <T extends Recommendation["id"]>(p: AssistantPayload, id: T) =>
  p.recommendations.find((r) => r.id === id) as Extract<Recommendation, { id: T }> | undefined;

const estimateNote = (p: AssistantPayload) =>
  p.confidence === "ESTIMATE" ? "\n\nBecause you started from your bank amount, your gross salary is an estimate, so the figures are too." : "";

const topicReplies: Record<Topic, (p: AssistantPayload) => string> = {
  ADVICE: () =>
    "I can only explain how your tax was worked out. I can't say what you should do with your money, so for choices like that it is worth speaking to a registered tax practitioner. I can explain any part of your result if you'd like.",

  HELP: () =>
    "I can explain how your result was worked out. You could ask: which tax bracket am I in, why is my PAYE what it is, how is my take-home pay worked out, how much would a retirement annuity save me, or why is my bonus taxed so heavily.",

  BRACKET: (p) => {
    const f = p.figures;
    const used = p.bracketWalk.filter((b) => b.amountInBracket > 0);
    if (used.length === 0) {
      return `Your taxable income for the year is ${rand(f.taxableIncome)}, which is below the level where tax starts (${rand(f.taxThreshold)} for your age group), so no income tax is due.`;
    }
    const where = (b: (typeof used)[number]) =>
      b.from === 0 ? `up to ${rand(b.to ?? 0, 0)}` : b.to === null ? `above ${rand(b.from, 0)}` : `above ${rand(b.from, 0)} up to ${rand(b.to, 0)}`;
    const lines = used.map((b) => `• ${rand(b.amountInBracket)} of your income is in the ${percent(b.rate)} bracket (${where(b)}), which comes to ${rand(b.taxInBracket)} of tax.`);
    const top = p.bracketWalk.find((b) => b.isTopBracket);
    return [
      `Your taxable income for the year is ${rand(f.taxableIncome)}. South Africa taxes income in slices called brackets, and each slice is taxed at its own rate:`,
      lines.join("\n"),
      `Your top bracket is ${percent(top?.rate ?? p.figures.marginalRate)}. That means the next rand you earn is taxed at that rate. It is not the rate on all your income: the tax before rebates is ${rand(f.annualTaxBeforeRebates)}, and your tax for the year after rebates and credits is ${rand(f.annualLiability)}, which is ${percent(f.effectiveRate)} of your income.`,
    ].join("\n\n") + estimateNote(p);
  },

  PAYE: (p) => {
    const f = p.figures;
    const credit = f.medicalCreditApplied > 0 ? ` A medical aid credit of ${rand(f.medicalCreditApplied)} then comes off.` : "";
    return (
      `Here is how your tax for the year was worked out. Your taxable income is ${rand(f.taxableIncome)}. The SARS brackets give tax of ${rand(f.annualTaxBeforeRebates)} on that. Rebates, which are fixed amounts SARS takes off your tax, come to ${rand(f.rebatesTotal)}, leaving ${rand(f.taxAfterRebates)}.${credit} Your tax for the year after all rebates and credits is ${rand(f.annualLiability)}.` +
      `\n\nYour employer's PAYE in a normal month is ${rand(f.monthlyPaye)}. PAYE is the tax your employer takes off each month and pays to SARS for you.` +
      estimateNote(p)
    );
  },

  TAKE_HOME: (p) => {
    const f = p.figures;
    const parts = [`PAYE of ${rand(f.monthlyPaye)}`, `UIF of ${rand(f.uifMonthly)}`];
    if (f.ownRetirementMonthly > 0) parts.push(`your retirement contribution of ${rand(f.ownRetirementMonthly)}`);
    if (f.ownMedicalMonthly > 0 && explanation(p, "MEDICAL_CREDIT")?.claimedOnFiling !== true) parts.push(`your medical aid share of ${rand(f.ownMedicalMonthly)}`);
    return (
      `In a normal month your gross pay is ${rand(f.grossMonthly)}. After ${parts.join(", ")}, ${rand(f.takeHomeMonthly)} lands in your bank account. A normal month leaves out any bonus, overtime or commission.` +
      estimateNote(p)
    );
  },

  UIF: (p) => {
    const f = p.figures;
    return `UIF is the Unemployment Insurance Fund. You pay 1% of your pay, up to a maximum of ${rand(p.rules.uifMaxMonthly)} a month. Yours is ${rand(f.uifMonthly)} a month (${rand(f.uifAnnual)} for the year), and your employer pays the same amount on top. It never comes back on your payslip, but it insures you if you lose your job.`;
  },

  RETIREMENT: (p) => {
    const r = explanation(p, "RETIREMENT");
    const r1 = advice(p, "R1");
    const r2 = advice(p, "R2");
    const limits = `SARS lets you deduct up to ${percent(p.rules.retirementRate)} of your pay, to a maximum of ${rand(p.rules.retirementAnnualCap, 0)} a year.`;
    const parts: string[] = [];
    if (r) {
      parts.push(
        r.savingAnnual > 0
          ? `You put ${rand(r.contributedMonthly)} a month into retirement savings. That comes off your taxable income before tax is worked out, which saves you about ${rand(r.savingMonthly)} a month (${rand(r.savingAnnual)} a year) in tax, at your top rate of ${percent(r.marginalRate)}. ${limits}`
          : `You put ${rand(r.contributedMonthly)} a month into retirement savings. That comes off your taxable income, but you pay no tax at the moment, so it doesn't save you anything yet. ${limits}`,
      );
      if (r.carryForwardAnnual > 0) parts.push(`You are over the yearly limit by ${rand(r.carryForwardAnnual)}. It isn't lost: it carries forward to later years.`);
    } else {
      parts.push(`You didn't tell me about retirement savings. Money put into a pension, provident fund or retirement annuity comes off your taxable income, which lowers your tax. ${limits}`);
    }
    const example = r1 ?? r2;
    if (example) {
      parts.push(
        `As an example (not advice), ${rand(example.extraMonthly, 0)} more a month would cut your tax by about ${rand(example.monthlySaving)} a month (${rand(example.annualSaving)} a year). The calculator worked that out from your own figures. You have room for about ${rand(example.roomAnnual)} a year.`,
      );
    }
    return parts.join("\n\n");
  },

  MEDICAL: (p) => {
    const m = explanation(p, "MEDICAL_CREDIT");
    const b = explanation(p, "MEDICAL_6B");
    const parts: string[] = [];
    if (m) {
      const who = m.members === 1 ? `${rand(m.mainMonthly)} for you` : m.members === 2 ? `${rand(m.mainMonthly)} for you and ${rand(m.firstDependantMonthly)} for your dependant` : `${rand(m.mainMonthly)} for you, ${rand(m.firstDependantMonthly)} for your first dependant and ${rand(m.additionalMonthly)} for each extra person`;
      parts.push(`Your medical aid gives you a tax credit of ${rand(m.monthlyCredit)} a month: ${who}. It comes straight off your tax, not off your income. ${rand(m.appliedAnnual)} of it was used this year.`);
      if (m.unusedAnnual > 0) parts.push(`${rand(m.unusedAnnual)} could not be used because your tax is not big enough. It isn't paid out.`);
      if (m.claimedOnFiling) parts.push("You pay your medical aid yourself, so payroll doesn't apply the credit. You claim it when you file.");
    } else {
      parts.push(`I don't see a medical aid in your answers. The credit for one person is ${rand(p.rules.medicalMain)} a month, and it comes straight off your tax.`);
    }
    if (b) parts.push(`Medical costs your scheme didn't cover (${rand(b.outOfPocketAnnual)}) earn an extra credit of ${rand(b.appliedAnnual)}, taken off your tax when you file.`);
    return parts.join("\n\n");
  },

  VARIABLE: (p) => {
    const v = explanation(p, "VARIABLE_PAY");
    if (!v) {
      return "You didn't tell me about a bonus, overtime or commission. In general, extra pay is added on top of your salary, so it is taxed at your top rate. That is why the tax can look heavy in the month it is paid.";
    }
    return `Your extra pay adds up to ${rand(v.totalAnnual)} for the year. About ${rand(v.taxAnnual)} of it goes in tax (${percent(v.effectiveRate)}), because it is added on top of your salary and taxed at your top rate of ${percent(v.marginalRate)}. The tax is worked out for the whole year, so the month you are paid looks heavy. Your payroll may time it differently from the calculator.`;
  },

  AGE: (p) => {
    const a = explanation(p, "AGE_REBATE");
    const base = `Everyone gets a primary rebate of ${rand(p.rules.rebatePrimary)} off their tax. From age 65 there is another ${rand(p.rules.rebateSecondary)}, and from 75 a further ${rand(p.rules.rebateTertiary)}.`;
    if (!a) return `${base} You are younger than 65, so only the primary rebate applies to you.`;
    return `${base} In your case the age rebates take ${rand(a.savingAnnual)} off your tax this year.`;
  },

  DONATIONS: (p) => {
    const d = explanation(p, "DONATIONS");
    if (d) {
      return `Your ${rand(d.givenAnnual)} donation to a registered charity came off your taxable income, saving about ${rand(d.savingAnnual)} in tax.${d.carryForwardAnnual > 0 ? ` The part above the ${percent(p.rules.donationsLimitRate)} limit (${rand(d.carryForwardAnnual)}) carries forward to next year.` : ""} Keep your section 18A receipt: you need it to claim.`;
    }
    const r5 = advice(p, "R5");
    const base = `Gifts to charities registered under section 18A come off your income, up to ${percent(p.rules.donationsLimitRate)} of it. You didn't tell me about any donations.`;
    return r5 ? `${base} As an example, ${rand(r5.exampleAnnual, 0)} given would save you about ${rand(r5.annualSaving)} in tax.` : base;
  },

  TRAVEL: (p) => {
    const t = explanation(p, "TRAVEL");
    if (!t) return "You didn't tell me about a travel allowance. When an employer pays one, only part of it is taxed, and you can claim more with a logbook of your business trips.";
    const logbook = t.possibleDeductionAnnual > 0 ? ` With a logbook you may be able to claim up to about ${rand(t.possibleDeductionAnnual)} when you file. That is an estimate and is not in the main numbers.` : "";
    return `Your travel allowance is ${rand(t.allowanceAnnual)} a year. SARS taxes ${percent(t.taxableRate)} of it (${rand(t.taxableAnnual)}).${logbook}`;
  },

  INTEREST: (p) => {
    const i = explanation(p, "INTEREST");
    const free = `A tax-free savings account takes up to ${rand(p.rules.tfsaAnnual, 0)} a year and ${rand(p.rules.tfsaLifetime, 0)} in your lifetime, and you never pay tax on its growth. It doesn't lower your PAYE.`;
    if (!i) return `The first ${rand(p.rules.interestExemptionUnder65, 0)} of bank interest is tax-free (${rand(p.rules.interestExemption65Plus, 0)} from age 65). You didn't tell me about any interest. ${free}`;
    return `You earned ${rand(i.interestAnnual)} in interest. The first ${rand(i.exemptionAnnual)} is tax-free${i.taxableAnnual === 0 ? ", so none of it is taxed" : `, so ${rand(i.taxableAnnual)} is added to your income`}. ${free}`;
  },

  FILING: (p) => {
    const f = p.figures;
    const why = "Your employer takes off tax month by month; when you file, SARS works out the final amount and settles the difference.";
    if (f.refundAnnual > 0) return `${why} Based on what you told me, about ${rand(f.refundAnnual)} should come back to you, because your payslip tax doesn't include everything that lowers your tax. This is an estimate, not a SARS assessment.`;
    if (f.owedAnnual > 0) return `${why} Based on what you told me, you could owe SARS about ${rand(f.owedAnnual)}, because your payslip tax doesn't include all your income. This is an estimate, not a SARS assessment.`;
    return `${why} Based on what you told me, your payslip tax matches your final tax of ${rand(f.annualLiability)}, so there is nothing to pay or claim.`;
  },

  COMPARE: (p) => {
    const c = p.comparison;
    if (!c) return "You haven't entered the PAYE from your payslip, so there is nothing to compare. If you add it on the payslip step, the results page shows both numbers side by side.";
    const reasons = "A difference doesn't mean your employer made a mistake, and it doesn't guarantee a SARS refund. Common reasons are a different SARS-allowed payroll method, a bonus or back-pay in the month you checked, other income, or credits applied differently. Comparing a February payslip (no bonus) can help.";
    if (c.closeMatch) return `Your payslip PAYE of ${rand(c.payslipPaye)} and the calculator's ${rand(c.calcPaye)} match to within R1. ${reasons}`;
    return `Your payslip shows PAYE of ${rand(c.payslipPaye)} and the calculator gives ${rand(c.calcPaye)}, a difference of ${rand(Math.abs(c.diff))}. ${reasons}`;
  },

  GLOSSARY: (p) =>
    `Here are the main terms. PAYE is the income tax your employer takes off each month and pays to SARS. Taxable income is the part of your income SARS actually taxes, after allowed deductions; yours is ${rand(p.figures.taxableIncome)}. A tax bracket is a slice of income taxed at one rate. Your marginal rate is the rate on your next rand (${percent(p.figures.marginalRate)}); your effective rate is your tax as a share of your income (${percent(p.figures.effectiveRate)}). A rebate is a fixed amount SARS takes off your tax. Ask me about any of them in more detail.`,
};

/** Replies that quote no figures, so naming the tax year would add nothing. */
const NO_YEAR_LINE = new Set<Topic>(["ADVICE", "HELP"]);

/** Answers on the device. Nothing is sent anywhere. */
export class LocalExplainer implements TaxAssistantProvider {
  readonly id = "local-explainer";
  readonly label = "Local explainer";
  readonly runsOnDevice = true;

  ask(request: AssistantRequest): Promise<AssistantReply> {
    const topic = classify(request.question);
    const text = topicReplies[topic](request.payload);
    // Say which tax year the figures are for, whenever the answer quotes any (not for the general "what can I ask" replies).
    const line = `These figures are for the ${request.payload.taxYear} tax year.`;
    return Promise.resolve({ text: NO_YEAR_LINE.has(topic) ? text : `${line}\n\n${text}` });
  }
}
