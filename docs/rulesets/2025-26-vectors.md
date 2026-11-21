# 2025/26 reference vectors (draft year)

These are the expected results the engine is tested against for 2025/26 (`packages/tax-engine/src/__tests__/vectors2025.test.ts`). They are labelled Y1 to Y19, like the PRD's T1 to T20 for 2026/27, and can be loaded in the Workbench from **Load a test vector**.

## How they were produced

- **Not from the engine.** Each number was worked out by a separate calculator written only from the published SARS formulas in `2025-26-sources.md`. Before it was used, the same calculator reproduced the PRD's T1 for 2026/27 (PAYE R3 149,00, take-home R23 673,88).
- **Not from a SARS worked example.** I found no SARS-published worked example for 2025/26. So these show the engine follows the published formulas; they do not show SARS agrees with every cent. One reviewer task (below) closes that gap.
- Tax is the SARS formula `base + rate × (income − where the bracket starts)`. Monthly PAYE is the year's tax ÷ 12 to the cent. UIF is 1% of pay up to R17 712 a month. Take-home is pay − own retirement − PAYE − UIF.

**Reviewer task:** run Y1 and Y3 through the SARS online tax calculator or the 2026 PAYE deduction tables, and note the result in the sign-off table in `2025-26-sources.md`.

## Constants used in the working

| | 2025/26 |
|---|---|
| Brackets | 18% to R237 100; R42 678 + 26% to R370 500; R77 362 + 31% to R512 800; … |
| Rebates | R17 235 (under 65); + R9 444 (65+); + R3 145 (75+) |
| Medical credit | R364 (main), R364 (first dependant), R246 (each more), a month |
| Retirement | 27.5% of income, cap R350 000 |

## The vectors

| ID | Case | Working | Result |
|---|---|---|---|
| Y1 | R30 000 a month, R3 000 pension, medical aid for 2 | Income 360 000 − pension 36 000 = taxable 324 000. Tax 42 678 + 26% × (324 000 − 237 100) = 65 272. − rebate 17 235 = 48 037. − medical 2 × 364 × 12 = 8 736 → 39 301. ÷ 12 = 3 275,08 | PAYE **R3 275,08**; UIF R177,12; take-home **R23 547,80** |
| Y2 | R19 750 a month | Income 237 000, still in the 18% band: 18% × 237 000 = 42 660. − 17 235 = 25 425. ÷ 12 = 2 118,75 | Tax before rebates **R42 660**; PAYE **R2 118,75**; take-home R17 454,13 |
| Y3 | R19 800 a month | Income 237 600: 42 678 + 26% × 500 = 42 808. − 17 235 = 25 573. ÷ 12 = 2 131,08 | Tax before rebates **R42 808**; PAYE **R2 131,08**; take-home R17 491,80 |
| Y4 | R7 900, under 65 | Income 94 800. 18% = 17 064, less than the rebate 17 235 | Tax **R0**; take-home R7 821,00 (UIF R79) |
| Y5 | R8 000, under 65 | Income 96 000. 18% = 17 280. − 17 235 = 45. ÷ 12 = 3,75 | PAYE **R3,75**; take-home R7 916,25 |
| Y6 | 65 to 74, R12 300 | Income 147 600; 18% = 26 568, less than rebates 17 235 + 9 444 = 26 679 | Tax **R0**; take-home R12 177,00 |
| Y7 | 65 to 74, R12 400 | Income 148 800; 18% = 26 784. − 26 679 = 105. ÷ 12 = 8,75 | PAYE **R8,75**; take-home R12 267,25 |
| Y8 | 75+, R13 700 | Income 164 400; 18% = 29 592, less than rebates 17 235 + 9 444 + 3 145 = 29 824 | Tax **R0**; take-home R13 563,00 |
| Y9 | 75+, R13 900 | Income 166 800; 18% = 30 024. − 29 824 = 200. ÷ 12 = 16,67 | PAYE **R16,67**; take-home R13 744,33 |
| Y10 | R17 713 (R1 over the UIF ceiling) | Income 212 556. 18% = 38 260,08. − 17 235 = 21 025,08. ÷ 12 = 1 752,09. UIF = 1% × 17 712 = 177,12 | PAYE **R1 752,09**; UIF **R177,12**; take-home R15 783,79 |
| Y11 | Zero income | Nothing to tax | Everything **R0** |
| Y12 | R150 000 a month, R30 000 own + R20 000 employer into retirement | Contributions 600 000 a year. Income 1 800 000 + employer 240 000 = 2 040 000; 27.5% = 561 000, above the cap | Limit and deduction **R350 000**; carried forward **R250 000** |
| Y13 | R120 000 a month, R30 000 own into retirement (and R29 000) | 27.5% × 1 440 000 = 396 000, above the cap. 360 000 − 350 000 = 10 000. With R29 000: 348 000 fits | Deduction **R350 000**, carry **R10 000**; with R29 000: **R348 000**, carry **R0** |
| Y14 | R30 000, medical aid for 1 | Income 360 000: 42 678 + 26% × 122 900 = 74 632. − 17 235 − 364 × 12 (4 368) = 53 029. ÷ 12 = 4 419,08 | PAYE **R4 419,08**; take-home R25 403,80 |
| Y15 | R30 000, medical aid for 5 | Credit (364 + 364 + 3 × 246) × 12 = 17 592. 74 632 − 17 235 − 17 592 = 39 805. ÷ 12 = 3 317,08 | PAYE **R3 317,08**; take-home R26 505,80 |
| Y17 | R30 000 and R60 000 bonus | Regular year: 74 632 − 17 235 = 57 397 (÷ 12 = 4 783,08). With bonus, income 420 000: 77 362 + 31% × 49 500 = 92 707. − 17 235 = 75 472. Tax on bonus 75 472 − 57 397 = 18 075. Average month: pay 30 000 + 5 000 − PAYE 75 472 ÷ 12 (6 289,33) − UIF 177,12 | Normal month PAYE **R4 783,08**, take-home **R25 039,80**; year PAYE **R75 472**; average take-home **R28 533,55** |
| Y18 | Bank deposit R20 000 (take-home mode) | Find the salary whose take-home (pay − PAYE − UIF) is 20 000. In the 26% band: 12 × pay − … solved numerically to the cent | Gross about **R23 189,47** (accepted within R1). The same method gives R23 051,52 for 2026/27, matching the PRD's corrected T16 |
| Y19 | 65 to 74, R30 000, medical aid for 2 at R3 500, R10 000 out of pocket | 6A credit (364 + 364) × 12 = 8 736. 6B: 33,3% × (10 000 + (42 000 − 3 × 8 736)) = 33,3% × 25 792 = 8 588,74. Tax 74 632 − rebates 26 679 = 47 953; − 8 736 = 39 217; − 8 588,74 | 6A **R8 736**; 6B **R8 588,74**; final tax **R30 628,26** |

The numbering skips Y16. Nothing is missing: the take-home vector is Y18 and the bonus is Y17.

## Across years

For R30 000 a month and nothing else, final tax is R57 397 in 2025/26 and R56 172 in 2026/27, R1 225 apart. Rebate: R17 235 against R17 820. First bracket: to R237 100 against R245 100. This is checked in the tests and shown in the Workbench's Compare years view.
