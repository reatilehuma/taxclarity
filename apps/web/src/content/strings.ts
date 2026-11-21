/**
 * All user-facing copy (D9: English only for v1, kept in one module so it can be translated later).
 * Tone: plain, warm South African English, about a grade-8 reading level (PRD §16).
 * The Workbench (development only) keeps its own copy.
 */

/** Product name — a placeholder (PRD front matter). Change it here and everywhere follows. */
import type { PdfText } from "@taxclarity/pdf-export";
import { CurrentTaxRules as rules, type TaxRuleSet } from "@taxclarity/tax-engine";
import { formatDate, formatPercent, formatRand } from "../lib/format.ts";

/** The tax year the copy talks about, taken from the rule set so a new year needs no copy edits for these. */

/** What the year-bound sentences need to know: a label like "2026/27" and the first and last day (ISO dates). */
export interface YearFacts {
  label: string;
  startDate: string;
  endDate: string;
}

/**
 * Every sentence that names the tax year or its dates, built for ONE year. Screens that follow the person's chosen
 * year use this with that year's rule set (or a result's own year); `copy` below holds the default year's version of
 * the same sentences, so there is a single wording for each.
 */
export function yearCopy(y: YearFacts) {
  const label = y.label;
  const start = formatDate(y.startDate);
  const end = formatDate(y.endDate);
  return {
    label,
    start,
    end,
    /** "2026/27 · 1 March 2026 – 28 February 2027" */
    labelWithDates: `${label} · ${start} – ${end}`,
    pill: `${label} tax year`,
    footerYear: `Rules for the ${label} tax year: ${start} to ${end}.`,
    ageLegend: `Your age group at ${end}`,
    ageFaqAnswer: `Rebates are based on your age at the end of the tax year (${end}). If you'll be 65 by then, choose 65 to 74.`,
    uifTooHigh: (max: string) =>
      `UIF above ${max} a month isn't possible under ${label} rules. Check the figure on your payslip. You can still continue.`,
    smallPrint: `This is an estimate for the ${label} tax year (${start} to ${end}) based on the information you gave. It is not tax advice or a SARS assessment.`,
    taxYearLine: (from: string, to: string) => `${label} tax year · ${from} – ${to}`,
    payslipMid: `; based on the SARS ${label} rules, our calculation gives`,
    bracketsCaption: `SARS income tax brackets for ${label} with your income in each`,
    panelTableCaption: `SARS income tax brackets for ${label}, with your income in each`,
    taxForYearHint: `The final income tax for the ${label} tax year.`,
  };
}

/** A result's own year, for words about a result that must match the numbers on screen. */
export function yearFactsOf(r: { taxYear: string; provenance: { period: { start: string; end: string } } }): YearFacts {
  return { label: r.taxYear.replace("-", "/"), startDate: r.provenance.period.start, endDate: r.provenance.period.end };
}

/**
 * Every sentence that quotes a figure from the tax rules, built from ONE year's rule set (PRD §6.16: year-specific text
 * reads the selected year's configuration). Nothing that quotes a rule figure is written into `copy` itself, so there
 * is no stale figure to forget when a year changes; `content/figures.test.ts` checks both years' sentences.
 */
export function ruleCopy(r: TaxRuleSet) {
  const R = (n: number) => formatRand(n);
  const R0 = (n: number) => formatRand(n, { decimals: 0 });
  const year = yearCopy(r);
  return {
    ...year,
    /** The first trust-strip line. */
    trustSars: `Based on official SARS ${year.label} rules`,
    /** The UIF row's tooltip in the preview. */
    uifHint: `${formatPercent(r.uif.employeeRate)} of your pay (max ${R(r.uif.maxMonthlyEmployee)} a month). Your employer matches it.`,
    /** The retirement FAQ answer about the yearly limit. */
    retirementLimitFaq: `Up to ${formatPercent(r.retirement11F.rate)} of your income, capped at ${R0(r.retirement11F.annualCap)} a year (${year.label}). Anything above the cap carries forward to future years.`,
    /** Landing-page capability blurbs, keyed by their icon. */
    capability: {
      shield: `Your ${formatPercent(r.uif.employeeRate)} unemployment insurance contribution, capped at ${R(r.uif.maxMonthlyEmployee)}.`,
      piggy: `Retirement savings that lower your tax, up to ${R0(r.retirement11F.annualCap)} a year.`,
      heart: `${R0(r.medical6A.monthlyMain)} a month for you, ${R0(r.medical6A.monthlyFirstDep)} for your first dependant and ${R0(r.medical6A.monthlyAdditionalDep)} for each extra.`,
    } as Record<string, string>,
    /** Shown on the landing page when the example (always the default year) is not the year chosen. */
    exampleNote: (exampleLabel: string) => `The example below always uses the ${exampleLabel} rules, whichever tax year you choose.`,
  };
}

/** The retirement FAQ question whose answer quotes the year's limit; wizard/flow.ts fills the answer from the rule set. */
export const RETIREMENT_LIMIT_QUESTION = 'How much can I deduct?';

const DEFAULT_YEAR = yearCopy(rules);

export const PRODUCT_NAME = "ClearTax SA";

