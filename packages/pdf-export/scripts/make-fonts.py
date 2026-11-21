"""
Makes the two PDF fonts (fonts/InterTabular-400.ttf and -700.ttf) from the Inter files the app already ships.

Why: PDF libraries embed a font but do not apply OpenType features, so Inter's tabular figures (the `tnum` feature, which
makes every digit the same width so amounts line up in a column) would be lost. This bakes them in: the digits 0-9 are
pointed at their tabular glyphs, and nothing else changes. The result is renamed "Inter Tabular" (a modified version of Inter,
SIL Open Font License 1.1; see fonts/LICENSE-Inter.txt).

Run:   pip install fonttools brotli
       python scripts/make-fonts.py path/to/@fontsource/inter/files
The input files are inter-latin-400-normal.woff and inter-latin-700-normal.woff (npm package @fontsource/inter).
"""
import os
import sys
from fontTools.ttLib import TTFont

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), "..", "fonts")
DIGITS = range(ord("0"), ord("9") + 1)

for weight, style in (("400", "Regular"), ("700", "Bold")):
    f = TTFont(os.path.join(src, f"inter-latin-{weight}-normal.woff"))
    f.flavor = None  # plain TrueType, which PDF libraries read
    gsub = f["GSUB"].table
    lookups = {i for fr in gsub.FeatureList.FeatureRecord if fr.FeatureTag == "tnum" for i in fr.Feature.LookupListIndex}
    tabular = {}
    for i in lookups:
        for sub in gsub.LookupList.Lookup[i].SubTable:
            sub = getattr(sub, "ExtSubTable", sub)
            tabular.update(getattr(sub, "mapping", {}))
    for table in f["cmap"].tables:
        for cp in DIGITS:
            glyph = table.cmap.get(cp)
            if glyph in tabular:
                table.cmap[cp] = tabular[glyph]
    cmap = f["cmap"].getBestCmap()
    widths = {f["hmtx"][cmap[cp]][0] for cp in DIGITS}
    assert len(widths) == 1, f"digits are not all the same width: {widths}"
    for rec in f["name"].names:
        if rec.nameID in (1, 16):
            rec.string = "Inter Tabular"
        elif rec.nameID == 4:
            rec.string = f"Inter Tabular {style}" if style != "Regular" else "Inter Tabular"
        elif rec.nameID == 6:
            rec.string = f"InterTabular-{style}"
    f.save(os.path.join(out, f"InterTabular-{weight}.ttf"))
    print(weight, "digit width", widths.pop())
