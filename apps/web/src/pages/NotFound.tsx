import { ButtonLink, Container } from "../components/ui.tsx";
import { Icon } from "../components/Icon.tsx";
import { copy } from "../content/strings.ts";
import { useDocumentTitle } from "../hooks/useDocumentTitle.ts";

export function NotFound() {
  const n = copy.notFound;
  useDocumentTitle(n.title);
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-lg rounded-[var(--radius-card)] bg-surface p-8 text-center shadow-[var(--shadow-card)] ring-1 ring-ink-200/70 sm:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon name="info" className="h-7 w-7" />
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink-950">{n.title}</h1>
        <p className="mt-3 text-ink-600">{n.body}</p>
        <div className="mt-8">
          <ButtonLink to="/">{n.home}</ButtonLink>
        </div>
      </div>
    </Container>
  );
}