export const copy = {
  meta: {
    titleSuffix: PRODUCT_NAME,
    landingTitle: `${PRODUCT_NAME}: understand your salary and your PAYE`,
  },

  taxYear: {
    label: "Tax year",
    /** The select's accessible name where it sits beside a live preview, so two on one screen are told apart. */
    previewLabel: "Tax year for this preview",
    draftTag: "Draft",
    onlyOne: "More tax years will be added here once they have been checked.",
    /** Announced politely and shown, not blocking (PRD §8). */
    changed: (label: string) => `Tax year changed to ${label}. Your results have been recalculated using that year's rules.`,
    dismiss: "Dismiss this message",
    ageConfirm: {
      title: (label: string) => `Check your age group for ${label}`,
      body: (band: string, fromLabel: string, toLabel: string, toEnd: string) =>
        `Your age group is worked out on the last day of the tax year. You chose "${band}" for ${fromLabel}. You could be in a different group on ${toEnd} (${toLabel}), so please check it before we show numbers.`,
      legend: (end: string) => `Your age group at ${end}`,
      confirm: "Yes, this is right",
      waiting: "Numbers appear once you have checked your age group.",
    },
  },

  /**
   * The PDF summary (PRD §14.8). `document` is every word on the page, in the shape the PDF package expects, so the
   * English lives here with the rest of the copy and the package holds no wording of its own.
   */
  pdf: {
    button: "Download PDF summary",
    creating: "Creating PDF…",
    done: "Your PDF summary has been saved to your downloads.",
    failed: "We couldn't create the PDF. Please try again.",
    /** The button after a failure: pressing it makes a fresh attempt. */
    retry: "Try again",
    document: {
      productName: PRODUCT_NAME,
      filenamePrefix: "cleartax-sa-summary",
      title: "South African Income Tax — Calculation Summary",
      subtitle: "Independent estimate — not a SARS assessment",
      detailsHeading: "Details",
      detailLabels: {
        taxYear: "Tax year",
        period: "Period",
        generated: "Date generated",
        basedOn: "Calculation based on",
        confidence: "Confidence",
      },
      basedOn: { GROSS: "Gross salary", TAKE_HOME: "Bank deposit (gross salary estimated)", PAYSLIP: "Payslip" },
      confidence: { ESTIMATE: "Estimate", PAYSLIP_ACCURATE: "Payslip-based calculation" },
      columns: { description: "Description", amount: "Rand", month: "A normal month", year: "Whole year" },
      income: {
        heading: "Income and taxable amounts",
        rows: {
          INCOME_GROSS: "Gross remuneration",
          INCOME_EXTRAS: "Bonus, overtime and commission",
          INCOME_TRAVEL: "Taxable part of travel allowance",
          INCOME_EMPLOYER: "Employer contributions (taxable fringe benefit)",
          INCOME_OTHER_JOB: "Income from a second employer",
          INCOME_INTEREST: "Taxable interest (above the tax-free amount)",
        },
        total: "Total income",
      },
      deductions: {
        heading: "Deductions",
        rows: {
          RETIREMENT_DEDUCTION: "Retirement fund contributions (section 11F)",
          DONATIONS_DEDUCTION: "Donations to approved charities (section 18A)",
        },
        total: "Total deductions",
        taxable: "Taxable income",
        notes: [
          "Taxable income is the total income in Table 1 less the total deductions.",
          "Payroll deductions that SARS does not allow as deductions, such as your medical aid payments, are not in this table. Medical aid is dealt with as a tax credit in Table 3.",
        ],
      },
      disclaimer: {
        heading: "Disclaimer",
        paragraph:
          "This independent calculator provides an estimate based on the information entered and the selected tax year's rules. It is not issued by SARS, is not a Notice of Assessment, does not submit a tax return, and does not establish an amount payable or refundable. Your actual tax position may differ due to items outside this calculator's scope.",
      },
      footerRules: (rulesVersion: string, lastChecked: string) => `Rules ${rulesVersion} · figures last checked ${lastChecked}`,
      page: (page: number, pages: number) => `Page ${page} of ${pages}`,
    } satisfies Omit<PdfText, "tax" | "comparison" | "reconciliation" | "warnings" | "assumptions" | "flags">,
    /** The PDF's own labels for the tables that share the rest of their wording with the results page (see `pdfText`). */
    own: {
      taxHeading: "Tax calculation",
      taxRows: {
        TAX_BEFORE_REBATES: "Normal tax before rebates",
        REBATE_PRIMARY: "Less: primary rebate",
        REBATE_SECONDARY: "Less: age rebate (65 and over)",
        REBATE_TERTIARY: "Less: age rebate (75 and over)",
        REBATE_UNUSED: "Add back: rebates not needed",
        TAX_AFTER_REBATES: "Tax after rebates",
        CREDIT_6A: "Less: medical scheme fees tax credit (section 6A)",
        CREDIT_6B: "Less: additional medical expenses tax credit (section 6B)",
        TAX_FOR_YEAR: "Calculated annual income-tax liability",
        PAYE_MONTH: "Estimated PAYE, per month",
        PAYSLIP_PAYE_MONTH: "PAYE on your payslip, per month",
        UIF_MONTH: "UIF, per month",
        TAKE_HOME_MONTH: "Take-home pay, per month",
        TAKE_HOME_YEAR: "Take-home pay, per year",
      },
      comparisonHeading: "Payslip comparison (a normal month)",
      reconciliationHeading: "From salary to bank account",
    },
  },

  common: {
    taxYearPill: DEFAULT_YEAR.pill,
    privacyPill: "Privacy-first",
    skipToContent: "Skip to content",
    example: "Example",
    estimate: "Estimate",
    payslipAccurate: "Payslip-accurate",
    perMonth: "per month",
    perYear: "per year",
    monthly: "Monthly",
    annual: "Annual",
  },

  nav: {
    home: `${PRODUCT_NAME} home`,
    cta: "Check my salary",
    howItWorks: "How it works",
    privacy: "Privacy",
  },

  hero: {
    // PRD §2.5 — required headline.
    headline: "Understand Your Salary. Pay the Right Tax. Keep More of Your Money.",
    sub: "A free, plain-language tax calculator for salaried South Africans. No sign-up. Your numbers never leave your device.",
    primaryCta: "Start with my bank amount",
    secondaryCta: "Start with my salary",
    ctaNote: "Takes about five minutes. No payslip needed to start.",
    visualLabel: "Example: a payslip turning into your tax picture",
    payslipTitle: "Payslip · March 2026",
    payslipRows: {
      basic: "Basic salary",
      paye: "PAYE",
      uif: "UIF",
      pension: "Pension fund",
      medical: "Medical aid",
      net: "Net pay",
    },
  },

  trust: [
    "Based on official SARS rules",
    "Calculations run 100% in your browser",
    "No ID or tax number needed",
    "Free",
  ],

  how: {
    heading: "How it works",
    sub: "Three steps, one question at a time. No tax jargon.",
    steps: [
      {
        title: "Tell us what lands in your bank account",
        body: "Start with your monthly deposit, or your gross salary if you know it. We'll work out the rest.",
      },
      {
        title: "Answer a few yes/no questions",
        body: "Pension, medical aid, bonuses. Skip anything that doesn't apply to you.",
      },
      {
        title: "See your PAYE, your brackets, and ways to pay less, legally",
        body: "A clear breakdown of every rand, how SARS taxes it, and tips that fit your situation.",
      },
    ],
  },

  preview: {
    heading: "What you'll see",
    sub: "Your tax picture updates as you answer. Here's an example for someone earning R32 000 a month.",
    exampleLabel: "Example result. Yours will be personal.",
  },

  panel: {
    takeHome: "Take-home",
    takeHomeHint: "What lands in your bank account in a normal month.",
    paye: "PAYE",
    payeHint: "Income tax your employer deducts each month.",
    annualTax: "Tax for the year",
    summaryHeading: "Your numbers",
    rows: {
      gross: { label: "Gross salary", hint: "Your full pay before anything comes off." },
      taxable: { label: "Taxable income", hint: "The part of your income SARS actually taxes, after allowed deductions." },
      uif: { label: "UIF", hint: "A share of your pay, up to a maximum each month. Your employer matches it." },
      retirement: { label: "Retirement contributions", hint: "Pension, provident or RA. Reduces your taxable income." },
      medical: { label: "Medical aid credits", hint: "A fixed amount SARS takes off your tax for being on a medical aid." },
      other: { label: "Other deductions", hint: "Your share of medical aid and other payslip deductions." },
    },
    bracketHeading: "How your income is taxed",
    bracketHint: "Each slice of your income is taxed at its own rate. Only the top slice is taxed at your highest rate.",
    bracketSegment: (amount: string, rate: string) => `${amount} taxed at ${rate}`,
    topBracket: (rate: string) => `Your top rate: ${rate}`,
    tableToggle: "Full SARS bracket table",
    tableCaption: DEFAULT_YEAR.panelTableCaption,
    tableCols: { range: "Taxable income", rate: "Rate", yours: "Your income in it", tax: "Tax on it" },
    youAreHere: "You are here",
    andAbove: "and above",
  },

  // The live preview that sits beside (desktop) or under (phone) the wizard questions.
  live: {
    heading: "Your tax so far",
    regionLabel: "Live tax preview",
    emptyBadge: "No numbers yet",
    emptyTitle: "Your numbers will show up here",
    emptyBody: "Enter your amount and this panel fills in, then keeps up as you answer each question.",
    emptyCaption: "Nothing is calculated until you give an amount.",
    caption: "Updates as you answer. Worked backwards from your bank amount, so it is an estimate.",
    captionAccurate: "Updates as you answer. Worked forwards from the gross pay you gave us.",
    // Read out (politely) when the badge changes; nothing else in the panel is announced.
    announce: {
      estimate: "Your numbers are an estimate.",
      accurate: "Your numbers are payslip-accurate.",
    },
    bar: {
      open: "Show my tax preview",
      takeHome: "Take-home",
      paye: "PAYE",
      empty: "—",
      emptyHint: "Preview",
    },
    sheet: {
      title: "Your tax so far",
      close: "Close preview",
    },
  },

  capabilities: {
    heading: "What the calculator checks",
    items: [
      { icon: "receipt", title: "PAYE", body: "The income tax your employer should deduct each month." },
      { icon: "shield", title: "UIF", body: "Your unemployment insurance contribution, up to a monthly maximum." },
      { icon: "piggy", title: "Pension, provident & RA", body: "Retirement savings that lower your tax, up to a yearly limit." },
      { icon: "heart", title: "Medical aid credits", body: "A fixed monthly credit for you and each person on your medical aid." },
      { icon: "gift", title: "Donations", body: "Gifts to registered charities that reduce your taxable income." },
      { icon: "spark", title: "Bonuses & overtime", body: "Why your bonus month looks so heavily taxed, and what you keep." },
      { icon: "calendar", title: "Age rebates", body: "Extra tax breaks from 65 and again from 75." },
      { icon: "car", title: "Travel allowance", body: "How much of your allowance is taxed, and what a logbook could save." },
    ],
  },

  privacy: {
    heading: "Your numbers stay yours",
    lines: [
      "Every calculation runs in your browser. Nothing is sent to us.",
      "No sign-up, no email, no account.",
      "We never ask for your ID number, tax number or bank details.",
      "Nothing is saved. Close the tab and it's gone.",
    ],
  },

  footer: {
    disclaimer: "Educational estimates only. Not tax advice, and not a SARS service.",
    taxYear: DEFAULT_YEAR.footerYear,
    lastVerified: (date: string) => `Tax figures last checked ${date}.`,
    sourcesHeading: "Official sources",
    madeFor: "Made for South African salary earners.",
  },

  wizard: {
    progress: {
      label: 'Progress',
      gettingStarted: 'Getting started',
      stepOf: (n: number, total: number, title: string) => `Step ${n} of ${total}: ${title}`,
    },
    nav: {
      back: 'Back',
      continue: 'Continue',
      skip: 'Skip',
      seeResult: 'See my tax result',
      backToReview: 'Back to review',
    },
    faqHeading: 'Common questions',
    stepTitles: {
      start: 'How you want to start',
      amount: 'Your pay',
      age: 'Your age',
      retirement: 'Retirement savings',
      medical: 'Medical aid',
      variable: 'Bonus and extras',
      extras: 'Optional extras',
      payslip: 'Your payslip',
      review: 'Review',
    },
    yesNo: {
      yes: 'Yes',
      no: 'No',
    },

    // Step 0 — PRD §8
    start: {
      question: 'How would you like to start?',
      sub: 'Pick whichever is easiest. You can change your mind later.',
      options: {
        TAKE_HOME: {
          title: 'The money in my bank account',
          description: "Tell us what you receive monthly and we'll work out the rest (estimate).",
          tag: 'Easiest',
        },
        GROSS: {
          title: 'My gross salary (before deductions)',
          description: 'The amount on your payslip or offer letter before anything is deducted.',
        },
        PAYSLIP: {
          title: 'My payslip',
          description: 'Gross salary plus what your employer actually deducts: the most accurate check.',
          tag: 'Most accurate',
        },
      },
      faq: [
        {
          question: "What's gross salary?",
          answer: "It's your full salary before tax, UIF, pension or medical aid comes off, usually the biggest number on your payslip.",
        },
        {
          question: "What's take-home pay?",
          answer: 'The money that actually lands in your bank account after all deductions.',
        },
        {
          question: 'Which is best?',
          answer: 'Payslip mode is the most accurate. Bank-account mode gives a good estimate if you don\'t have your payslip.',
        },
      ],
    },

    // Step 1 — PRD §8
    amount: {
      periodWord: { MONTHLY: 'month', WEEKLY: 'week', FORTNIGHTLY: 'two weeks' },
      questions: {
        TAKE_HOME: {
          MONTHLY: 'How much money do you receive in your bank account every month?',
          WEEKLY: 'How much money do you receive in your bank account every week?',
          FORTNIGHTLY: 'How much money do you receive in your bank account every two weeks?',
        },
        GROSS: {
          MONTHLY: 'What is your gross monthly salary, before anything is deducted?',
          WEEKLY: 'What is your gross weekly pay, before anything is deducted?',
          FORTNIGHTLY: 'What is your gross pay for every two weeks, before anything is deducted?',
        },
        PAYSLIP: {
          MONTHLY: 'What is your gross monthly salary?',
          WEEKLY: 'What is your gross weekly pay?',
          FORTNIGHTLY: 'What is your gross pay for every two weeks?',
        },
      },
      fieldLabel: {
        TAKE_HOME: (period: string) => `Bank deposit per ${period}`,
        GROSS: (period: string) => `Gross pay per ${period}`,
        PAYSLIP: (period: string) => `Gross pay per ${period}`,
      },
      hint: {
        TAKE_HOME: 'Enter a normal pay day, without any bonus. Rand.',
        GROSS: 'Before tax, UIF, pension or medical aid come off. Rand.',
        PAYSLIP: 'Before tax, UIF, pension or medical aid come off. Rand.',
      },
      required: 'Enter an amount to continue.',
      negative: "Amounts can't be negative. Check the figure and try again.",
      zero: "If you receive no income, you likely owe no PAYE, but let's double-check a few things.",
      tooHigh: 'That seems very high. Please double-check.',
      tooHighConfirm: 'Yes, that amount is right',
      monthlyEquivalent: (amount: string) => `That's about ${amount} a month.`,
      frequencyLegend: 'Are you paid monthly, weekly, or every two weeks?',
      frequencyOptions: [
        { value: 'MONTHLY', label: 'Monthly' },
        { value: 'WEEKLY', label: 'Weekly' },
        { value: 'FORTNIGHTLY', label: 'Every two weeks' },
      ] as const,
      unsureToggle: "I'm not sure of the exact amount",
      unsureSlider: 'Roughly how much? Drag to the nearest amount, then fine-tune it above.',
      faq: {
        TAKE_HOME: [
          {
            question: 'Do I include my bonus?',
            answer: "Not here. We'll ask about bonuses separately. Enter only your regular monthly deposit.",
          },
          {
            question: 'What if my amount changes every month?',
            answer: 'Enter your most typical month. Overtime and commission can be added later.',
          },
          {
            question: 'My deposit includes expenses repaid',
            answer: 'Only count money you actually keep. If your employer repays work expenses into the same account, subtract those.',
          },
        ],
        GROSS: [
          {
            question: 'Where do I find my gross salary?',
            answer: 'Look for "Gross salary", "Basic salary" or "Total earnings" on your payslip, or on your offer letter or contract.',
          },
          {
            question: 'Do I include my bonus?',
            answer: "Not here. We'll ask about bonuses separately. Enter only your regular pay.",
          },
          {
            question: 'What if my pay changes every month?',
            answer: 'Enter your most typical month. Overtime and commission can be added later.',
          },
        ],
        PAYSLIP: [
          {
            question: 'Where do I find my gross salary?',
            answer: 'Look for "Gross salary", "Basic salary" or "Total earnings" on your latest payslip.',
          },
          {
            question: 'Do I include my bonus?',
            answer: "Not here. We'll ask about bonuses separately. Enter only your regular pay.",
          },
          {
            question: 'What if my pay changes every month?',
            answer: 'Enter your most typical month. February is usually the cleanest, with no bonus.',
          },
        ],
        frequency: {
          question: 'Why do you ask how often I\'m paid?',
          answer: "Weekly and every-two-weeks pay is turned into a monthly amount so the same SARS rules apply to everyone. You'll always see it shown both ways.",
        },
      },
    },

    // Step 2 — PRD §8
    age: {
      question: 'How old are you?',
      sub: 'Your age affects the tax breaks SARS gives you.',
      legend: DEFAULT_YEAR.ageLegend,
      options: [
        { value: 'UNDER_65', label: 'Younger than 65' },
        { value: 'AGE_65_74', label: '65 to 74' },
        { value: 'AGE_75_PLUS', label: '75 or older' },
      ] as const,
      note: (secondary: string, tertiary: string) =>
        `Taxpayers 65+ get an extra rebate of ${secondary} a year, and 75+ get ${tertiary} more.`,
      faq: [
        {
          question: 'Why does age matter?',
          answer: 'SARS gives extra tax rebates at 65 and 75, and a higher tax-free threshold, so older workers pay less tax on the same salary.',
        },
        {
          question: 'What if I turn 65 during the tax year?',
          answer: DEFAULT_YEAR.ageFaqAnswer,
        },
      ],
    },

    // Step 3 — PRD §8
    retirement: {
      question: 'Does money go towards a pension fund, provident fund or retirement annuity?',
      sub: 'These are savings for when you stop working. They also lower your tax.',
      yes: { title: 'Yes', description: 'I or my employer pay into one or more of these.' },
      no: { title: 'No, none of these', description: "That's fine. You can skip to the next question." },
      payslipLabel: 'Taken off your payslip each month',
      payslipHint: 'Your own pension or provident fund contribution. Rand per month.',
      raLabel: 'Paid by you from your bank account each month',
      raHint: "A retirement annuity (RA) you set up yourself, usually by debit order. Rand per month.",
      employerToggle: 'My employer also contributes',
      employerLabel: 'Your employer pays in each month',
      employerHint: 'Rand per month.',
      negative: "Amounts can't be negative.",
      needAmount: 'Enter at least one amount to continue, or choose No above.',
      percent: (pct: string, estimated: boolean) =>
        estimated ? `That's about ${pct} of your estimated salary.` : `That's about ${pct} of your salary.`,
      carryForward: (amount: string, rate: string, cap: string) =>
        `About ${amount} a year of these contributions is above this year's limit (${rate} of your income, up to ${cap}). It isn't lost: SARS carries it forward to future years.`,
      tooMuch: 'These contributions are more than your salary, so please double-check the amounts.',
      debitNote: "Because this one isn't taken off your payslip, your employer's tax deduction won't show the saving. You get it back when you file.",
      faq: [
        {
          question: "What's the difference between pension, provident and RA?",
          answer:
            "They're different savings products with the same tax deduction. Pension and provident funds usually come from your employer; a retirement annuity (RA) is one you set up yourself.",
        },
        {
          question: RETIREMENT_LIMIT_QUESTION,
          // The year's figures are filled in from the rule set (ruleCopy.retirementLimitFaq).
          answer: 'Up to a share of your income, capped each year. Anything above the cap carries forward to future years.',
        },
        {
          question: 'Is it worth contributing more?',
          answer: "Every extra rand you contribute within the limit saves tax at your highest tax rate. You'll see exactly how much in your recommendations.",
        },
        {
          question: 'Why do you ask where the money comes from?',
          answer:
            "Contributions taken off your payslip lower the tax your employer deducts each month. Money you pay yourself from your bank account, like most retirement annuities, isn't visible to your employer, so you get that saving back when you file.",
        },
      ],
    },

    // Step 4 — PRD §8
    medical: {
      question: 'Do you belong to a medical aid?',
      sub: 'A registered medical scheme gives you a tax credit every month.',
      yes: { title: 'Yes', description: 'I am the main member of a medical scheme.' },
      no: { title: 'No', description: "That's fine. You can skip to the next question." },
      membersLabel: 'Including you, how many people are on the plan?',
      membersMore: 'One more person',
      membersFewer: 'One fewer person',
      totalLabel: 'What do you pay per month in total?',
      totalHint: 'Everything paid to the scheme, by you and your employer. R0 is fine if your employer pays it all.',
      paidByLegend: 'Who pays it?',
      paidByOptions: [
        { value: 'SELF', label: 'I pay it' },
        { value: 'EMPLOYER', label: 'My employer pays it all' },
        { value: 'SHARED', label: 'We share it' },
      ] as const,
      employerShareLabel: 'How much of that does your employer pay each month?',
      employerShareHint: 'Rand per month.',
      shareTooHigh: "The employer's share can't be more than the total.",
      viaLegend: 'How is your share paid?',
      viaOptions: [
        { value: 'PAYROLL', label: 'Off my payslip' },
        { value: 'DEBIT_ORDER', label: 'By debit order' },
      ] as const,
      outOfPocketLabel: "Medical costs your scheme didn't cover this year",
      outOfPocketHint:
        "Doctors, dentists, medicines and hospital costs you paid yourself. Leave blank if you're not sure; we'll check for an extra tax credit if you fill it in.",
      negative: "Amounts can't be negative.",
      required: 'Enter an amount to continue. R0 is fine.',
      employerPaysNote: (credit: string) =>
        `Your employer's contribution counts as a small taxable benefit, but you still get your medical credit of ${credit} a month. It roughly cancels out.`,
      debitNote: "Because you pay this yourself, your employer's tax deduction usually doesn't include your medical credit. You get it back when you file.",
      /** The credit amounts come from the rule set, so the answer is built where they're known. */
      creditFaq: {
        question: 'How does the tax credit work?',
        answer: (main: string, first: string, extra: string) =>
          `SARS gives ${main} a month for you, ${first} for your first dependant and ${extra} for each additional dependant, taken straight off your tax bill.`,
      },
      faq: [
        {
          question: 'What counts as a dependant?',
          answer: 'Anyone registered on your medical aid: your spouse, children, parents you support, or anyone your scheme recognises.',
        },
        {
          question: 'My employer pays my medical aid. Do I still get the credit?',
          answer: "Yes. You'll see it already applied on your payslip as lower PAYE, or claim it when you file.",
        },
        {
          question: 'Why do you ask how my share is paid?',
          answer:
            "If it comes off your payslip, your employer applies your medical credit every month. If you pay by debit order, your employer usually can't, so you get the credit back when you file.",
        },
      ],
    },

    // Step 5 — PRD §8
    variable: {
      question: 'Besides your regular salary, do you earn any of these?',
      sub: 'Pick all that apply. We ask about the whole tax year.',
      legend: 'Other pay you earn',
      options: [
        { value: 'BONUS', label: 'Bonus or 13th cheque' },
        { value: 'OVERTIME', label: 'Overtime' },
        { value: 'COMMISSION', label: 'Commission' },
        { value: 'NONE', label: 'None of these' },
      ] as const,
      amountLabel: {
        BONUS: 'Bonus or 13th cheque, per year',
        OVERTIME: 'Overtime, per year',
        COMMISSION: 'Commission, per year',
      },
      amountHint: 'Roughly how much per year, before tax? A guess is fine.',
      negative: "Amounts can't be negative.",
      required: 'Enter a rough amount, or untick this one.',
      highNote: "That's a lot of your income from extras, so our estimate will be rougher.",
      faq: [
        {
          question: 'Why is my bonus taxed so heavily?',
          answer:
            "A bonus is added to your income in one month. Payroll works out its share of your annual tax. If it pushes you into a higher bracket, that part is taxed higher.",
        },
        {
          question: 'Is commission taxed differently?',
          answer: "It's taxed like salary. If commission is more than half your pay, extra deductions may apply when you file.",
        },
      ],
    },

    // Step 6 — PRD §8 (optional extras)
    extras: {
      question: 'Anything else that could change your tax?',
      sub: 'All of this is optional. If none of it applies to you, just skip.',
      toggle: 'Optional extras',
      filled: (n: number) => (n === 1 ? '1 filled' : `${n} filled`),
      none: 'Nothing added yet',
      moneyHeading: 'Donations and interest',
      donationsLabel: 'Donations to registered charities (Section 18A) this year',
      donationsHint: 'Only gifts to approved charities count. Rand for the whole year.',
      receipt: 'I have a valid 18A receipt',
      receiptNote: "Without an 18A receipt, SARS won't allow the deduction, so this result is only an estimate. Keep your receipts safe.",
      interestLabel: 'Interest from South African bank accounts or fixed deposits this year',
      interestHint: 'Rand for the whole year. Include savings and fixed deposits, not dividends.',
      travelHeading: 'Travel allowance',
      travelLabel: 'Travel allowance paid with your salary, per month',
      travelHint: 'A fixed amount your employer pays you for using your own car for work. Rand per month.',
      travelUseLegend: 'How much of your driving is for work?',
      travelUseOptions: [
        { value: 'LOW', label: 'Less than 80%' },
        { value: 'HIGH', label: '80% or more' },
      ] as const,
      travelKmLabel: 'Business kilometres you drove this year',
      travelKmHint: "For a rough idea of what a logbook could save you. Leave blank if you don't know.",
      travelNote: "Keep a logbook of your business trips. Without one, SARS can't allow a deduction for them.",
      secondHeading: 'More than one job',
      secondToggle: 'I had more than one employer this tax year',
      secondLabel: 'Gross pay from the other job this year',
      secondHint: "Leave blank if you're not sure. We'll still explain what it means.",
      medicalHeading: 'Medical aid',
      monthsLabel: 'Months on your medical aid this tax year',
      monthsHint: 'Only change this if you joined or left part-way through the year.',
      monthsMore: 'One more month',
      monthsFewer: 'One fewer month',
      disability: 'You, your spouse or a child has a disability',
      disabilityHint: 'This changes how the extra medical credit is worked out.',
      negative: "Amounts can't be negative.",
      faq: [
        {
          question: 'What is a Section 18A receipt?',
          answer: "A tax certificate a registered charity gives you. Without it, SARS won't allow the deduction, so keep it safe.",
        },
        {
          question: 'Why ask about interest?',
          answer: (underExemption: string, overExemption: string) =>
            `The first ${underExemption} of local interest is tax-free (${overExemption} if you're 65+). Above that, it's taxed like salary.`,
        },
        {
          question: "I have two jobs. Why does it matter?",
          answer:
            'Each employer taxes you separately. Combined, you can end up in a higher bracket and owe SARS when you file. A tax directive can fix the monthly deduction.',
        },
      ],
    },

    // Step 7 — PRD §8 (payslip check, gross and payslip modes only)
    payslip: {
      question: "Let's check your payslip. How much PAYE (income tax) and UIF were deducted?",
      sub: 'Use your latest payslip, one pay period.',
      payeLabel: 'PAYE (income tax) deducted',
      payeHintRequired: 'Look for "PAYE" or "Tax" in the deductions column. R0 is fine.',
      payeHintOptional: 'Look for "PAYE" or "Tax" in the deductions column. Fill this in to compare with our calculation.',
      payeRequired: 'Enter the PAYE from your payslip to continue. R0 is fine.',
      uifLabel: 'UIF deducted',
      uifHint: (assumed: string) =>
        `Look for "UIF" in the deductions column. Leave blank and we'll assume ${assumed} (1% of your pay). Please check your payslip.`,
      uifTooHigh: DEFAULT_YEAR.uifTooHigh,
      payeTooHigh: 'The PAYE you entered is more than your gross salary. Check the figure on your payslip. You can still continue.',
      negative: "Amounts can't be negative.",
      faq: [
        {
          question: "Where do I find these on my payslip?",
          answer: 'Look for "PAYE" or "Tax" and "UIF" in the deductions column of your latest payslip.',
        },
        {
          question: 'What if my PAYE changes every month?',
          answer: "Enter a typical month. February's is usually the cleanest (no bonus).",
        },
      ],
    },

    // Step 8 — PRD §8 (review)
    review: {
      question: 'Check your answers',
      sub: 'Take a quick look. Tap Edit on anything you want to change.',
      edit: 'Edit',
      change: 'Change',
      editLabel: (topic: string) => `Edit ${topic}`,
      smallPrint: DEFAULT_YEAR.smallPrint,
      groups: {
        income: 'Your income',
        retirement: 'Your retirement savings',
        medical: 'Your medical aid',
        variable: 'Bonus, overtime and commission',
        extras: 'Optional extras',
        payslip: 'Your payslip',
      },
      rows: {
        taxYear: 'Tax year',
        startedFrom: 'Starting point',
        amount: {
          TAKE_HOME: (period: string) => `Bank deposit per ${period}`,
          GROSS: (period: string) => `Gross pay per ${period}`,
          PAYSLIP: (period: string) => `Gross pay per ${period}`,
        },
        monthlyEquivalent: 'About a month',
        paid: 'Paid',
        age: 'Age group',
        none: 'None',
        no: 'No',
        contributions: 'Contributions',
        medicalAid: 'Medical aid',
        otherPay: 'Other pay',
        notEntered: 'Not entered',
        payslipRetirement: 'Off your payslip, per month',
        raRetirement: 'Retirement annuity by debit order, per month',
        employerRetirement: 'Your employer pays in, per month',
        percentOfSalary: 'Your own share of your salary',
        members: 'People on the plan',
        medicalTotal: 'Total per month',
        medicalPaidBy: { SELF: 'You pay it', EMPLOYER: 'Your employer pays it all', SHARED: 'You share it' },
        employerShare: "Your employer's share, per month",
        ownSharePaid: { PAYROLL: 'Off your payslip', DEBIT_ORDER: 'By debit order' },
        outOfPocket: "Costs your scheme didn't cover",
        months: 'Months on the scheme',
        disability: 'Disability in the family',
        yes: 'Yes',
        types: { BONUS: 'Bonus or 13th cheque, per year', OVERTIME: 'Overtime, per year', COMMISSION: 'Commission, per year' },
        donations: 'Donations, per year',
        receipt: '18A receipt',
        haveReceipt: 'I have one',
        noReceipt: "I don't have one yet",
        interest: 'Interest, per year',
        travel: 'Travel allowance, per month',
        businessUse: 'Driving for work',
        businessUseValues: { LOW: 'Less than 80%', HIGH: '80% or more' },
        km: 'Business kilometres',
        second: 'Other employer, per year',
        secondUnknown: "I'll check the amount later",
        payslipPaye: 'PAYE on your payslip',
        payslipUif: 'UIF on your payslip',
        uifAssumed: (amount: string) => `Not entered, so we assume ${amount}`,
      },
      faq: [
        {
          question: 'Can I change my answers after I see the result?',
          answer: 'Yes. Use "Adjust my answers" on the result page and everything you entered will still be there.',
        },
        {
          question: 'Is my information saved anywhere?',
          answer: 'No. Everything stays in your browser and disappears when you close or refresh the page. Nothing is sent to us. The only thing your browser remembers is a "yes", if you turn on the assistant.',
        },
      ],
    },
  },

  results: {
    title: 'Your estimated result',
    taxYearLine: DEFAULT_YEAR.taxYearLine,
    payslipLead: 'Your employer deducted',
    payslipMid: DEFAULT_YEAR.payslipMid,
    refund: (amount: string) => `About ${amount} should come back to you when you file, because your payslip tax doesn't include everything that lowers your tax.`,
    owed: (amount: string) => `You could owe SARS about ${amount} when you file, because your payslip tax doesn't include all your income.`,
    payeLead: 'Your estimated monthly PAYE is',
    takeHomeLead: ', and your take-home salary is',
    estimatedGross: (amount: string) => `We estimate your gross salary at ${amount} a month. Your payslip will show the exact figure.`,
    perPeriod: (amount: string, period: string) => `That's ${amount} take-home per ${period}.`,
    tiles: { takeHome: 'Take-home, a normal month', paye: 'PAYE, a normal month', annual: 'Tax for the year' },
    disclaimer: 'Estimates only. Not tax advice, not a SARS assessment.',
    startOver: 'Start over',
    adjust: 'Adjust my answers',

    // The notices under the headline: engine warnings, one line each.
    warningsHeading: 'Please check',
    warnings: {
      DEDUCTIONS_EXCEED_GROSS: 'Your deductions add up to more than your pay. Please check the amounts you entered.',
      VARIABLE_PAY_HIGH: 'Your bonus, overtime and commission are very large compared with your salary, so this estimate is rougher than usual.',
      PAYSLIP_UIF_ABOVE_MAX: 'The UIF on your payslip is above the legal monthly maximum. Please check it.',
      PAYSLIP_PAYE_ABOVE_GROSS: 'The PAYE you entered is more than your gross salary. Please check it.',
    },

    // How the table works, then every row's label and hover/tap explanation.
    breakdown: {
      payslipHeading: 'From your salary to your bank account',
      payslipSub: 'Each line adds to or comes off your pay. The last line is what lands in your bank account.',
      payslipCaption: 'Pay, deductions, tax and take-home, for a normal month and for the whole year',
      colLabel: 'Line',
      colMonth: 'A normal month',
      colYear: 'Whole year',
      colYearOnly: 'For the year',
      yearNote: 'A normal month leaves out any bonus, overtime or commission. The whole-year column includes them, after their tax.',
      offPayslipHeading: 'Paid by debit order, not off your payslip',
      offPayslipSub: 'These come out of your bank account on their own, so they are not in the take-home above.',
      taxHeading: 'How your taxable income is worked out',
      taxSub: 'SARS taxes your income for the whole year. These figures are for the year.',
      taxCaption: 'Income, deductions and the taxable income that results, for the year',
      bracketsHeading: 'Your tax, bracket by bracket',
      bracketsSub: 'Each slice of your taxable income is taxed at its own rate. Only the top slice is taxed at your highest rate.',
      bracketsCaption: DEFAULT_YEAR.bracketsCaption,
      afterHeading: 'From tax on your income to the tax you owe',
      afterSub: 'Rebates and credits come off your tax, not off your income.',
      afterCaption: 'Tax before rebates, rebates, credits and your tax for the year',
      filingHeading: 'Your employer’s tax compared with your final tax',
      filingSub: 'Your employer takes tax off each month. When you file, SARS works out the final amount and settles the difference.',
      filingCaption: 'Your tax for the year, the PAYE already taken off, and what is left to pay or claim',
      minus: 'minus',
      plus: 'plus',
      none: 'No amount for a single month',
      rows: {
        GROSS: { label: 'Gross salary', hint: 'Your pay before anything comes off.' },
        EXTRAS: { label: 'Bonus, overtime and commission', hint: 'Not paid every month, so it is left out of a normal month. It is in the whole-year column.' },
        TRAVEL: { label: 'Travel allowance', hint: 'A fixed amount your employer pays you for travel. You receive all of it, but only part of it is taxed.' },
        RETIREMENT_OWN: { label: 'Retirement contributions (yours)', hint: 'Money taken off your payslip for your pension or provident fund.' },
        MEDICAL_OWN: { label: 'Medical aid (your share)', hint: 'Your share of the scheme fee, taken off your payslip.' },
        PAYE: { label: 'PAYE (income tax)', hint: 'Pay As You Earn: the income tax your employer deducts and pays to SARS for you.' },
        UIF: { label: 'UIF', hint: '1% of your pay, up to a maximum each month. Your employer pays the same amount on top.' },
        TAKE_HOME: { label: 'Take-home pay', hint: 'The money that lands in your bank account.' },
        MEDICAL_DEBIT_ORDER: { label: 'Medical aid (your share)', hint: 'You pay the scheme yourself, so payroll does not see it. You claim the tax credit when you file.' },
        RA_DEBIT_ORDER: { label: 'Retirement annuity', hint: 'You pay this yourself, so payroll does not see it. You claim the tax saving when you file.' },
        INCOME_GROSS: { label: 'Gross salary', hint: 'Your pay for the year before anything comes off.' },
        INCOME_EXTRAS: { label: 'Bonus, overtime and commission', hint: 'Extra pay is added to your income for the year.' },
        INCOME_TRAVEL: { label: 'Taxable part of your travel allowance', hint: 'Only part of a travel allowance is taxed: most of it normally, much less if you drive mostly for work.' },
        INCOME_EMPLOYER: { label: 'Your employer’s pension and medical aid payments', hint: 'What your employer pays towards these counts as part of your income for tax, even though you never see it.' },
        INCOME_OTHER_JOB: { label: 'Pay from another employer', hint: 'Income from your other job this tax year.' },
        INCOME_INTEREST: { label: 'Interest above the tax-free amount', hint: 'The first part of your bank interest is tax-free. Only the rest is added to your income.' },
        RETIREMENT_DEDUCTION: { label: 'Retirement deduction', hint: 'What you and your employer put into retirement savings, up to the limit, comes off your income before tax.' },
        DONATIONS_DEDUCTION: { label: 'Donations (section 18A)', hint: 'Gifts to approved charities come off your income, up to 10% of it.' },
        TAXABLE_INCOME: { label: 'Taxable income', hint: 'The part of your income SARS actually taxes, after allowed deductions.' },
        TAX_BEFORE_REBATES: { label: 'Tax before rebates', hint: 'The tax on your taxable income, using the bracket table above.' },
        REBATE_PRIMARY: { label: 'Primary rebate', hint: 'A fixed amount SARS takes off your tax bill. Everyone gets it.' },
        REBATE_SECONDARY: { label: 'Age rebate (65 and over)', hint: 'An extra amount off your tax bill once you turn 65.' },
        REBATE_TERTIARY: { label: 'Age rebate (75 and over)', hint: 'A further amount off your tax bill once you turn 75.' },
        REBATE_UNUSED: { label: 'Rebates you did not need', hint: 'Your rebates are bigger than your tax, and tax cannot go below R0, so the unused part is added back.' },
        TAX_AFTER_REBATES: { label: 'Tax after rebates', hint: 'Your tax once the rebates have come off.' },
        CREDIT_6A: { label: 'Medical aid credit (section 6A)', hint: 'A fixed amount SARS takes off your tax for being on a medical aid.' },
        CREDIT_6B: { label: 'Extra medical costs credit (section 6B)', hint: 'A credit for medical costs your scheme did not cover, once they pass a set level.' },
        TAX_FOR_YEAR: { label: 'Your tax for the year', hint: DEFAULT_YEAR.taxForYearHint },
        FILING_TAX: { label: 'Your tax for the year', hint: DEFAULT_YEAR.taxForYearHint },
        FILING_WITHHELD: { label: 'PAYE your employer takes off', hint: 'The tax your employer deducts from your pay over the year and pays to SARS.' },
        FILING_OTHER_EMPLOYER: { label: 'PAYE from your other employer (estimated)', hint: 'Estimated as if that job were your only income.' },
      },
      balance: {
        refund: { label: 'Refund when you file', hint: 'You paid more tax through your payslip than your final tax. SARS pays the difference back.' },
        owed: { label: 'You owe when you file', hint: 'Your payslip tax is less than your final tax. You pay the difference to SARS.' },
        even: { label: 'Nothing to pay or claim', hint: 'Your payslip tax matches your final tax.' },
      },
      unusedCredit: (amount: string) => `Part of your medical aid credit (${amount}) could not be used because it would take your tax below R0. It is not paid out.`,
    },

    // The bracket walk table.
    walk: {
      cols: { range: 'Taxable income', rate: 'Rate', yours: 'Your income in it', tax: 'Tax on it', running: 'Running total' },
      topBracket: 'Your top bracket',
      andAbove: 'and above',
      totalLabel: 'Tax before rebates',
    },

    // Payslip comparison (PRD 14.4): neutral, never alarming.
    comparison: {
      heading: 'Your payslip compared with our calculation',
      sub: 'Both figures are for a normal month.',
      payslip: 'PAYE on your payslip',
      calc: 'PAYE from our calculation',
      difference: 'Difference',
      uifPayslip: 'UIF on your payslip',
      uifCalc: 'UIF from our calculation',
      uifAssumed: 'You did not enter UIF, so we assumed the calculated amount.',
      match: 'These match, to within R1.',
      higher: (amount: string, pct: string | null) => `Your payslip PAYE is ${amount}${pct ? ` (${pct})` : ''} higher than our calculation.`,
      lower: (amount: string, pct: string | null) => `Your payslip PAYE is ${amount}${pct ? ` (${pct})` : ''} lower than our calculation.`,
      explainHeading: 'What a difference can mean',
      explain: 'A difference doesn’t automatically mean your employer made a mistake, and it doesn’t guarantee a SARS refund. Common reasons: your employer uses a different SARS-allowed payroll method, the month you checked included a bonus or back-pay, you have other income, or your payroll applied credits differently. If you’re unsure, compare a February payslip (no bonus) or ask your payroll team.',
    },

    // "How your answers shaped your tax" (PRD 14.5): one card per answer that changed the result.
    // Every figure is passed in already formatted from the engine; nothing is worked out here.
    explainHeading: 'How your answers shaped your tax',
    explainSub: 'Each card is something you told us that changed your result, and what it was worth.',
    effectLabel: 'Saves you',
    perYear: 'a year',
    explain: {
      RETIREMENT: {
        title: 'Your retirement savings',
        body: (x: { contributed: string; savingMonthly: string; savingAnnual: string; rate: string | null; saves: boolean; cap: string }) =>
          x.saves
            ? `You put ${x.contributed} a month into a pension, provident fund or retirement annuity. That comes off your taxable income, which saves you about ${x.savingMonthly} a month (${x.savingAnnual} a year) in tax${x.rate ? `, at your ${x.rate} top rate` : ''}. SARS lets you deduct up to 27.5% of your pay, to a maximum of ${x.cap} a year.`
            : `You put ${x.contributed} a month into a pension, provident fund or retirement annuity. That comes off your taxable income, but you pay no tax at the moment, so it does not save you anything yet.`,
        carry: (amount: string) => `You are over the yearly limit by ${amount}. It isn't lost: it carries forward to later years.`,
      },
      MEDICAL_CREDIT: {
        title: 'Your medical aid credit',
        body: (x: { monthly: string; main: string; first: string; extra: string; members: number }) =>
          `Your medical aid gives you a tax credit of ${x.monthly} a month: ${x.main} for you${
            x.members === 2 ? ` and ${x.first} for your dependant` : x.members > 2 ? `, ${x.first} for your first dependant and ${x.extra} for each extra person` : ''
          }. It comes straight off your tax, not off your income.`,
        unused: (amount: string) => `${amount} of it could not be used this year because your tax is not big enough. It is not paid out.`,
        filing: 'You pay your medical aid yourself, so payroll does not apply the credit. You claim it when you file.',
      },
      AGE_REBATE: {
        title: 'Your age rebate',
        body: (x: { secondary: string; tertiary: string | null; saving: string }) =>
          `Because you are 65 or older, SARS takes an extra ${x.secondary} off your tax this year${x.tertiary ? `, and another ${x.tertiary} because you are 75 or older` : ''}. That saves you ${x.saving} in tax.`,
      },
      DONATIONS: {
        title: 'Your donations',
        body: (x: { given: string; saving: string }) =>
          `Your ${x.given} donation to a registered charity came off your taxable income, saving you about ${x.saving} in tax.`,
        carry: (amount: string) => `The part above the 10% limit (${amount}) carries forward to next year.`,
        receipt: 'Keep your section 18A receipt. You need it to claim.',
      },
      VARIABLE_PAY: {
        title: 'Your bonus, overtime and commission',
        body: (x: { total: string; tax: string; share: string; rate: string | null }) =>
          `Your extra pay adds up to ${x.total} for the year. About ${x.tax} of it (${x.share}) goes in tax${
            x.rate ? `, because it is added on top of your salary and taxed at your top rate of ${x.rate}` : ''
          }. That is why the tax looks so big in the month it is paid.`,
      },
      UIF: {
        title: 'UIF',
        body: (x: { max: string; monthly: string; annual: string }) =>
          `You pay 1% of your pay to UIF, up to ${x.max} a month. Yours is ${x.monthly} a month (${x.annual} a year), and your employer adds the same amount on top. It never comes back on your payslip, but it insures you if you lose your job.`,
      },
      TRAVEL: {
        title: 'Your travel allowance',
        body: (x: { allowance: string; share: string; taxable: string }) =>
          `Your travel allowance is ${x.allowance} a year. SARS taxes ${x.share} of it (${x.taxable}).`,
        logbook: (amount: string) =>
          `With a logbook of your business trips you may be able to claim up to about ${amount} when you file. That is an estimate and is not in the numbers above.`,
      },
      INTEREST: {
        title: 'Your bank interest',
        body: (x: { interest: string; exemption: string; taxable: string; none: boolean }) =>
          `You earned ${x.interest} in interest from South African banks. The first ${x.exemption} is tax-free${
            x.none ? ', so none of it is taxed.' : `, so ${x.taxable} is added to your income.`
          }`,
      },
      MEDICAL_6B: {
        title: 'Your extra medical costs',
        body: (x: { costs: string; credit: string }) =>
          `Medical costs your scheme did not cover (${x.costs}) earn you an extra credit of ${x.credit}, taken off your tax when you file.`,
      },
    },

    // "Ways to keep more of your pay" (PRD 14.6)
    adviceHeading: 'Ways to keep more of your pay',
    adviceSub: 'Ideas that fit what you told us. A rand figure appears only when we can work it out from your answers.',
    adviceDisclaimer: 'These are general education suggestions based on the information you provided. They are not personalised financial advice.',
    confidence: { CALCULATED: 'Worked out for you', ESTIMATED: 'Estimate', INFORMATIONAL: 'Good to know' },
    advice: {
      R1: {
        title: 'Room to save more for retirement',
        body: (x: { room: string; extra: string; monthly: string; annual: string }) =>
          `You could still put in about ${x.room} a year and get the tax deduction. As an example, ${x.extra} more a month would cut your tax by about ${x.monthly} a month (${x.annual} a year).`,
      },
      R2: {
        title: 'Start saving for retirement',
        body: (x: { extra: string; monthly: string; annual: string; room: string }) =>
          `Putting money into a pension, provident fund or retirement annuity is the biggest legal way for most salaried people to lower their tax. For example, ${x.extra} a month would cut your tax by about ${x.monthly} a month (${x.annual} a year). You can put in about ${x.room} a year in total and still get the deduction.`,
      },
      R3: {
        title: 'Check your full medical credit is applied',
        body: (x: { credit: string; filing: boolean }) =>
          `Your medical credit is ${x.credit} a month. Make sure your payroll applies all of it. ${x.filing ? 'You pay the scheme yourself, so claim it when you file.' : 'If you pay the scheme yourself, claim it when you file.'}`,
      },
      R4: {
        title: 'A medical aid also lowers your tax',
        body: (x: { credit: string; usable: string | null }) =>
          `A medical aid is not only about tax, but if you join you would get a credit of ${x.credit} a month off your tax${
            x.usable ? `. At your income you could use about ${x.usable} a month of it` : ''
          }.`,
      },
      R5: {
        title: 'Donations lower your tax',
        body: (x: { rate: string; example: string; saving: string }) =>
          `Gifts to charities registered under section 18A come off your income, up to ${x.rate} of it. As an example, ${x.example} given would save you about ${x.saving} in tax. Keep the section 18A receipt.`,
      },
      R6: {
        title: 'Interest and tax-free savings',
        body: (x: { exempt: string; exempt65: string; annual: string; lifetime: string }) =>
          `The first ${x.exempt} of local interest is tax-free (${x.exempt65} if you are 65 or older), and you are close to or over that. A tax-free savings account takes up to ${x.annual} a year and ${x.lifetime} in your lifetime, and you never pay tax on its growth.`,
      },
      R7: {
        title: 'Tax-free savings accounts',
        body: (x: { annual: string; lifetime: string }) =>
          `A tax-free savings account does not lower your PAYE, but its growth is never taxed. You may have up to ${x.annual} a year of room (${x.lifetime} in your lifetime).`,
      },
      R8: {
        title: 'You may get an extra medical credit',
        body: () =>
          'Medical costs your scheme does not cover may earn an extra credit when you file. Add them on the medical aid question to see what it could be worth.',
      },
      R9: {
        title: 'You are in a top tax bracket',
        body: (x: { cents: number }) => `Each extra rand you put into retirement savings saves you ${x.cents} cents in tax.`,
      },
    },

    // Assumptions the calculation made (engine notes).
    notesHeading: 'How we got these numbers',
    notes: {
      ESTIMATED_FROM_TAKE_HOME: 'We worked backwards from your take-home pay to estimate your gross salary. Your payslip will show the exact figure.',
      VARIABLE_PAY_BALANCE_METHOD: 'Tax on your bonus, overtime or commission uses one SARS-allowed method. Your payroll may use another, so the tax in the month you are paid can differ.',
      UIF_ON_AVERAGED_VARIABLE_PAY: 'UIF on your extras is averaged over the year here. Payroll works it out in the month you are paid.',
      MEDICAL_CREDIT_CLAIMED_ON_FILING: 'Your medical aid is paid by debit order, so payroll does not apply the medical credit. You claim it when you file.',
      PRIVATE_RA_CLAIMED_ON_FILING: 'Your retirement annuity is paid by debit order, so payroll does not see it. You claim the saving when you file.',
      MEDICAL_6B_INCLUDES_EMPLOYER_CONTRIBUTIONS: 'The extra medical costs credit uses the full scheme fee, including your employer’s share.',
      SECOND_EMPLOYER_PAYE_ESTIMATED: 'Tax already deducted by your other employer is estimated as if that job were your only income.',
      PAYSLIP_UIF_ASSUMED: 'You did not enter the UIF from your payslip, so we assumed the calculated amount.',
    },

    // What this calculator leaves out (engine flags), each with a SARS link.
    flagsHeading: 'What this does not include',
    flagsSub: 'These can change your tax. Each one links to the official SARS page.',
    flagLink: (title: string) => `Read more: ${title}`,
    flags: {
      OTHER_INCOME_NOT_INCLUDED: { title: 'Other income', body: 'Freelance, rental, crypto or any other income is not in these numbers. It can change your tax and may mean provisional tax.' },
      CAPITAL_GAINS_NOT_INCLUDED: { title: 'Capital gains', body: 'Profit from selling shares, property or crypto is taxed separately and is not counted here.' },
      FOREIGN_INCOME_OR_RESIDENCY: { title: 'Foreign income and residency', body: 'This calculator assumes you are a South African tax resident with South African income only.' },
      FRINGE_BENEFITS_NOT_MODELLED: { title: 'Other work perks', body: 'Benefits such as a company car or a cheap loan can add to your taxable income. Only your employer’s pension and medical aid payments are included here.' },
      HOME_OFFICE_NOT_MODELLED: { title: 'Home office expenses', body: 'Home office costs are not included. Strict rules decide who can claim them.' },
      SDL_COIDA_EMPLOYER_ONLY: { title: 'Employer-only levies', body: 'The skills development levy and COIDA are paid by your employer. They do not come off your pay and are not in these numbers.' },
      RETIREMENT_LUMP_SUMS_NOT_CALCULATED: { title: 'Retirement lump sums', body: 'Withdrawals or lump sums from a retirement fund, including two-pot withdrawals, are taxed differently and are not calculated here.' },
      COMMISSION_EARNER_DEDUCTIONS: { title: 'Commission earners', body: 'If most of your pay is commission, you may be able to claim work expenses when you file. We do not calculate those.' },
      DONATIONS_TAX_LARGE_GIFTS: { title: 'Donations tax on large gifts', body: 'Large gifts to people or organisations that are not approved charities can attract donations tax.' },
      DONATION_RECEIPT_NEEDED: { title: 'Keep your section 18A receipt', body: 'You only get the donation deduction if the charity gives you a section 18A receipt.' },
      MULTIPLE_EMPLOYERS: { title: 'More than one employer', body: 'Each employer takes off tax as if it were your only job, so you may owe SARS when you file.' },
      BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE: { title: 'Below the tax threshold', body: 'Your taxable income is below the level where tax starts. You may not need to file a return. Check the SARS rules for your situation.' },
      TRAVEL_LOGBOOK_REQUIRED: { title: 'Travel allowance needs a logbook', body: 'To claim your business kilometres, SARS expects a logbook that records each trip.' },
      DIVIDENDS_NOT_INCLUDED: { title: 'Dividends', body: 'Dividends from shares are taxed differently and are not counted here.' },
      MEDICAL_6B_POSSIBLE: { title: 'Extra medical costs credit', body: 'Costs your scheme did not cover may give you an extra credit when you file. Add them on the medical aid question to include it.' },
    },

    // Copy summary (PRD 14.8): plain text, user-started, labelled an estimate.
    copy: {
      button: 'Copy summary',
      done: 'Copied. Paste it wherever you like.',
      failed: 'Your browser would not let us copy. Select the text below instead.',
      heading: 'Share a summary',
      sub: 'Copies a short plain-text summary to your clipboard. Nothing is sent anywhere.',
      title: (product: string, year: string) => `${product}: ${year} tax estimate`,
      grossLine: (amount: string) => `Gross salary, a normal month: ${amount}`,
      annualLine: (amount: string) => `Tax for the year: ${amount}`,
      footer: 'Estimate only. Not tax advice, not a SARS assessment.',
    },
  },

  assistant: {
    open: "Ask the assistant",
    unavailable: "Assistant unavailable. Your results are fully calculated and shown on this page regardless.",
    consent: {
      title: "Turn on the assistant?",
      // Shown while the assistant runs on this device (this version).
      onDevice: [
        "The assistant explains your result in plain words and answers common questions about it.",
        "In this version it runs entirely on your device. Your answers and results are not sent anywhere, and nothing is stored by us. It writes its answers from templates, so it is not an AI model.",
        "We remember only that you said yes, on this device. If a later version uses an outside AI service, we will ask you again before anything is shared.",
      ],
      // Ready for a version that uses an outside service (PRD §15.2.2). Not shown yet.
      external: [
        "The assistant runs on an external AI service (Claude, from Anthropic). If you continue, your answers and results (like salary and deductions, never your name, ID or tax number) will be sent to that service to generate explanations. We store nothing, and the service may keep requests for a limited time under its own terms.",
        "You can see exactly what would be sent below. You can say no and keep using the calculator.",
      ],
      previewSummary: "See exactly what would be sent",
      previewNote: "Only these numbers and labels, worked out by the calculator, plus your question. No name, ID, tax number, employer or bank details.",
      yes: "Enable assistant",
      no: "No thanks",
    },
    drawerTitle: "Assistant",
    conversation: "Conversation with the assistant",
    chip: "Explanations on your device · calculations by the calculator",
    chipExternal: "AI explanations · calculations by the deterministic engine",
    attribution: "Assistant: explanations only. All numbers come from the calculator, not from the assistant.",
    greeting: "Ask me how your result was worked out. I can explain the parts of it, but I can't give advice.",
    suggestionsLabel: "Questions you could ask",
    suggestions: ["Which tax bracket am I in?", "Why is my PAYE what it is?", "How much would an RA save me?", "Why is my bonus taxed so heavily?"],
    inputLabel: "Your question",
    inputHint: "For example: why is my take-home pay lower than my salary?",
    send: "Send",
    thinking: "Thinking",
    you: "You",
    assistant: "Assistant",
    checked: (n: number) => (n === 1 ? "Checked: this figure matches your results." : `Checked: all ${n} figures match your results.`),
    replaced: "I replaced my first draft because it contained a figure the calculator did not provide.",
    logHeading: "What was checked",
    logEmpty: "Nothing yet. Each answer is checked here, on your device, and kept only until you close this page.",
    logRow: (matched: number, invented: number) => `${matched} matched${invented ? `, ${invented} not from the calculator (answer replaced)` : ""}`,
  },

  loadError: {
    title: "This page didn't load",
    body: "Your connection may have dropped, or the site was just updated. Nothing you typed has been sent anywhere. Reload to try again.",
    reload: "Reload",
  },

  notFound: {
    title: "We couldn't find that page",
    body: "The link might be old, or there might be a typo in the address.",
    home: "Go to the home page",
  },
} as const;

