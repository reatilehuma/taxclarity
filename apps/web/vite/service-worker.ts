import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

/** Files the browser keeps after the first visit. Everything the landing page and the wizard need, nothing else. */
export function precacheList(files: string[]): string[] {
  const skip = new Set(["sw.js", "_headers", "_redirects", "robots.txt"]);
  return files
    .filter((f) => !skip.has(f))
    // Only the Latin font files are needed for English; other scripts are kept only if ever used.
    .filter((f) => !/\.woff2$/.test(f) || /-latin(-ext)?-/.test(f))
    .map((f) => (f === "index.html" ? "/index.html" : `/${f}`))
    .sort();
}

/** A short fingerprint of the stored files, so any change to any of them makes a new version. */
export function versionOf(files: { name: string; content: Buffer }[]): string {
  const hash = createHash("sha256");
  for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) hash.update(f.name).update(f.content);
  return hash.digest("hex").slice(0, 12);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** After the build, writes dist/sw.js: the template with this build's file list and version filled in. */
export function serviceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "cleartax-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const root = join(process.cwd(), outDir);
      const files = walk(root).map((full) => relative(root, full).split(sep).join("/"));
      const list = precacheList(files);
      const version = versionOf(
        list.map((p) => ({ name: p, content: readFileSync(join(root, p === "/index.html" ? "index.html" : p.slice(1))) })),
      );
      const template = readFileSync(join(process.cwd(), "sw", "sw.template.js"), "utf8");
      writeFileSync(
        join(root, "sw.js"),
        template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(["/", ...list], null, 2)),
      );
    },
  };
}
