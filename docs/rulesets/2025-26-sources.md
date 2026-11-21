# 2025/26 rule set: sources and sign-off

**Status: DRAFT. Not signed off.** The year can be chosen in the development Workbench only. It cannot be released until the reviewer block at the bottom is filled in (PRD §6.16, §10.5, Q8).

- Year of assessment: **2025/26**, 1 March 2025 to 28 February 2026. SARS calls it the **2026 tax year**.
- Rule set file: `packages/tax-engine/src/rulesets/2025-26.ts` (`rulesVersion` `2025-26-draft-1`)
- Compiled: 20 November 2026. Every "Read" date below is 20 November 2026.
- Rule: no value was taken from the 2026/27 rule set, and no gap was filled with one.

## Documents used

| ID | Document | Where | Notes |
|---|---|---|---|
| **S16** | SARS "Budget 2025 Tax Guide" (the tax pocket guide for 2025/26) | https://archive.treasury.gov.za/documents/National%20Budget/2025Mar/sars/Budget%202025%20Tax%20Guide.pdf (the older `www.treasury.gov.za` address redirects here) | Read as text from the PDF. **The copy I read is the February 2025 edition**: its highlights still say VAT rises to 15.5% on 1 May 2025, which the 12 March 2025 Budget withdrew. Its personal income tax figures agree with the SARS page below, which says "12 March 2025 – No changes". The reviewer should confirm against the final March edition. |
| **S1** | SARS "Rates of tax for individuals" | https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/ (last updated 28/10/2026) | Rebate and threshold tables have a **2026** column. It prints **no** bracket table for the 2026 year ("12 March 2025 – No changes"), so the brackets come from S16. |
| **S2** | SARS "Medical tax credit rates" | https://www.sars.gov.za/tax-rates/medical-tax-credit-rates/ (last updated 25/02/2026) | Table has a **2026** column. |
| **S4** | SARS "Unemployment Insurance Fund" | https://www.sars.gov.za/types-of-tax/unemployment-insurance-fund/ (last updated 19/08/2026) | |
| **S5** | SARS "Tax-free investments" | https://www.sars.gov.za/types-of-tax/personal-income-tax/tax-free-investments/ (last updated 20/03/2026) | |
| **S17** | Government Gazette 52199, Notice 5936, 28 February 2025: "Fixing of rate per kilometre" | https://www.sars.gov.za/legal-lsec-it-gn-2025-003-budget-2025-rates-per-kilometre-28-february-2025 | Read the gazette PDF text. |

## Every parameter

"Value" is what is in the rule set. "Where" is the exact place the value was read.

| # | Parameter | Value | Source | Where | Notes |
|---|---|---|---|---|---|
| 1 | Bracket 1 | 18% up to R237 100 | S16 | "Tax rates from 1 March 2025 to 28 February 2026", row 1 | |
| 2 | Bracket 2 | R42 678 + 26% above R237 100, up to R370 500 | S16 | same table | |
| 3 | Bracket 3 | R77 362 + 31% above R370 500, up to R512 800 | S16 | same table | |
| 4 | Bracket 4 | R121 475 + 36% above R512 800, up to R673 000 | S16 | same table | |
| 5 | Bracket 5 | R179 147 + 39% above R673 000, up to R857 900 | S16 | same table | |
| 6 | Bracket 6 | R251 258 + 41% above R857 900, up to R1 817 000 | S16 | same table | |
| 7 | Bracket 7 | R644 489 + 45% above R1 817 000 | S16 | same table | |
| 8 | Primary rebate | R17 235 | S16, S1 | Rebates table; S1 "2026" column | Two sources agree. |
| 9 | Secondary rebate (65+) | R9 444 | S16, S1 | same | Two sources agree. |
| 10 | Tertiary rebate (75+) | R3 145 | S16, S1 | same | Two sources agree. |
| 11 | Threshold under 65 | R95 750 | S16, S1 | "Tax threshold" row; S1 "2026" column | Equals R17 235 ÷ 18%. |
| 12 | Threshold 65 to 74 | R148 217 | S16, S1 | same | R26 679 ÷ 18% = R148 216,67; SARS prints whole rands. At R148 217 exactly the tax is R0,06. |
| 13 | Threshold 75+ | R165 689 | S16, S1 | same | R29 824 ÷ 18% = R165 688,89; same rounding. |
| 14 | UIF employee rate | 1% | S4 | "must be 1% of the remuneration" | |
| 15 | UIF monthly ceiling | R17 712 (R212 544 a year) | S4 | "With effect from 1 June 2021 – R17 712 per month" | Max employee deduction R177,12. No later notice found. See open item 1. |
| 16 | Retirement deduction rate | 27.5% | S16 | "Retirement fund contributions" | Of the greater of remuneration or taxable income. |
| 17 | Retirement deduction cap | R350 000 a year | S16 | same: "lower of R350 000 or 27.5% of taxable income" | Excess carries forward. |
| 18 | Medical credit, main member | R364 a month | S16, S2 | "R364 for each of the first two persons"; S2 "2026" column | Two sources agree. |
| 19 | Medical credit, first dependant | R364 a month | S16, S2 | same | S2 shows R728 for taxpayer plus one dependant. |
| 20 | Medical credit, each extra dependant | R246 a month | S16, S2 | same | |
| 21 | Additional medical credit, 65+ or disability | 33.3% of (qualifying expenses + contributions above 3 × credits) | S16 | "Medical and disability expenses" | Stored as 0.333, as in 2026/27. |
| 22 | Additional medical credit, others | 25% of (expenses + contributions above 4 × credits), above 7.5% of taxable income | S16 | same | |
| 23 | Section 18A donations limit | 10% of taxable income | S16 | "Donations" | Excess carries forward. |
| 24 | Interest exemption under 65 | R23 800 | S16 | "Interest Exemptions" | |
| 25 | Interest exemption 65+ | R34 500 | S16 | same | |
| 26 | Tax-free investment annual limit | R36 000 | S5 | "For the 2021 to 2026 year of assessment, the annual limit amounted to R36 000" | R46 000 applies from the 2027 year. |
| 27 | Tax-free investment lifetime limit | R500 000 | S5 | "lifetime limit of R500 000 per person" | |
| 28 | Excess penalty | 40% | S5 | "a 'penalty' ... of 40%" | |
| 29 | Simplified rate per km | R4,76 | S17, S16 | "476 cents per kilometre"; years starting on or after 1 March 2025 | Both agree. |
| 30 | Share of allowance taxed | 80% (20% if business use is at least 80%) | S16 | "Travelling allowance" notes | |
| 31 | Business-use threshold | 80% | S16 | same | |
| 32 | Donations tax annual exemption (reference only) | R100 000 | S16 | "Donations Tax" | **SARS's donations-tax page now says R150 000** and gives no date for that figure. It is only used for a flag. See open item 2. |

