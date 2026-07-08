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
  return m ? m[0] : t;
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Longest date string decides the column width: measured, not guessed.
const longestDate = D.reduce((a, e) => Math.max(a, String(e[1]).length), 0);
const dateColIn = Math.min(1.7, Math.max(1.3, 0.085 * longestDate)).toFixed(2);
const dateColPt = (parseFloat(dateColIn) * 72).toFixed(1);
const dateTextPt = (parseFloat(dateColPt) - 8).toFixed(1);
const leftPadPt = (parseFloat(dateColPt) + 12 + 9).toFixed(1);

const sections = [9, 8, 7, 6, 5, 4, 3, 2, 1]  // tier 0 (Elementary + Middle School) never prints
  .map((i) => ({ i, items: D.filter((x) => x[0] === i && !tagsOf(x[2]).includes("seminarschools")) }))
  .filter((g) => g.items.length > 0);

const rows = (items) =>
  items
    .map((item) => {
      const cert = isCert(item);
      const color = (CATS[primaryTag(item[2])] || {}).color || "#999";
      const title = esc(item[3].en);
      const titleLen = String(item[3].en).length;
      let noteRaw = (item[4] && item[4].en && item[4].en.trim())
        ? String(item[4].en).trim()
        : (item[6] && item[6].en && item[6].en.trim() ? firstSentence(item[6].en) : null);
      if (noteRaw && noteRaw.length > 72 - titleLen) noteRaw = null;
      const note = noteRaw ? esc(noteRaw) : null;
      return `<div class="row">
  <span class="d">${esc(item[1])}</span><span class="o"><span class="dot${cert ? " sq" : ""}" style="background-color:${color}"></span></span>
  <div class="b">${cert ? '<span class="caret">&#8227;</span> ' : ""}<span class="t${cert ? " tc" : ""}">${title}</span>${note ? ` <span class="n">${note}</span>` : ""}</div>
</div>`;
    })
    .join("\n");

const summary = "Toronto-based worker with experience across hospitality, community work, teaching, curriculum, performance, research, writing, and public projects. Brings adaptable communication, service, organization, cross-cultural work, and project-building experience to general employment and hybrid roles.";
const competencies = ["Resource Planning & Allocation","Consultation & Guidance Expertise","Policy & Procedure Development","Social & Economic Impact Assessment","Team Development & Leadership","Basic French, Farsi, & Mandarin","Key Performance Indicator (KPI) tracking & Continuous Process Improvement"];

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
<title>Saul Karim Nassau &middot; Employment CV</title>
<style>
  @page { size: A4; margin: 0.38in 0.46in; }
  html, body { margin:0; padding:0; background-color:#ffffff; }
  body { font-family: Georgia, 'Times New Roman', 'Liberation Serif', serif; color:#1d1d1d; }
  .hd { display:flex; align-items:flex-end; justify-content:space-between; gap:18pt; border-bottom:1.5px solid #7A2632; padding-bottom:7pt; margin-bottom:5pt; }
  .hd .contact { text-align:right; }
  .hd h1 { font-variant:small-caps; font-weight:600; letter-spacing:3.5px; font-size:20pt; color:#5A1A24; margin:0; }
  .hd h1 .post { font-size:10pt; letter-spacing:2px; color:#7A2632; }
  .hd .meta { font-size:8.8pt; letter-spacing:1px; color:#2a2a2a; margin:2pt 0; }
  .hd .em { font-size:8.3pt; letter-spacing:0.8px; color:#46383a; margin-top:3.5pt; }
  .summary { margin:6pt 0 5pt; font-size:8pt; line-height:1.36; color:#272727; }
  .skills { margin:0 0 6pt; font-size:8pt; line-height:1.35; color:#424242; }
  .skills .m { color:#7A2632; margin:0 4pt; }
  .sec { margin-top:8pt; }
  .sh { font-variant:small-caps; letter-spacing:2.2px; font-size:8.3pt; color:#7A2632;
        border-bottom:1px solid #9b5560; padding-bottom:2pt; margin-bottom:4pt;
        page-break-after:avoid; }
  .elist { width:100%; }
  .row { position:relative; page-break-inside:avoid; padding:2.2pt 0 2.2pt ${leftPadPt}pt; }
  .row::before { content:""; position:absolute; left:${dateColPt}pt; top:0; bottom:0;
                 width:1px; background:#d9c6c9; }
  .row .d { position:absolute; left:0; top:3pt; width:${dateTextPt}pt; text-align:right;
            white-space:nowrap; font-size:8.3pt; color:#3a3a3a; }
  .row .o { position:absolute; left:${dateColPt}pt; top:6.5pt; width:12pt;
            text-align:center; line-height:0; }
  .dot { display:inline-block; width:5px; height:5px; border-radius:50%; }
  .dot.sq { border-radius:1px; }
  .row .b { font-size:9.8pt; line-height:1.24;
            overflow-wrap:break-word; word-wrap:break-word; }
  .t { font-weight:bold; color:#161616; }
  .t.tc { font-weight:600; color:#33272a; }
  .caret { color:#7A2632; }
  .n { font-style:italic; color:#564a4c; font-size:8.3pt; }
  .cred { margin-top:8pt; border-top:0.75px solid #c4a8ab; padding-top:5pt;
          page-break-inside:avoid; }
  .cred .ch { font-variant:small-caps; letter-spacing:1.8px; font-size:9.5pt;
              color:#7A2632; margin:0 0 4pt; }
  .cred .cb { font-size:8.3pt; line-height:1.5; color:#2c2c2c; }
  .cred .colh { display:inline-block; vertical-align:top; width:48%; margin-right:2%; }
  .cred .colh .ci { display:block; padding:0.6pt 0 0.6pt 9pt; text-indent:-9pt; line-height:1.5; }
  .cred .colh .ci::before { content:"\\2023\\00a0"; color:#7A2632; }
</style>
</head>
<body>
<div class="hd">
  <h1>Saul Karim Nassau <span class="post">MA</span></h1>
  <div class="contact">
    <div class="meta">416-771-0382 &middot; Toronto</div>
    <div class="em">saulnassau@protonmail.com &middot; seminarschools.com/saul/</div>
  </div>
</div>
<div class="summary">${esc(summary)}</div>
<div class="skills">${competencies.map((c, i) => `${i ? '<span class="m">▪</span>' : ''}${esc(c)}`).join(' ')}</div>
${sectionHtml}
<div class="cred">
  <div class="ch">${esc(t.certs)}</div>
  <div class="cb">${(() => { const ci = String(t.certL).split(/\s*[·、]\s*/).filter(Boolean); const h = Math.ceil(ci.length / 2); const col = (a) => `<div class="colh">${a.map((i) => `<span class="ci">${esc(i)}</span>`).join("")}</div>`; return col(ci.slice(0, h)) + col(ci.slice(h)); })()}</div>
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
