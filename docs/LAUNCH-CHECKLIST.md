# Launch checklist

Tick each line before sharing the address. "Automated" means `npm run ci` already checks it, so a failure there
blocks the release; the rest are by hand.

## Privacy and security

- [x] Automated: a full run with every kind of answer makes only requests for this site's own files, all GET,
      none carrying an amount (`e2e/privacy.spec.ts`).
- [x] Automated: nothing stored on the device: no cookies, local or session storage, or databases.
- [x] Automated: strict content policy and security headers present; no policy violations during a full run.
- [x] Automated: only the site's own files are kept for offline use; no answers, nothing from other sites.
- [ ] By hand: open the live site with the browser's network tab open, run a calculation, and see only files.
- [ ] By hand: the privacy wording on the landing page still matches reality (no analytics added since).

## The assistant

- [x] Automated: nothing is sent to any provider, and nothing is stored, before "Enable assistant" (`e2e/assistant.spec.ts`, `apps/web/src/assistant/assistant.test.tsx`).
- [x] Automated: the only thing ever stored is the name of the assistant you said yes to; saying no stores nothing.
- [x] Automated: every figure in every answer is one the calculator produced; an answer with an invented figure is replaced.
- [x] Automated: the calculator behaves the same whether the assistant is on, off, declined or failing.
- [x] Automated: with the AI assistant, the consent window shows exactly what would be sent; the proxy refuses anything but the app's own request (wrong method, other origin, extra or personal fields, oversize), and asks the model nothing in those cases.
- [x] Automated: an invented figure is retried once and then replaced by an apology; a refusal and a failure each have a plain message; nothing about a question or answer is logged.
- [ ] By hand, before enabling the AI assistant: a spending limit on the API key; `ANTHROPIC_API_KEY` set as a Secret; a rate-limit rule on `/api/assistant`; `npm run assistant:smoke` read through; the consent wording read once more.
- [ ] By hand: ask five questions of your own on the live site and read the answers against the results page.

## Honesty and wording

- [x] Automated: the disclaimer and the "last checked" date are in the footer of every page type, and the results
      page says "Estimates only. Not tax advice, not a SARS assessment."
- [x] Automated: every outside link is an official source (SARS, Treasury, KPMG, PwC), opens in a new tab, with
      `noreferrer`.
- [ ] By hand: `npm run links:check` shows no broken link (needs internet).
- [ ] By hand: read the results page for one profile you can verify against the SARS tables or a payslip.
- [ ] By hand: the "last checked" date in the footer is today's date or close (`lastVerified` in the rule set).

## Works for everyone

- [x] Automated: axe finds no critical or serious accessibility problem on the pages and states listed in
      `e2e/a11y.spec.ts`.
- [x] Automated: keyboard-only walkthrough, layout at 360, 768, 1024 and 1440 px, reduced motion.
- [ ] By hand: keyboard-only, then a screen reader (NVDA, VoiceOver or TalkBack) on the amount question,
      the medical aid question and the results table.
- [ ] By hand: Safari (iPhone) and Firefox, not covered by the automated runs.
- [ ] By hand: on a real phone, including the on-screen number keyboard.

## Speed and offline

- [x] Automated: landing JavaScript at most 150 KB compressed (`npm run bundle:check`, part of `npm run ci`).
- [x] Automated: the whole calculation works with the network switched off after the first visit.
- [ ] By hand: `npm run lighthouse` meets Performance 90, Accessibility 95, Best Practices 95, SEO 90 (run
      against the live address too: `npm run lighthouse -- https://your-address`).
- [ ] By hand: live site on a phone, airplane mode, calculate again.

## Tax years and the PDF summary

- [x] Automated: every known tax year is `verified`, in the signed-off list and has a filled-in sign-off row, or the
      build is blocked (`npm run release:check`, the CI job "release-gate").
- [x] Automated: no draft year's figures are in a production build (`npm run bundle:check`).
- [x] Automated: golden paths, the PDF downloads and the figures test run for 2025/26 and 2026/27 (3 modes, desktop and phone).
- [x] Automated: making the PDF sends nothing; it works offline after one visit; the PDF code is not on the landing page.
- [ ] By hand: both years signed off in `docs/rulesets/*-sources.md` by a person other than the author.
- [ ] By hand: with the network tab open on the live site, change the year, finish the wizard and download the PDF:
      only this site's own files are requested, all GET, none carrying an amount.
- [ ] By hand: year selector on a phone; switch year mid-wizard and on the results page; the answers carry over.
- [ ] By hand: download the PDF for each year; the figures match the results page and nothing names the other year.
- [ ] By hand: the PDF on a real phone (Android Chrome and iOS Safari), once online and once in airplane mode.

## Release

- [ ] `npm run ci` is green.
- [ ] The site is served over HTTPS and `http://` redirects to it.
- [ ] `sw.js` and `index.html` are not cached by the host (check the response headers once).
- [ ] The next tax year's date is in the calendar: docs/RUNBOOK-NEW-TAX-YEAR.md.