Not used by the engine, noted so no one wonders: the travel allowance fixed-cost scale (S16), subsistence amounts (R570 and R176 a day), lump-sum tables, and the second-pot withdrawal rules.

## Changes inside the year

1. **None found for individuals.** The 19 February 2025 Budget proposed no change to brackets, rebates or credits, and the 12 March 2025 Budget did not change them either. The VAT increase was withdrawn. VAT is out of scope.
2. **UIF ceiling:** unchanged since 1 June 2021 on the SARS page. No notice for 2025 or 2026 was found. The engine holds it as one value with its date (`effectiveDates.uifCeiling`).
3. **Retirement cap and tax-free investment limit** both rose on 1 March 2026, which is the start of 2026/27, so they do not split 2025/26.

## Differences in method from 2026/27

None found. The structure (brackets, rebates, section 11F, 6A, 6B, 18A, travel, UIF) is the same, so the same engine runs with different numbers. Only values differ: brackets, rebates, thresholds, the retirement cap, medical credits, the tax-free limit, the per-km rate and the donations-tax exemption.

## Inputs whose meaning changes between years (for the Phase 18 selector)

- **Age band.** It means age on the last day of the tax year, 28 February 2026 for 2025/26 and 28 February 2027 for 2026/27. A person aged 65 on the later date may have been 64 on the earlier one.
- **Months on medical aid, donations, interest, travel kilometres, second employer.** These mean "this tax year", so they mean the selected year's.
- **Carried-forward retirement or donation amounts.** Not collected today.

## Open items for the reviewer

1. **UIF ceiling.** Please check the Department of Employment and Labour has issued no notice changing R17 712 between 1 March 2025 and 28 February 2026. I could only see SARS's page and secondary sources, not the Department's own.
2. **Donations-tax exemption** R100 000 (S16) against the R150 000 now on SARS's page. Which applied for 2025/26? It does not change any tax figure.
3. **Confirm S16 against the final March 2025 edition** of the Budget Tax Guide (the copy read is the February edition).
4. **Brackets come from S16 only.** SARS's own table page does not print the 2026 year. Please cross-check one bracket against the SARS PAYE deduction tables for 2026 (`PAYE-GEN-01-G01`).
5. **Section 6B percentages** are stored as 0.333 (as in 2026/27) while SARS says "33.3%". It is the same number.

## Sign-off

Nothing in this file is signed off. To release the year, a reviewer checks each row against its source, resolves the open items, and fills this in. Then `status` in `2025-26.ts` can change to `"verified"`.

| Reviewer | Date | Rows checked | Open items resolved | Signature or note |
|---|---|---|---|---|
| | | | | |
| | | | | |
