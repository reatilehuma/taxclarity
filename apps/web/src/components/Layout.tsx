import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { copy, PRODUCT_NAME, yearCopy } from "../content/strings.ts";
import { formatDate } from "../lib/format.ts";
import { SOURCES } from "../lib/sources.ts";
import { useTaxYear } from "../wizard/WizardContext.tsx";
import { Icon } from "./Icon.tsx";
import { ButtonLink, Container, FlagStripe, Pill } from "./ui.tsx";
import { YearChangeNotice } from "./YearChangeNotice.tsx";

/** Page shell: skip link, header, main landmark, footer (PRD §17.3 landmarks). */
export function Layout() {
  useScrollOnNavigate();
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-brand-800 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {copy.common.skipToContent}
      </a>
      <SiteHeader />
      <YearChangeNotice />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

/** Scroll to the top on page change, or to the #section when the link has one. */
function useScrollOnNavigate() {
  const { pathname, hash } = useLocation();
  const firstLoad = useRef(true);
  useEffect(() => {
    // A fresh page already starts at the top. Scrolling anyway would force the browser to lay the page out
    // before its first paint, which slows the first load for nothing.
    if (firstLoad.current && !hash) {
      firstLoad.current = false;
      return;
    }
    firstLoad.current = false;
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
}

export function Logo() {
  return (
    <Link to="/" aria-label={copy.nav.home} className="group inline-flex min-h-11 items-center gap-2.5 rounded-lg">
      <span
        aria-hidden="true"
        className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white shadow-[0_6px_16px_-6px_rgb(6_35_31/0.6)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M6 7.5h12M6 12h8M6 16.5h5" />
          <path d="m14.5 16 1.8 1.8L20 14" />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[17px] leading-none font-bold tracking-tight text-ink-950">{PRODUCT_NAME}</span>
        <FlagStripe className="mt-1.5 w-10" />
      </span>
    </Link>
  );
}

function SiteHeader() {
  const { rules } = useTaxYear();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-canvas/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 md:flex">
            <Pill icon="calendar">{yearCopy(rules).pill}</Pill>
            <Pill icon="lock" tone="brand">
              {copy.common.privacyPill}
            </Pill>
          </div>
          <ButtonLink to="/wizard" className="!min-h-11 !px-4 !py-2 text-sm">
            {copy.nav.cta}
          </ButtonLink>
        </nav>
      </Container>
    </header>
  );
}

const FOOTER_SOURCES = ["S1", "S2", "S4", "S9", "S5", "S6"] as const;

function SiteFooter() {
  const { rules } = useTaxYear();
  return (
    <footer className="mt-auto border-t border-ink-200 bg-surface">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.4fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-md text-sm font-semibold text-ink-800">{copy.footer.disclaimer}</p>
          <p className="mt-2 max-w-md text-sm text-ink-600">
            {yearCopy(rules).footerYear} {copy.footer.lastVerified(formatDate(rules.lastVerified))}
          </p>
          <p className="mt-6 text-sm text-ink-500">{copy.footer.madeFor}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink-900">{copy.footer.sourcesHeading}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {FOOTER_SOURCES.map((id) => (
              <li key={id}>
                <a
                  href={SOURCES[id].url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-ink-600 underline decoration-ink-300 underline-offset-4 hover:text-brand-800 hover:decoration-brand-400"
                >
                  {SOURCES[id].title}
                  <Icon name="arrowRight" className="h-3.5 w-3.5 -rotate-45" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
