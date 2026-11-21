import { describe, expect, it } from "vitest";
import { precacheList, versionOf } from "./service-worker.ts";

describe("service worker file list", () => {
  const files = [
    "index.html",
    "assets/index-abc.js",
    "assets/index-abc.css",
    "assets/Results-def.js",
    "assets/inter-latin-wght-normal-x.woff2",
    "assets/inter-latin-ext-wght-normal-x.woff2",
    "assets/inter-cyrillic-wght-normal-x.woff2",
    "assets/plus-jakarta-sans-vietnamese-wght-normal-x.woff2",
    "favicon.svg",
    "manifest.webmanifest",
    "sw.js",
    "_headers",
    "_redirects",
    "robots.txt",
  ];

  it("keeps everything the app needs", () => {
    const list = precacheList(files);
    for (const needed of ["/index.html", "/assets/index-abc.js", "/assets/index-abc.css", "/assets/Results-def.js", "/favicon.svg", "/manifest.webmanifest"]) {
      expect(list).toContain(needed);
    }
  });

  it("keeps the English fonts, and leaves the other alphabets until they are used", () => {
    const list = precacheList(files);
    expect(list).toContain("/assets/inter-latin-wght-normal-x.woff2");
    expect(list).toContain("/assets/inter-latin-ext-wght-normal-x.woff2");
    expect(list.some((f) => f.includes("cyrillic") || f.includes("vietnamese"))).toBe(false);
  });

  it("never stores the service worker itself or the host's own files", () => {
    const list = precacheList(files);
    for (const f of ["/sw.js", "/_headers", "/_redirects", "/robots.txt"]) expect(list).not.toContain(f);
  });

  it("gives every build a version that changes with any file", () => {
    const a = [{ name: "/a.js", content: Buffer.from("one") }, { name: "/b.css", content: Buffer.from("two") }];
    const same = versionOf([...a].reverse());
    expect(same).toBe(versionOf(a));
    expect(versionOf([a[0]!, { name: "/b.css", content: Buffer.from("changed") }])).not.toBe(same);
    expect(versionOf([a[0]!, { name: "/c.css", content: Buffer.from("two") }])).not.toBe(same);
    expect(same).toMatch(/^[0-9a-f]{12}$/);
  });
});
