#!/usr/bin/env python3
"""
Marginalia post builder.

Saul writes a lecture review as a Markdown file in /marginalia/posts/[slug].md
with YAML frontmatter:

    ---
    title: A talk on Augustine at the Pontifical Institute
    date: 2026-05-12
    excerpt: A brief reflection on the talk and what it asked.
    venue: Pontifical Institute of Mediaeval Studies
    speaker: Some Speaker
    ---

    Body of the review in Markdown.

Then runs:
    python3 scripts/build_marginalia.py

The script:
  1. Reads every .md file in /marginalia/posts/
  2. Generates /marginalia/[slug]/index.html for each (using the post template)
  3. Updates /blog/posts.json with sectionId="marginalia" entries
  4. Reports what was added / changed

Idempotent. Safe to run repeatedly.
"""
import os, re, json, sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
POSTS_DIR = ROOT / 'marginalia' / 'posts'
MARGINALIA_DIR = ROOT / 'marginalia'
BLOG_MANIFEST = ROOT / 'blog' / 'posts.json'

POST_TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Marginalia. Seminar Schools.</title>
<meta property="og:type" content="article">
<meta property="og:url" content="https://seminarschools.com/marginalia/{slug}/">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{excerpt}">
<meta property="og:image" content="https://seminarschools.com/og-image.png">
<meta property="og:site_name" content="Marginalia · Seminar Schools">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{excerpt}">
<meta name="twitter:image" content="https://seminarschools.com/og-image.png">
<meta name="description" content="{excerpt}">
<link rel="canonical" href="https://seminarschools.com/marginalia/{slug}/">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#14110D">
<link rel="stylesheet" href="/css/main.css">
<style>
:root {{
  --accent: #983425;
  --accent-rgb: 152,52,37;
  --bg: #EDE8DC;
}}
.post-meta-row {{
  font-family: var(--mono); font-size: 0.7rem;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--fg-fade); margin-bottom: 1.25rem;
  display: flex; gap: 1rem; flex-wrap: wrap;
}}
.post-meta-row .post-date {{ color: var(--fg-soft); }}
.post-meta-row .post-venue {{ font-style: italic; }}
.post-body {{ margin-top: 2rem; }}
.post-body p {{ font-family: var(--body); font-size: 1.05rem; line-height: 1.75; margin-bottom: 1.25rem; }}
.post-body p:first-of-type::first-letter {{
  font-family: var(--display); font-weight: 500;
  font-size: 4em; float: left; line-height: 0.85;
  margin: 0.1em 0.12em -0.05em 0; color: var(--accent);
}}
.post-body h2 {{ font-family: var(--display); font-weight: 500; font-size: 1.6rem; margin: 2rem 0 1rem; }}
.post-body blockquote {{
  border-left: 3px solid var(--accent);
  padding-left: 1.25rem; margin: 1.5rem 0;
  font-style: italic; color: var(--fg-soft);
}}
.back-row {{
  margin-top: 4rem; padding-top: 2rem;
  border-top: 1px solid var(--rule);
  display: flex; gap: 1.5rem; flex-wrap: wrap;
}}
.back-row a {{
  font-family: var(--mono); font-size: 0.7rem;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--accent); border-bottom: 1px solid var(--accent);
  padding-bottom: 1px;
}}
.back-row a:hover {{ opacity: 0.7; }}
</style>
</head>
<body>
<div class="wrap" id="main-content">

<header class="topbar" id="topbar">
  <a href="/" class="brand"><span class="seal" aria-hidden="true"></span>Seminar <em>Schools</em></a>
  <a href="/marginalia/" class="right" style="color:var(--accent);text-decoration:none">Marginalia &uarr;</a>
</header>

<main>

<div class="eyebrow">A lecture review</div>
<h1>{title}</h1>

<div class="post-meta-row">
  <span class="post-date">{date_pretty}</span>
  {venue_html}
  {speaker_html}
</div>

<article class="post-body">
{body_html}
</article>

<div class="back-row">
  <a href="/marginalia/">&larr; All marginalia</a>
  <a href="/blog/">In the blog</a>
</div>

</main>
</div>

