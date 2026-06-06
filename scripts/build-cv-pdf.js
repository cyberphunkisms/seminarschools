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

const firstSentence = (txt) => {
  const t = String(txt).trim();
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  let out = m ? m[0] : t;
  if (out.length > 140) {
    out = out.slice(0, 120);
    out = out.slice(0, out.lastIndexOf(" ")) + "\u2026";
  }
  return out;
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Longest date string decides the column width: measured, not guessed.
const longestDate = D.reduce((a, e) => Math.max(a, String(e[1]).length), 0);
const dateColIn = Math.min(1.7, Math.max(1.3, 0.085 * longestDate)).toFixed(2);
const dateColPt = (parseFloat(dateColIn) * 72).toFixed(1);
const dateTextPt = (parseFloat(dateColPt) - 8).toFixed(1);
const leftPadPt = (parseFloat(dateColPt) + 12 + 9).toFixed(1);

const sections = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  .map((i) => ({ i, items: D.filter((x) => x[0] === i && !tagsOf(x[2]).includes("seminarschools")) }))
  .filter((g) => g.items.length > 0);

const rows = (items) =>
  items
    .map((item) => {
      const cert = isCert(item);
      const color = (CATS[primaryTag(item[2])] || {}).color || "#999";
      const title = esc(item[3].en);
      const note = (item[4] && item[4].en && item[4].en.trim())
        ? esc(item[4].en)
        : (item[6] && item[6].en && item[6].en.trim() ? esc(firstSentence(item[6].en)) : null);
      return `<div class="row">
  <span class="d">${esc(item[1])}</span><span class="o"><span class="dot${cert ? " sq" : ""}" style="background-color:${color}"></span></span>
  <div class="b">${cert ? '<span class="caret">&#8227;</span> ' : ""}<span class="t${cert ? " tc" : ""}">${title}</span>${note ? ` <span class="n">${note}</span>` : ""}</div>
</div>`;
    })
    .join("\n");

const sectionHtml = sections
  .map(
    (g) => `<div class="sec">
<div class="sh">${esc(t.secs[g.i])}</div>
<div class="elist">
${rows(g.items)}
</div>
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
  .elist { width:100%; }
  .row { position:relative; page-break-inside:avoid; padding:3pt 0 3pt ${leftPadPt}pt; }
  .row::before { content:""; position:absolute; left:${dateColPt}pt; top:0; bottom:0;
                 width:1px; background:#d9c6c9; }
  .row .d { position:absolute; left:0; top:3pt; width:${dateTextPt}pt; text-align:right;
            white-space:nowrap; font-size:9pt; color:#3a3a3a; }
  .row .o { position:absolute; left:${dateColPt}pt; top:6.5pt; width:12pt;
            text-align:center; line-height:0; }
  .dot { display:inline-block; width:5px; height:5px; border-radius:50%; }
  .dot.sq { border-radius:1px; }
  .row .b { font-size:11pt; line-height:1.32;
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
