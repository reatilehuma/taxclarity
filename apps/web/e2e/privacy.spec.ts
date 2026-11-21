import { expect, test, type Request } from "@playwright/test";
import { expectResult, fillExtras, Wizard } from "./driver";

/** Odd amounts that would stand out in any address, header or body if they ever left the page. */
const MARKERS = ["31337", "2718", "1618", "4242", "6174", "9091", "7777", "8128"];

test.describe("privacy: what leaves the page", () => {
  test("a full run with every kind of answer sends nothing anywhere", async ({ page, context }) => {
    const seen: Request[] = [];
    context.on("request", (r) => seen.push(r));
    const sockets: string[] = [];
    page.on("websocket", (ws) => sockets.push(ws.url()));
    const problems: string[] = [];
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

    // Anything aimed at another website is refused, and recorded above so the test can see the attempt.
    const origin = new URL(test.info().project.use.baseURL ?? "http://localhost:4173").origin;
    await context.route((url) => url.origin !== origin, (route) => route.abort());

    const w = new Wizard(page);
    await w.run({
      mode: "payslip",
      amount: "31337",
      age: "65 to 74",
      retirement: { payslip: "2718", ra: "1618" },
      medical: { members: 2, total: "7777", paidBy: "We share it", employerShare: "4242", via: "By debit order" },
      variable: { bonus: "9091", overtime: "6174" },
      extras: () => fillExtras(w, { donations: "8128", interest: "50001", travel: "5001", km: "12501", secondJob: "100001" }),
      payslip: { paye: "9999", uif: "170" },
    });
    await expectResult(page, {
      mode: "PAYSLIP",
      amount: 31_337,
      ageBand: "AGE_65_74",
      retirement: { ownMonthly: 2_718, employerMonthly: 0, privateRaMonthly: 1_618 },
      medical: { member: true, members: 2, monthlyContribution: 7_777, paidBy: "SHARED", employerMonthly: 4_242, ownSharePaidVia: "DEBIT_ORDER" },
      variablePay: { bonusAnnual: 9_091, overtimeAnnual: 6_174 },
      advanced: { donations18AAnnual: 8_128, localInterestAnnual: 50_001, travelAllowanceMonthly: 5_001, travelBusinessKmAnnual: 12_501, hasSecondEmployer: true, secondEmployerAnnualGross: 100_001 },
      payslip: { payeMonthly: 9_999, uifMonthly: 170 },
    });
    await page.getByRole("button", { name: "Copy summary" }).click().catch(() => undefined);

    // 1. Every request went to this site, and every one only asked for a file.
    expect(seen.length).toBeGreaterThan(3);
    for (const r of seen) {
      expect(new URL(r.url()).origin, `request to ${r.url()}`).toBe(origin);
      expect(r.method(), r.url()).toBe("GET");
      expect(r.postData(), r.url()).toBeNull();
    }
    // 2. No amount appears in any address, and addresses carry no data except the step and how you started.
    for (const r of seen) {
      const url = new URL(r.url());
      for (const m of MARKERS) expect(r.url(), `${m} in ${r.url()}`).not.toContain(m);
      for (const key of url.searchParams.keys()) expect(["step", "start", "from"], r.url()).toContain(key);
    }
    // 3. Nothing but files from the site's own folders and its pages: no endpoints, no beacons.
    for (const r of seen) {
      const path = new URL(r.url()).pathname;
      const ok = path.startsWith("/assets/") || ["/", "/index.html", "/sw.js", "/favicon.svg", "/manifest.webmanifest", "/wizard", "/results"].includes(path);
      expect(ok, `unexpected request: ${r.url()}`).toBe(true);
    }
    // 4. No live connections, and no other site was even attempted.
    expect(sockets).toEqual([]);
    // 5. No browser warnings (a blocked request or a policy violation would show up here).
    expect(problems).toEqual([]);
  });

  test("nothing is stored on the device: no cookies, no storage, no databases", async ({ page, context }) => {
    const w = new Wizard(page);
    await w.run({ mode: "gross", amount: "31337", retirement: { payslip: "2718" } });
    expect(await context.cookies()).toEqual([]);
    const stored = await page.evaluate(async () => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      cookie: document.cookie,
      databases: (await indexedDB.databases()).map((d) => d.name),
    }));
    expect(stored).toEqual({ local: [], session: [], cookie: "", databases: [] });
  });

  test("the page is served under a strict content policy, and nothing breaks it", async ({ page }) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective}: ${e.blockedURI}`));
      (window as unknown as { __csp: string[] }).__csp = [];
    });
    const response = await page.goto("/");
    const csp = response!.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    await new Wizard(page).run({ mode: "gross", amount: "30000" });
    violations.push(...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)));
    expect(violations).toEqual([]);
  });
});
