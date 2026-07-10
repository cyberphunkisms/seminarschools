#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BUILD = '20260710-reviews-zoom-font-a'
GLOBAL_LINK = f'<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={BUILD}" data-site-wide-type-zoom="{BUILD}">'

css = r'''/* ========================================================================
   SITE-WIDE TYPOGRAPHY + ZOOM CONTRACT — 2026-07-10
   Loaded last on every HTML document. It preserves each page's visual voice
   while enforcing readable type, graceful wrapping, and reflow from narrow
   mobile widths through high browser zoom and very wide zoomed-out views.
   ======================================================================== */
:root {
  --ss-serif-fallback: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --ss-sans-fallback: Inter, Aptos, "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --ss-mono-fallback: "JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --ss-reading-measure: 72ch;
}
html {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  font-size: clamp(15.5px, 0.955rem + 0.08vw, 17px);
  font-kerning: normal;
  font-optical-sizing: auto;
  text-rendering: optimizeLegibility;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
*, *::before, *::after { box-sizing: inherit; }
body {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
  font-kerning: normal;
  font-synthesis: none;
  font-variant-ligatures: common-ligatures contextual;
}
:where(button, input, select, textarea) { font-family: inherit; }
:where(p, li, dd, figcaption, blockquote) {
  line-height: 1.62;
  text-wrap: pretty;
  overflow-wrap: break-word;
  word-break: normal;
  hyphens: none;
  orphans: 3;
  widows: 3;
}
:where(h1, h2, h3, h4, h5, h6) {
  max-width: 100%;
  line-height: 1.08;
  text-wrap: balance;
  overflow-wrap: break-word;
  word-break: normal;
  hyphens: none;
  font-kerning: normal;
  font-optical-sizing: auto;
}
:where(a, button, label, summary, .title, .lede, .dek, .meta, .tag, .pill, .chip) {
  word-break: normal;
  hyphens: none;
}
:where(a[href^="http"], a[href^="mailto:"], .url, .source, .slug, .breadcrumbs, code) {
  overflow-wrap: anywhere;
  word-break: break-word;
}
:where(.eyebrow, .kicker, .overline, .meta, .caption, small, .tag, .type-tag, .pill, .chip) {
  font-size: max(0.72rem, 0.72em);
  line-height: 1.45;
}
:where(main, article, section, header, footer, nav, aside,
  .page, .wrap, .shell, .container, .layout, .content, .panel,
  .card, .tile, .entry, .event, .lecture, .resource-card, .resource-row) {
  min-width: 0;
  max-width: 100%;
}
:where(.prose, .article-body, .post-body, .copy, .reading-column) {
  max-width: min(100%, var(--ss-reading-measure));
}
:where(img, picture, video, canvas, svg, iframe, object, embed) {
  max-width: 100%;
}
:where(img, video, canvas) { height: auto; }
:where(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
:where(table) {
  max-width: 100%;
  border-collapse: collapse;
}
:where(th, td) {
  overflow-wrap: break-word;
  word-break: normal;
  hyphens: none;
}
:where(.grid, .cards, .tiles, .columns, .deck, .card-grid, .resource-grid,
  .feature-grid, .proof-grid, .course-grid, .chapter-grid, .door-grid,
  .bb-doors, .quick-guide, .work-grid, .quick-views) > * {
  min-width: 0;
  max-width: 100%;
}
:where(.card-grid, .resource-grid, .feature-grid, .proof-grid, .course-grid,
  .chapter-grid, .door-grid, .bb-doors) {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
}
:where(.button, .btn, button, [role="button"], input[type="button"], input[type="submit"]) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 1.25;
}

/* The CV had four cards and a two-column hero below their comfortable widths.
   These breakpoints also respond naturally when browser zoom reduces the CSS
   viewport, keeping words intact instead of producing letter-by-letter stacks. */
@media screen and (max-width: 1060px) {
  body[data-route-type="cv"] .work-grid,
  body[data-route-type="cv"] .quick-views {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
@media screen and (max-width: 920px) {
  body[data-route-type="cv"] .cv-intro,
  body[data-route-type="cv"] .archive-heading {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  body[data-route-type="cv"] .cv-portrait-card {
    width: min(100%, 420px);
  }
  body[data-route-type="cv"] header.cv-header .cv-head-row {
    display: block !important;
  }
  body[data-route-type="cv"] header.cv-header .cv-contact,
  body[data-route-type="cv"] .cv-header-email {
    text-align: left !important;
  }
  body[data-route-type="cv"] .section-intro {
    display: block !important;
  }
  body[data-route-type="cv"] .section-intro > p {
    margin-top: 0.75rem !important;
  }
}
@media screen and (max-width: 620px) {
  body[data-route-type="cv"] .work-grid,
  body[data-route-type="cv"] .quick-views {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  body[data-route-type="cv"] .cv-actions,
  body[data-route-type="cv"] .view-switcher {
    flex-direction: column;
    align-items: stretch;
  }
  body[data-route-type="cv"] .cv-action,
  body[data-route-type="cv"] .view-switcher button {
    width: 100%;
    justify-content: center;
  }
}

/* High zoom commonly converts wide tables and toolbars into narrow surfaces. */
@media screen and (max-width: 820px) {
  :where(.topbar, .toolbar, .controls, .filter-nav, .nav-links, .quick-links,
    .command-toolbar, .desktop-commands, .actions, .button-row, .cta-row) {
    flex-wrap: wrap;
    white-space: normal;
  }
  :where(.table-wrap, .scroll-shell) {
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
@media screen and (max-width: 560px) {
  :where(.page, .wrap, .shell, .container, main) {
    padding-left: min(1rem, 4vw);
    padding-right: min(1rem, 4vw);
  }
  :where(h1) { letter-spacing: -0.015em; }
  :where(.eyebrow, .kicker, .overline) { letter-spacing: 0.11em; }
}
@media print {
  html { font-size: 11pt; }
  body { overflow: visible; }
  :where(h1, h2, h3, h4, h5, h6) { text-wrap: wrap; }
}
'''
(ROOT / 'css' / 'site-wide-type-zoom.css').write_text(css, encoding='utf-8')

