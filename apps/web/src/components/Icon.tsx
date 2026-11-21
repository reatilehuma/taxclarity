/** Small stroke icons, drawn on a 24×24 grid. Decorative unless a label is given. */

const PATHS = {
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
      <path d="M12 14.5v2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16.5 9.5" />
    </>
  ),
  browser: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M6.5 6.75h.01M9 6.75h.01" />
    </>
  ),
  idOff: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 15.5c.6-1.3 1.7-2 3-2s2.4.7 3 2M14.5 10h3M14.5 13h3" />
      <path d="M4 4l16 16" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7Z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  piggy: (
    <>
      <path d="M5 11.5a6.5 5.5 0 0 1 12.2-2.6l2.3-.9-.6 3a5 5 0 0 1 .1 1.5c0 2-1.2 3.7-3 4.6V19h-2.5v-1.4a8 8 0 0 1-2.5 0V19H8.5v-1.9A5.4 5.4 0 0 1 5 12.3" />
      <path d="M3.5 12.5H5M15 10.5h.01" />
    </>
  ),
  heart: (
    <>
      <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />
      <path d="M8.5 12.5h2l1-2 1.5 4 1-2h1.5" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M3.5 9h17M12 9v11" />
      <path d="M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9Zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9Z" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
      <path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
      <path d="M8.5 14h.01M12 14h.01M15.5 14h.01" />
    </>
  ),
  car: (
    <>
      <path d="M4 15.5v-3l1.8-4.6a1.5 1.5 0 0 1 1.4-.9h9.6a1.5 1.5 0 0 1 1.4.9L20 12.5v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M4.5 12.5h15M7 16.5v2M17 16.5v2" />
      <path d="M7.5 14h.01M16.5 14h.01" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <path d="M4 7.5V17a2 2 0 0 0 2 2h12.5a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 8H6.5A2.5 2.5 0 0 1 4 7.5Z" />
      <path d="M16 13.5h.01" />
    </>
  ),
  file: (
    <>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5Z" />
      <path d="M14 3.5V8h4M9 12.5h6M9 16h6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrowLeft: <path d="M19 12H5m5-5-5 5 5 5" />,
  arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.75h.01" />
    </>
  ),
  approx: <path d="M5 10c2-2 4-2 7 0s5 2 7 0M5 15c2-2 4-2 7 0s5 2 7 0" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chat: (
    <>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="M8 10h8M8 13h5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3Z" />
      <path d="M12 10v4.5M12 17.25h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6.5A2 2 0 0 0 13 4.5H6.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2H9" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="m3.5 6.5 1 1 2-2M3.5 12l1 1 2-2M3.5 17.5l1 1 2-2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "h-5 w-5",
  label,
}: {
  name: IconName;
  className?: string;
  /** Accessible name; omit for decorative icons. */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
