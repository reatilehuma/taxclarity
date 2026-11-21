// A small static server for the production build, used by the browser tests, the privacy check and Lighthouse.
// It applies dist/_headers (the same file a real host reads), compresses text, and sends every unknown path
// to the single-page app, so what runs here behaves like the deployed site.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const port = Number(flag("--port", "4173"));
const root = resolve(flag("--dir", "dist"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json)|image\/svg)/;

/** Netlify-style _headers: a path pattern, then indented "Name: value" lines. */
function parseHeaders(text) {
  const rules = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (/^\S/.test(raw)) {
      current = { pattern: raw.trim(), headers: [] };
      rules.push(current);
    } else if (current) {
      const i = raw.indexOf(":");
      current.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
    }
  }
  return rules;
}
const headerFile = join(root, "_headers");
const rules = existsSync(headerFile) ? parseHeaders(readFileSync(headerFile, "utf8")) : [];
const matches = (pattern, path) => {
  if (pattern === path) return true;
  if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -1));
  return false;
};

// The assistant's proxy runs here exactly as it does on the host (functions/api/assistant.ts), with the settings
// from the environment: ANTHROPIC_API_KEY, or ASSISTANT_FAKE_MODEL=1 for tests.

async function runProxy(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  // Loaded on first use, so the plain file server starts at once.
  const proxy = await import("@taxclarity/assistant-proxy");
  const response = await proxy.handleWithEnv(request, process.env);
  const out = {};
  response.headers.forEach((v, k) => (out[k] = v));
  res.writeHead(response.status, { ...applyHeaders("/api/assistant"), ...out });
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Headers from _headers for a path (the same rules the page files get). */
function applyHeaders(path) {
  const headers = {};
  for (const rule of rules) if (matches(rule.pattern, path)) for (const [name, value] of rule.headers) headers[name.toLowerCase()] = value;
  return headers;
}

createServer((req, res) => {
  if (new URL(req.url ?? "/", "http://x").pathname === "/api/assistant") {
    runProxy(req, res).catch(() => res.writeHead(500).end());
    return;
  }
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  let path = decodeURIComponent(url.pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // A missing file with an extension is a real 404 (so a stale link to old build files fails loudly);
    // anything else is a page inside the single-page app.
    if (extname(path)) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    path = "/index.html";
    file = join(root, "index.html");
  }
  const type = TYPES[extname(file)] ?? "application/octet-stream";
  const headers = { "content-type": type };
  const requested = url.pathname === "/" ? "/" : url.pathname;
  for (const rule of rules) {
    if (matches(rule.pattern, requested) || matches(rule.pattern, path)) {
      for (const [name, value] of rule.headers) headers[name.toLowerCase()] = value;
    }
  }
  let body = readFileSync(file);
  if (COMPRESSIBLE.test(type) && String(req.headers["accept-encoding"] ?? "").includes("gzip")) {
    body = gzipSync(body, { level: 9 });
    headers["content-encoding"] = "gzip";
    headers.vary = "Accept-Encoding";
  }
  headers["content-length"] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