reviews_html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Reviews, references, and testimonials for Saul Karim Nassau and Seminar Schools.">
<title>Reviews, References &amp; Testimonials | Saul Karim Nassau</title>
<link rel="canonical" href="https://seminarschools.com/reviews/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://seminarschools.com/reviews/">
<meta property="og:title" content="Reviews, References &amp; Testimonials | Saul Karim Nassau">
<meta property="og:description" content="Professional reviews, references, and testimonials for Saul Karim Nassau and Seminar Schools.">
<meta property="og:image" content="https://seminarschools.com/og-image.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&family=Libre+Baskerville:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
<style>
:root{{--bg:#17110e;--panel:#201713;--ink:#eee1c6;--muted:#b9aa98;--line:rgba(238,225,198,.2);--accent:#d47c59;--serif:'Cormorant Garamond',Georgia,serif;--body:'Libre Baskerville',Georgia,serif;--sans:'DM Sans',system-ui,sans-serif}}
*{{box-sizing:border-box}}
html{{background:var(--bg);color:var(--ink)}}
body{{margin:0;min-height:100vh;background:radial-gradient(circle at 78% 12%,rgba(212,124,89,.09),transparent 30rem),var(--bg);font-family:var(--body)}}
a{{color:inherit}}
.back{{position:fixed;z-index:10;top:1rem;left:1rem;font:600 .68rem/1.2 var(--sans);letter-spacing:.13em;text-transform:uppercase;text-decoration:none;opacity:.72;border-bottom:1px solid currentColor;padding-bottom:.2rem}}
.back:hover,.back:focus-visible{{opacity:1}}
.shell{{width:min(100% - 2rem,980px);margin:0 auto;padding:clamp(5.5rem,10vw,8rem) 0 5rem}}
.hero{{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(220px,.6fr);gap:clamp(2rem,7vw,6rem);align-items:end;padding-bottom:clamp(2.5rem,6vw,4.5rem);border-bottom:1px solid var(--line)}}
.eyebrow{{font:600 .7rem/1.3 var(--sans);letter-spacing:.17em;text-transform:uppercase;color:var(--accent)}}
h1{{margin:.8rem 0 1rem;font-family:var(--serif);font-size:clamp(3rem,8vw,6.2rem);font-weight:500;line-height:.88;letter-spacing:-.025em}}
.lede{{max-width:52ch;margin:0;font-size:clamp(1rem,1.4vw,1.14rem);line-height:1.8;color:var(--muted)}}
.hero-note{{border-left:1px solid var(--accent);padding-left:1.25rem;font:400 .82rem/1.7 var(--sans);color:var(--muted)}}
.list{{padding-top:clamp(2.5rem,6vw,4.5rem)}}
.list-head{{display:flex;align-items:end;justify-content:space-between;gap:2rem;margin-bottom:1.3rem}}
h2{{margin:0;font-family:var(--serif);font-size:clamp(1.8rem,4vw,2.7rem);font-weight:500}}
.count{{font:500 .7rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}}
.reference{{display:grid;grid-template-columns:4rem minmax(0,1fr) auto;gap:clamp(1rem,3vw,2rem);align-items:center;padding:clamp(1.4rem,3vw,2rem);border:1px solid var(--line);background:linear-gradient(135deg,rgba(255,255,255,.035),rgba(255,255,255,.01));text-decoration:none;transition:transform .2s ease,border-color .2s ease,background .2s ease}}
.reference:hover,.reference:focus-visible{{transform:translateY(-2px);border-color:var(--accent);background:rgba(212,124,89,.07)}}
.number{{font:500 .72rem/1 var(--sans);letter-spacing:.12em;color:var(--accent)}}
.reference h3{{margin:0 0 .35rem;font-family:var(--serif);font-size:clamp(1.45rem,3vw,2.05rem);font-weight:500}}
.reference p{{margin:0;font:400 .84rem/1.65 var(--sans);color:var(--muted)}}
.arrow{{font:500 1.5rem/1 var(--serif);color:var(--accent)}}
.future{{margin:1rem 0 0;padding:1.2rem 0 0;border-top:1px solid var(--line);font:400 .78rem/1.7 var(--sans);color:var(--muted)}}
@media(max-width:760px){{.hero{{grid-template-columns:1fr;align-items:start}}.hero-note{{max-width:42ch}}.reference{{grid-template-columns:2.5rem minmax(0,1fr)}}.arrow{{display:none}}.list-head{{display:block}}.count{{display:block;margin-top:.5rem}}}}
</style>
<link rel="stylesheet" href="/css/alive.css?v={BUILD}">
{GLOBAL_LINK}
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"ProfilePage","name":"Reviews, References & Testimonials","url":"https://seminarschools.com/reviews/","mainEntity":{{"@type":"Person","name":"Saul Karim Nassau","url":"https://seminarschools.com/saul/"}}}}</script>
</head>
<body data-route-type="cv-reviews" data-geometry="indra-web" data-indra-intensity="0.05">
<a class="back" href="/saul/">← Saul Karim Nassau</a>
<main class="shell">
<section class="hero">
<div><span class="eyebrow">Professional record</span><h1>Reviews,<br>references &amp;<br>testimonials.</h1><p class="lede">A growing collection of recommendations and public references connected to teaching, service, community work, and Seminar Schools.</p></div>
<p class="hero-note">Each item links to its original source so the context and attribution remain visible.</p>
</section>
<section class="list" aria-labelledby="referencesTitle">
<div class="list-head"><h2 id="referencesTitle">Current references</h2><span class="count">01 available</span></div>
<a class="reference" href="https://www.linkedin.com/in/seminarschools/overlay/Position/1409449435/treasury/?profileId=ACoAAAoVpaQBwFL59ASEITFxwp8D-hzMxzfApMM" target="_blank" rel="noopener noreferrer">
<span class="number">01</span><span><h3>LinkedIn recommendation</h3><p>Open the original professional recommendation on LinkedIn.</p></span><span class="arrow" aria-hidden="true">↗</span>
</a>
<p class="future">Additional reviews, references, and testimonials will be added here as their original sources are prepared.</p>
</section>
</main>
<script src="/js/indra.js?v={BUILD}" defer></script>
<script src="/js/theme.js?v={BUILD}" defer></script>
<script src="/js/footer.js?v={BUILD}" defer></script>
</body>
</html>
'''
reviews_dir = ROOT / 'reviews'
reviews_dir.mkdir(exist_ok=True)
(reviews_dir / 'index.html').write_text(reviews_html, encoding='utf-8')

# Inject the final shared stylesheet and an explicit build marker into every source HTML page.
skip_dirs = {'.git', 'node_modules', '.netlify', 'public'}
changed = 0
for p in ROOT.rglob('*.html'):
    if any(part in skip_dirs for part in p.relative_to(ROOT).parts):
        continue
    text = p.read_text(encoding='utf-8', errors='ignore')
    if '</head>' not in text.lower():
        continue
    # Replace prior versions of this exact site-wide contract cleanly.
    text = re.sub(r'\s*<link[^>]+data-site-wide-type-zoom=["\'][^"\']+["\'][^>]*>\s*', '\n', text, flags=re.I)
    if 'data-site-wide-type-zoom=' not in text:
        text = re.sub(r'</head>', GLOBAL_LINK + '\n</head>', text, count=1, flags=re.I)
    p.write_text(text, encoding='utf-8')
    changed += 1

# CV: consolidate the duplicated font request, add the visible reviews route,
# and ensure its label participates in the existing copy system.
saul = ROOT / 'saul' / 'index.html'
s = saul.read_text(encoding='utf-8')
font_links = re.findall(r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\s*<link href="https://fonts\.googleapis\.com/css2\?[^\"]+" rel="stylesheet">', s)
combined = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">'
if font_links:
    first = font_links[0]
    s = s.replace(first, combined, 1)
    for extra in font_links[1:]:
        s = s.replace(extra, '', 1)
# Catch the compact duplicate format that may not match whitespace pattern.
s = re.sub(r'<link rel="preconnect" href="https://fonts\.googleapis\.com"><link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin><link href="https://fonts\.googleapis\.com/css2\?[^\"]+" rel="stylesheet">', '', s)
if 'data-profile="reviews"' not in s:
    s = s.replace('<button class="cv-action" type="button" id="downloadCvTop" data-profile="download">Download CV</button>', '<button class="cv-action" type="button" id="downloadCvTop" data-profile="download">Download CV</button>\n        <a class="cv-action" href="/reviews/" data-profile="reviews">Reviews &amp; references</a>')
s = s.replace('intake: "Contact", seminar: "View experience", download: "Download CV",', 'intake: "Contact", seminar: "View experience", download: "Download CV", reviews: "Reviews & references",')
# Link the visible CV colophon to the new route without disturbing print generation.
s = s.replace('Saul Karim Nassau · Toronto · <a href="/main/"', 'Saul Karim Nassau · Toronto · <a href="/reviews/" style="color:inherit;border-bottom:1px dotted currentColor;text-decoration:none;">Reviews &amp; references</a> · <a href="/main/"')
saul.write_text(s, encoding='utf-8')

# Public deployment allowlist.
build = ROOT / 'scripts' / 'build-public-deploy.js'
b = build.read_text(encoding='utf-8')
if "'reviews'" not in b:
    b = b.replace("'ohm-dome', 'philosophy', 'polymyth', 'polymythseminars', 'saul',", "'ohm-dome', 'philosophy', 'polymyth', 'polymythseminars', 'reviews', 'saul',")
build.write_text(b, encoding='utf-8')

# /reviews is now a real canonical route rather than a Marginalia alias.
redirects = ROOT / '_redirects'
r = redirects.read_text(encoding='utf-8')
r = re.sub(r'^/reviews\s+/marginalia\s+301\s*$', '/reviews      /reviews/  301', r, flags=re.M)
redirects.write_text(r, encoding='utf-8')

netlify = ROOT / 'netlify.toml'
n = netlify.read_text(encoding='utf-8')
if 'from = "/reviews"' not in n:
    marker = '# Canonical bookwormburrows pedagogical case. Explicitly normalize the bare path.\n'
    block = '''# Canonical reviews and references route.\n[[redirects]]\n  from = "/reviews"\n  to = "/reviews/"\n  status = 301\n  force = true\n\n'''
    n = n.replace(marker, block + marker)