/**
 * Everything the PDF says, in the shape the PDF package expects. The PDF's own headings and labels are in `copy.pdf`; the
 * sentences it shares with the results page (the payslip comparison, notes, warnings and exclusions) are the page's own,
 * word for word, so the two can never disagree.
 */
export const pdfText: PdfText = {
  ...copy.pdf.document,
  tax: { heading: copy.pdf.own.taxHeading, rows: copy.pdf.own.taxRows, unusedCredit: copy.results.breakdown.unusedCredit },
  comparison: {
    heading: copy.pdf.own.comparisonHeading,
    rows: {
      PAYSLIP_PAYE: copy.results.comparison.payslip,
      CALC_PAYE: copy.results.comparison.calc,
      PAYSLIP_UIF: copy.results.comparison.uifPayslip,
      CALC_UIF: copy.results.comparison.uifCalc,
    },
    uifAssumed: copy.results.comparison.uifAssumed,
    match: copy.results.comparison.match,
    higher: copy.results.comparison.higher,
    lower: copy.results.comparison.lower,
    explainHeading: copy.results.comparison.explainHeading,
    explain: copy.results.comparison.explain,
  },
  reconciliation: {
    heading: copy.pdf.own.reconciliationHeading,
    rows: {
      GROSS: copy.results.breakdown.rows.GROSS.label,
      EXTRAS: copy.results.breakdown.rows.EXTRAS.label,
      TRAVEL: copy.results.breakdown.rows.TRAVEL.label,
      RETIREMENT_OWN: copy.results.breakdown.rows.RETIREMENT_OWN.label,
      MEDICAL_OWN: copy.results.breakdown.rows.MEDICAL_OWN.label,
      PAYE: copy.results.breakdown.rows.PAYE.label,
      UIF: copy.results.breakdown.rows.UIF.label,
      TAKE_HOME: copy.results.breakdown.rows.TAKE_HOME.label,
    },
    debitHeading: copy.results.breakdown.offPayslipHeading,
    debitRows: {
      MEDICAL_DEBIT_ORDER: copy.results.breakdown.rows.MEDICAL_DEBIT_ORDER.label,
      RA_DEBIT_ORDER: copy.results.breakdown.rows.RA_DEBIT_ORDER.label,
    },
    yearNote: copy.results.breakdown.yearNote,
  },
  warnings: { heading: copy.results.warningsHeading, items: copy.results.warnings },
  assumptions: { heading: copy.results.notesHeading, items: copy.results.notes },
  flags: { heading: copy.results.flagsHeading, items: copy.results.flags, readMore: copy.results.flagLink },
};
