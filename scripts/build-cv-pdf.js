#!/usr/bin/env node
/* build-cv-pdf.js
   Generates the static CV print document from the live data in saul/index.html.
   Output: /tmp/cv-print.html (render with wkhtmltopdf; ship the PDF at saul/cv.pdf).

   Design constraints (hard-won, do not regress):
   - No flexbox anywhere: wkhtmltopdf (Qt WebKit) misrenders flex. Tables with explicit
     column widths only.
   - No overflow rules on html/body: overflow-x:hidden forces a vertical scrollbar that
     wkhtmltopdf bakes into the PDF over the right edge.
   - No fixed heights + overflow:hidden page chassis: silent content loss.
   - System serif stack only (Georgia first): web fonts gate rendering and are blocked
     in sandboxes; the layout must be font-independent.
   - Date column: single line guaranteed (nowrap, fixed width sized to the longest
     date string), right-aligned, so every body column starts at the same x.
   - background-color, never the background shorthand.
   - Render with --disable-smart-shrinking and explicit Letter margins.
*/
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const SRC = path.join(__dirname, "..", "saul", "index.html");
const OUT = "/tmp/cv-print.html";

const src = fs.readFileSync(SRC, "utf8");

function slice(re, label) {
  const m = src.match(re);
  if (!m) throw new Error("could not slice " + label);
  return vm.runInNewContext("(" + m[1] + ")");
}

const D = slice(/const D = (\[[\s\S]*?\n\]);/, "D");
const UI = slice(/const UI = (\{[\s\S]*?\n\});/, "UI");
const CATS = slice(/const CATS = (\{[\s\S]*?\n\});/, "CATS");

const t = UI.en;
const tagsOf = (c) => (Array.isArray(c) ? c : [c]);
const primaryTag = (c) => tagsOf(c)[0];
const isCert = (item) =>
  tagsOf(item[2]).includes("education") &&
  /Certif|Certificate|Bootcamp|Machine Learning A-Z|Practitioner|TESOL|Bronze Cross/.test(item[3].en);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Longest date string decides the column width: measured, not guessed.
const longestDate = D.reduce((a, e) => Math.max(a, String(e[1]).length), 0);
const dateColIn = Math.min(1.7, Math.max(1.3, 0.085 * longestDate)).toFixed(2);

const sections = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  .map((i) => ({ i, items: D.filter((x) => x[0] === i) }))
  .filter((g) => g.items.length > 0);

const rows = (items) =>
  items
    .map((item) => {
      const cert = isCert(item);
      const color = (CATS[primaryTag(item[2])] || {}).color || "#999";
      const title = esc(item[3].en);
      const note = item[4] ? esc(item[4].en) : null;
      return `<tr>
  <td class="d">${esc(item[1])}</td>
  <td class="o"><span class="dot${cert ? " sq" : ""}" style="background-color:${color}"></span></td>
  <td class="b">${cert ? '<span class="caret">&#8227;</span> ' : ""}<span class="t${cert ? " tc" : ""}">${title}</span>${note ? ` <span class="n">${note}</span>` : ""}</td>
</tr>`;
    })
    .join("\n");

const sectionHtml = sections
  .map(
    (g) => `<div class="sec">
<div class="sh">${esc(t.secs[g.i])}</div>
<table class="e">
<colgroup><col style="width:${dateColIn}in"><col style="width:16px"><col></colgroup>
${rows(g.items)}
</table>
</div>`
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Saul Karim NMH &middot; CV</title>
<style>
  html, body { margin:0; padding:0; background-color:#ffffff; }
  body { font-family: Georgia, 'Times New Roman', 'Liberation Serif', serif; color:#1d1d1d; }
  .hd { text-align:center; border-bottom:1.5px solid #7A2632; padding-bottom:9pt; margin-bottom:4pt; }
  .hd h1 { font-variant:small-caps; font-weight:600; letter-spacing:3.5px; font-size:22pt; color:#5A1A24; margin:0 0 3pt; }
  .hd h1 .post { font-size:11.5pt; letter-spacing:2px; color:#7A2632; }
  .hd .meta { font-size:10.5pt; letter-spacing:0.6px; color:#2a2a2a; margin:1pt 0; }
  .hd .em { font-size:9pt; letter-spacing:0.8px; color:#46383a; margin-top:2pt; }
  .sec { margin-top:11pt; }
  .sh { font-variant:small-caps; letter-spacing:2.2px; font-size:10pt; color:#7A2632;
        border-bottom:1px solid #9b5560; padding-bottom:2pt; margin-bottom:4pt;
        page-break-after:avoid; }
  table.e { width:100%; border-collapse:collapse; table-layout:fixed; }
  table.e tr { page-break-inside:avoid; }
  td { vertical-align:top; }
  td.d { text-align:right; white-space:nowrap; font-size:9pt; color:#3a3a3a;
         padding:3pt 8pt 3pt 0; border-right:1px solid #d9c6c9; }
  td.o { text-align:center; padding-top:6.5pt; }
  .dot { display:inline-block; width:5px; height:5px; border-radius:50%; }
  .dot.sq { border-radius:1px; }
  td.b { padding:3pt 0 3pt 9pt; font-size:11pt; line-height:1.32;
         overflow-wrap:break-word; word-wrap:break-word; }
  .t { font-weight:bold; color:#161616; }
  .t.tc { font-weight:600; color:#33272a; }
  .caret { color:#7A2632; }
  .n { font-style:italic; color:#564a4c; font-size:10pt; }
  .cred { margin-top:13pt; border-top:0.75px solid #c4a8ab; padding-top:7pt;
          page-break-inside:avoid; }
  .cred .ch { font-variant:small-caps; letter-spacing:1.8px; font-size:9.5pt;
              color:#7A2632; margin:0 0 3pt; }
  .cred .cb { font-size:9pt; line-height:1.55; color:#2c2c2c; }
</style>
</head>
<body>
<div class="hd">
  <h1>Saul Karim NMH <span class="post">MA</span></h1>
  <div class="meta">416-771-0382 &middot; Toronto</div>
  <div class="em">saulnassau@protonmail.com</div>
</div>
${sectionHtml}
<div class="cred">
  <div class="ch">${esc(t.certs)}</div>
  <div class="cb">${esc(t.certL)}</div>
</div>
<div class="cred">
  <div class="ch">${esc(t.edu)}</div>
  <div class="cb">${esc(t.eduL)}</div>
</div>
</body>
</html>
`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`wrote ${OUT}: ${sections.length} sections, ${D.length} entries, date col ${dateColIn}in (longest date ${longestDate} chars)`);
