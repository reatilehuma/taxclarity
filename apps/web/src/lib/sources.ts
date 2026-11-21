import type { SourceId, TaxYear } from "@taxclarity/tax-engine";

/** PRD Appendix A: authoritative sources, linked from flags and notes. */
export const SOURCES: Record<SourceId, { title: string; url: string }> = {
  S1: { title: "SARS: Rates of tax for individuals", url: "https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/" },
  S2: { title: "SARS: Medical tax credit rates", url: "https://www.sars.gov.za/tax-rates/medical-tax-credit-rates/" },
  S3: { title: "SARS: Medical credits", url: "https://www.sars.gov.za/types-of-tax/personal-income-tax/medical-credits/" },
  S4: { title: "SARS: Unemployment Insurance Fund", url: "https://www.sars.gov.za/types-of-tax/unemployment-insurance-fund/" },
  S5: { title: "SARS: Tax-free investments", url: "https://www.sars.gov.za/types-of-tax/personal-income-tax/tax-free-investments/" },
  S6: { title: "SARS: Rates per kilometre", url: "https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/" },
  S7: { title: "SARS: Pay-As-You-Earn", url: "https://www.sars.gov.za/types-of-tax/pay-as-you-earn/" },
  S8: { title: "SARS: Guide for employers on allowances", url: "https://www.sars.gov.za" },
  S9: {
    title: "SARS: Tax and retirement",
    url: "https://www.sars.gov.za/individuals/tax-during-all-life-stages-and-events/tax-and-retirement/",
  },
  S10: { title: "SARS: Donations tax", url: "https://www.sars.gov.za/types-of-tax/donations-tax/" },
  S11: { title: "National Treasury: 2026 Budget", url: "https://www.treasury.gov.za" },
  S12: {
    title: "KPMG: SA Budget Guide 2026/27",
    url: "https://assets.kpmg.com/content/dam/kpmgsites/za/pdf/2026/02/SA%20Budget%20Guide%202026.pdf",
  },
  S13: {
    title: "PwC: South Africa individual tax credits",
    url: "https://taxsummaries.pwc.com/south-africa/individual/other-tax-credits-and-incentives",
  },
  S14: { title: "SARS: Pay-As-You-Earn", url: "https://www.sars.gov.za/types-of-tax/pay-as-you-earn/" },
  S15: { title: "SARS: Home office expenses", url: "https://www.sars.gov.za" },
  S16: {
    title: "SARS: Budget 2025 tax guide (2025/26)",
    url: "https://archive.treasury.gov.za/documents/National%20Budget/2025Mar/sars/Budget%202025%20Tax%20Guide.pdf",
  },
  S17: {
    title: "Government Gazette 52199, Notice 5936: rate per kilometre (28 February 2025)",
    url: "https://www.sars.gov.za/legal-lsec-it-gn-2025-003-budget-2025-rates-per-kilometre-28-february-2025",
  },
};

/**
 * Sources whose name or address is specific to one tax year. Everything not listed here is the same for every year
 * (a live SARS page). A link that names a year must follow the year of the result it sits next to (PRD §6.16); the
 * default year's versions are the entries in SOURCES above. `npm run links:check` reads this file, so these are
 * checked too.
 */
const YEAR_SOURCES: Partial<Record<TaxYear, Partial<Record<SourceId, { title: string; url: string }>>>> = {
  "2025-26": {
    S11: { title: "National Treasury: 2025 Budget", url: "https://www.treasury.gov.za" },
  },
};

/** The source to link for a result of this tax year. */
export function sourceFor(id: SourceId, taxYear: TaxYear): { title: string; url: string } {
  return YEAR_SOURCES[taxYear]?.[id] ?? SOURCES[id];
}
