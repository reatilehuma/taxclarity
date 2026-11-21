import { use, type ComponentType } from "react";

/**
 * A page that is downloaded only when it is first needed, and can also be fetched ahead of time
 * (`preload`), for instance when the pointer reaches the button that leads to it. Once it has loaded it
 * renders at once, with no loading flash. Until then, the nearest <Suspense> shows its fallback.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>) {
  type Tracked = Promise<ComponentType<P>> & { status?: "fulfilled" | "rejected"; value?: ComponentType<P>; reason?: unknown };
  let started: Tracked | null = null;

  /** Starts the download if it has not started. Safe to call as often as you like. */
  function preload(): Promise<ComponentType<P>> {
    if (!started) {
      const p: Tracked = load();
      // React reads these two fields to know a promise has already finished, so it can skip suspending.
      p.then(
        (component) => {
          p.status = "fulfilled";
          p.value = component;
        },
        (reason: unknown) => {
          p.status = "rejected";
          p.reason = reason;
          started = null; // try again next time rather than failing for ever
        },
      );
      started = p;
    }
    return started;
  }

  function Page(props: P) {
    const Component = use(preload());
    return <Component {...props} />;
  }

  return { Page, preload };
}
