/*
 * ClearTax SA service worker. Written by hand so it is small and easy to audit.
 *
 * What it does: after the first visit, keeps every file the app needs in the browser's cache, so the
 * calculator opens and works with no connection. What it does not do: it never touches requests to other
 * websites, never sends or stores anything the person types, and never caches POSTs. The list of files
 * and the version below are filled in by the build (vite/service-worker.ts); do not edit them by hand.
 */
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `cleartax-${VERSION}`;

self.addEventListener("install", (event) => {
  // The new version is stored in the background. It takes over once every tab using the old one is closed,
  // so a page never ends up with half of one version and half of another.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cleartax-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;
  event.respondWith(respond(request));
});

async function respond(request) {
  const cache = await caches.open(CACHE);
  // Every address is the same single-page app, so any page request is answered with the stored shell.
  if (request.mode === "navigate") return (await cache.match("/index.html")) ?? fetch(request);
  const stored = await cache.match(request);
  if (stored) return stored;
  const response = await fetch(request);
  // Files not in the list (a font subset, say) are kept the first time they are used.
  if (response.ok && response.type === "basic") cache.put(request, response.clone());
  return response;
}
