# Choosing the PDF library (PRD Q9, plan D20)

**Chosen: pdfmake 0.3** (MIT), loaded only when someone presses "Download PDF summary". This records how, so the choice can be
revisited with the same tests.

## What had to be true

The summary is made in the browser (PRD §14.8): real, selectable text; an embedded font; tables that run onto a second page
with their headings repeated; "Page X of Y"; no network; and it must run under the site's content policy, which has no
`unsafe-eval` (`apps/web/public/_headers`).

## The prototype

Two candidates were each given the same job: a 70-row table, A4, the app's Inter font with tabular figures, right-aligned
amounts, repeated headings and "Page X of Y". Both were built with the app's bundler and run in Chromium under the site's
exact content policy (served by `apps/web/scripts/serve.mjs`).

| | pdfmake 0.3.14 | jsPDF 4.2.1 + AutoTable 5.0.9 |
|---|---|---|
| Runs under the content policy, no violations | yes | yes |
| Text extracts (searchable, selectable) | yes | yes |
| Table heading repeats on each page | yes (`headerRows`) | yes (`showHead: "everyPage"`) |
| "Page X of Y" | built in (footer receives both numbers) | a second pass over the pages |
| Custom font | embedded and **subset** (about 20 KB file) | whole font file embedded (about 77 KB file) |
| Tagged PDF (for screen readers) | **yes** (`tagged: true`) | not supported |
| Layout | declarative tables, fills, borders, column spans | drawing calls plus a table plugin |
| Size, gzipped (loaded on demand) | **about 289 KB** | about 140 KB (plus optional pieces it never uses) |
| Metadata control | `info` (creator and producer settable) | `setProperties` |

pdfmake costs about 150 KB more to download, once, when someone first asks for a PDF (the service worker then keeps it for
offline use). jsPDF cannot tag a PDF, which matters for the accessibility work in Phase 22, and embeds the whole font. The
accessibility and layout fit decided it.

## The typeface

PDF libraries embed a font but do not apply OpenType features, so Inter's tabular figures (every digit the same width, so
amounts line up in a column) would be lost. `packages/pdf-export/scripts/make-fonts.py` builds `InterTabular-400.ttf` and
`-700.ttf` from the Inter files the app already ships, pointing only the digits 0 to 9 at their tabular glyphs and renaming
the result "Inter Tabular" (a modified version of Inter under the SIL Open Font License; the licence is in
`packages/pdf-export/fonts/LICENSE-Inter.txt`). An earlier version changed punctuation too, which spread out hyphens; only
digits change now.

## Looking at the output without a PDF viewer

Tests read PDFs back with pdf.js (`packages/pdf-export/src/testing.ts`): text per page, the file's metadata, embedded fonts,
tagging. To *see* a page, render it with PyMuPDF (`pip install pymupdf`, then `page.get_pixmap(dpi=100).save("page.png")`).
The reference layout is `docs/reference/summary-example.pdf` (a SARS-style result; we follow its section structure and table
style, never its logo, codes or reference numbers: PRD Appendix C).