netlify.write_text(n, encoding='utf-8')

# Footer and branch navigation discoverability.
footer = ROOT / 'js' / 'footer.js'
f = footer.read_text(encoding='utf-8')
f = f.replace("['Full CV', '/saul'], ['Main', '/main']", "['Full CV', '/saul'], ['Reviews & references', '/reviews/'], ['Main', '/main']")
footer.write_text(f, encoding='utf-8')

theme = ROOT / 'js' / 'theme.js'
t = theme.read_text(encoding='utf-8')
t = t.replace("about:[['/saul/','Founder'],['/polymyth/sitemap/','Sitemap']]", "about:[['/saul/','Founder'],['/reviews/','Reviews'],['/polymyth/sitemap/','Sitemap']]")
t = t.replace("else if(inb(['/saul/'])) sibs=TREE.about;", "else if(inb(['/saul/','/reviews/'])) sibs=TREE.about;")
theme.write_text(t, encoding='utf-8')

# Sitemap: insert after Saul or Marginalia; ensure one canonical entry.
sitemap = ROOT / 'sitemap.xml'
sm = sitemap.read_text(encoding='utf-8')
entry = '  <url><loc>https://seminarschools.com/reviews/</loc><lastmod>2026-07-10</lastmod></url>\n'
if 'https://seminarschools.com/reviews/' not in sm:
    anchor = '  <url><loc>https://seminarschools.com/saul/</loc><lastmod>2026-07-10</lastmod></url>\n'
    if anchor in sm: sm = sm.replace(anchor, anchor + entry)
    else: sm = sm.replace('</urlset>', entry + '</urlset>')
sitemap.write_text(sm, encoding='utf-8')

# Browser caching: every route revalidates, so clean URLs such as /saul/ do
# not remain on an old HTML/CSS pairing. Versioned asset URLs remain a second guard.
headers = ROOT / '_headers'
h = headers.read_text(encoding='utf-8')
# Remove every prior Cache-Control line to prevent conflicting immutable/no-cache values.
h = re.sub(r'^\s*Cache-Control:.*\n', '', h, flags=re.M)
# Add one unambiguous browser policy to the existing global block.
global_block = '/*\n  X-Frame-Options: SAMEORIGIN'
if global_block in h:
    h = h.replace(global_block, '/*\n  Cache-Control: no-cache, max-age=0, must-revalidate\n  X-Frame-Options: SAMEORIGIN', 1)
headers.write_text(h, encoding='utf-8')

# Release marker.
(ROOT / 'RELEASE_ID.txt').write_text('2026-07-10-reviews-zoom-font\n', encoding='utf-8')

print(f'Applied reviews, cache, zoom and typography pass to {changed} source HTML pages.')