<script>
(function() {{
  var topbar = document.getElementById('topbar');
  if (topbar) {{
    window.addEventListener('scroll', function() {{
      topbar.classList.toggle('scrolled', window.scrollY > 40);
    }}, {{ passive: true }});
  }}
}})();
</script>
</body>
</html>
'''


def parse_frontmatter(text):
    """Parse YAML-style frontmatter delimited by --- lines. Returns (meta_dict, body_text)."""
    if not text.startswith('---\n'):
        return {}, text
    end = text.find('\n---\n', 4)
    if end == -1:
        return {}, text
    meta_block = text[4:end]
    body = text[end + 5:]
    meta = {}
    for line in meta_block.split('\n'):
        if ':' not in line:
            continue
        k, v = line.split(':', 1)
        meta[k.strip()] = v.strip()
    return meta, body


def md_to_html(md):
    """Minimal Markdown-to-HTML — paragraphs, h2, blockquotes, links, em, strong."""
    lines = md.split('\n')
    out = []
    para = []

    def flush_para():
        if not para:
            return
        text = ' '.join(para).strip()
        if not text:
            return
        # inline transformations
        text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
        text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)
        out.append(f'<p>{text}</p>')
        para.clear()

    for line in lines:
        if line.startswith('## '):
            flush_para()
            out.append(f'<h2>{line[3:].strip()}</h2>')
        elif line.startswith('> '):
            flush_para()
            out.append(f'<blockquote>{line[2:].strip()}</blockquote>')
        elif line.strip() == '':
            flush_para()
        else:
            para.append(line.strip())
    flush_para()
    return '\n'.join(out)


def pretty_date(iso):
    try:
        d = datetime.strptime(iso, '%Y-%m-%d')
        return d.strftime('%b %-d, %Y')
    except ValueError:
        return iso


def build():
    if not POSTS_DIR.exists():
        POSTS_DIR.mkdir(parents=True, exist_ok=True)
        print(f'Created {POSTS_DIR}. Add .md files there to publish.')
        return

    md_files = sorted(POSTS_DIR.glob('*.md'))
    if not md_files:
        print(f'No .md files in {POSTS_DIR}. Nothing to build.')
        return

    # Load existing manifest
    if BLOG_MANIFEST.exists():
        manifest = json.loads(BLOG_MANIFEST.read_text())
    else:
        manifest = {'posts': []}

    posts = manifest.get('posts', [])
    existing_ids = {p['id'] for p in posts if isinstance(p, dict) and 'id' in p}

    built = 0
    for md_path in md_files:
        slug = md_path.stem
        text = md_path.read_text(encoding='utf-8')
        meta, body = parse_frontmatter(text)

        title = meta.get('title', slug.replace('-', ' ').title())
        date = meta.get('date', '')
        excerpt = meta.get('excerpt', '')
        venue = meta.get('venue', '')
        speaker = meta.get('speaker', '')

        body_html = md_to_html(body)
        venue_html = f'<span class="post-venue">{venue}</span>' if venue else ''
        speaker_html = f'<span class="post-speaker">{speaker}</span>' if speaker else ''

        post_dir = MARGINALIA_DIR / slug
        post_dir.mkdir(exist_ok=True)
        post_html = POST_TEMPLATE.format(
            title=title.replace('"', '&quot;'),
            slug=slug,
            date_pretty=pretty_date(date),
            excerpt=excerpt.replace('"', '&quot;'),
            venue_html=venue_html,
            speaker_html=speaker_html,
            body_html=body_html,
        )
        (post_dir / 'index.html').write_text(post_html, encoding='utf-8')

        post_id = f'marginalia-{slug}'
        manifest_entry = {
            'id': post_id,
            'title': title,
            'date': date,
            'sectionId': 'marginalia',
            'sectionLabel': 'Marginalia',
            'sectionUrl': '/marginalia/',
            'postUrl': f'/marginalia/{slug}/',
            'excerpt': excerpt,
            'tags': ['lecture-review'],
        }

        # Replace existing entry if present, otherwise append
        replaced = False
        for i, p in enumerate(posts):
            if isinstance(p, dict) and p.get('id') == post_id:
                posts[i] = manifest_entry
                replaced = True
                break
        if not replaced:
            posts.append(manifest_entry)

        built += 1
        print(f'  built /marginalia/{slug}/  ({title})')

    manifest['posts'] = posts
    BLOG_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'\n{built} post(s) built. Manifest updated.')


if __name__ == '__main__':
    build()
