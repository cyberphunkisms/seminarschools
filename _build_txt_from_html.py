#!/usr/bin/env python3
"""_build_txt_from_html.py

Regenerate the plain-text mirror of the methodologylist (ml*) HTML SEED.

The HTML SEED is canonical. The .txt is derived. This script parses the SEED
array out of the HTML, lets node perform exact JS string-literal unescaping
(JSON round-trip), groups entries by section in the canonical emit order, and
writes the .txt dump in the established mirror format.

Run from site root:  python3 _build_txt_from_html.py
"""
import json
import os
import subprocess
import sys
import tempfile
from collections import Counter

HTML = "polymyth/methodologylist/index.html"
TXT = "polymyth/methodologylist.txt"

# Canonical section emit order for the .txt body (derived from the shipped
# mirror). Sections present in SEED but absent here append alphabetically.
SECTION_ORDER = [
    "methodology", "gorgonification", "degorgonification", "analysis",
    "sabachtan", "idiomary", "citation", "studylist", "rainbowsol",
    "polycognate", "learnings", "coreplus", "pending",
    "pending-user-authorship",
]

NODE_EXTRACT = r"""
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const s = html.indexOf('const SEED = [');
if (s < 0) { console.error('SEED not found'); process.exit(2); }
const open = html.indexOf('[', s);
const close = html.indexOf('\n];', s);
const ctx = {};
vm.createContext(ctx);
vm.runInContext('var SEED = ' + html.slice(open, close) + '];', ctx);
// surface array holes loudly rather than silently dropping them
let holes = 0;
for (let i = 0; i < ctx.SEED.length; i++) if (!(i in ctx.SEED)) holes++;
if (holes) { console.error('ARRAY HOLES: ' + holes); process.exit(3); }
process.stdout.write(JSON.stringify(ctx.SEED));
"""


def extract_seed(html_path):
    with tempfile.NamedTemporaryFile("w", suffix=".cjs", delete=False) as fh:
        fh.write(NODE_EXTRACT)
        helper = fh.name
    try:
        out = subprocess.run(
            ["node", helper, html_path],
            capture_output=True, text=True, check=True,
        )
    finally:
        os.unlink(helper)
    return json.loads(out.stdout)


def render(seed):
    counts = Counter(e["s"] for e in seed)
    sec_header = ", ".join(f"{k}({counts[k]})" for k in sorted(counts))
    order = SECTION_ORDER + [k for k in sorted(counts) if k not in SECTION_ORDER]

    lines = []
    lines.append("Polymyth Methodologylist \u2014 text mirror")
    lines.append("Sections: " + sec_header)
    lines.append("Total entries: %d" % len(seed))
    lines.append("")
    for sec in order:
        if counts.get(sec, 0) == 0:
            continue
        lines.append("=== %s (%d entries) ===" % (sec.upper(), counts[sec]))
        lines.append("")
        for e in seed:
            if e["s"] != sec:
                continue
            t = (e.get("t") or "").rstrip()
            b = (e.get("b") or "").rstrip()
            x = (e.get("x") or "").rstrip()
            tg = (e.get("tg") or "").rstrip()
            lines.append(("[%s] %s" % (e.get("r", ""), t)).rstrip())
            lines.append(b)
            if x:
                lines.append("")
                lines.append(x)
            lines.append(("  tags: %s" % tg).rstrip())
            lines.append("")
    return "\n".join(lines)


def atomic_write(path, text):
    d = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def main():
    dry = "--dry" in sys.argv
    out_override = None
    for a in sys.argv[1:]:
        if a.startswith("--out="):
            out_override = a.split("=", 1)[1]
    seed = extract_seed(HTML)
    text = render(seed)
    target = out_override or TXT
    if dry:
        sys.stdout.write(text)
        return
    atomic_write(target, text)
    sys.stderr.write("wrote %s (%d entries, %d bytes)\n"
                     % (target, len(seed), len(text.encode("utf-8"))))


if __name__ == "__main__":
    main()
