#!/usr/bin/env python3
"""
Section post builder. Reads Markdown posts from a section's posts/ folder,
generates HTML for each, updates the global blog manifest.

Usage:
    python3 scripts/build_section.py marginalia
    python3 scripts/build_section.py nutrition
    python3 scripts/build_section.py agora
    python3 scripts/build_section.py sabachtan
    python3 scripts/build_section.py ohm-dome

Frontmatter format (YAML-ish):
    ---
    title: Post title
    date: 2026-05-12
    excerpt: One-line summary.
    venue: Optional venue or context
    speaker: Optional speaker
    ---

    Body of the post in Markdown.

The script:
  1. Reads every .md file in {section}/posts/
  2. Generates {section}/{slug}/index.html for each
  3. Updates blog/posts.json with section-tagged entries
  4. Idempotent
"""
import os, re, json, sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent

# Section catalog — each gets its own posts folder, accent, eyebrow text, etc.
SECTIONS = {
    'marginalia': {
        'eyebrow': 'A lecture review',
        'accent': '#983425',
        'accent_rgb': '152,52,37',
        'bg': '#EDE8DC',
        'fonts_url': 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap',
        'display': "'Playfair Display', Georgia, serif",
        'body': "'Spectral', Georgia, serif",
        'mono': "'JetBrains Mono', ui-monospace, monospace",
        'section_label': 'Marginalia',
        'section_url': '/marginalia/',
        'tags': ['lecture-review'],
    },
    'nutrition': {
        'eyebrow': 'A nutrition piece',
        'accent': '#5C7330',
        'accent_rgb': '92,115,48',
        'bg': '#EFE6D2',
        'fonts_url': 'https://fonts.googleapis.com/css2?family=Gelasio:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap',
        'display': "'Gelasio', Georgia, serif",
        'body': "'Lora', Georgia, serif",
        'mono': "'IBM Plex Mono', ui-monospace, monospace",
        'section_label': 'Nutrition',
        'section_url': '/nutrition/',
        'tags': ['nutrition'],
    },
    'agora': {
        'eyebrow': 'From the Agora',
        'accent': '#B5704A',
        'accent_rgb': '181,112,74',
        'bg': '#EBE5D0',
        'fonts_url': 'https://fonts.googleapis.com/css2?family=Cormorant+Infant:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap',
        'display': "'Cormorant Infant', Georgia, serif",
        'body': "'Lora', Georgia, serif",
        'mono': "'JetBrains Mono', ui-monospace, monospace",
        'section_label': 'The Agora',
        'section_url': '/agora/',
        'tags': ['agora'],
    },
    'sabachtan-seminar': {
        'eyebrow': 'From the seminar',
        'accent': '#B89758',
        'accent_rgb': '184,151,88',
        'bg': '#1A1A20',
        'fonts_url': 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap',
        'display': "'EB Garamond', Georgia, serif",
        'body': "'Crimson Pro', Georgia, serif",
        'mono': "'IBM Plex Mono', ui-monospace, monospace",
        'section_label': 'Sabachtan Seminar',
        'section_url': '/sabachtan-seminar/',
        'tags': ['sabachtan', 'seminar-piece'],
        'theme_dark': True,
    },
    'ohm-dome': {
        'eyebrow': 'A project update',
        'accent': '#5DA8A8',
        'accent_rgb': '93,168,168',
        'bg': '#0E1418',
        'fonts_url': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap',
        'display': "'Space Grotesk', system-ui, sans-serif",
        'body': "'Inter', system-ui, sans-serif",
        'mono': "'Space Mono', ui-monospace, monospace",
        'section_label': 'Ohm Dome',
        'section_url': '/ohm-dome/',
        'tags': ['ohm-dome'],
        'theme_dark': True,
    },
}


POST_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — {section_label}. Seminar Schools.</title>
<meta property="og:type" content="article">
<meta property="og:url" content="https://seminarschools.com{section_url}{slug}/">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{excerpt}">
<meta property="og:image" content="https://seminarschools.com/og-image.png">
<meta property="og:site_name" content="{section_label} · Seminar Schools">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{excerpt}">
<meta name="twitter:image" content="https://seminarschools.com/og-image.png">
<meta name="description" content="{excerpt}">
<link rel="canonical" href="https://seminarschools.com{section_url}{slug}/">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="manifest" href="/manifest.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{fonts_url}" rel="stylesheet">
<link rel="stylesheet" href="/css/main.css">
<style>
:root {{
  --display: {display};
  --body: {body};
  --mono: {mono};
  --accent: {accent};
  --accent-rgb: {accent_rgb};
  --bg: {bg};
}}
.post-meta-row {{ font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fg-fade); margin-bottom: 1.25rem; display: flex; gap: 1rem; flex-wrap: wrap; }}
.post-meta-row .post-date {{ color: var(--fg-soft); }}
.post-meta-row .post-venue, .post-meta-row .post-speaker {{ font-style: italic; }}
.post-body {{ margin-top: 2rem; }}
.post-body p {{ font-family: var(--body); font-size: 1.05rem; line-height: 1.75; margin-bottom: 1.25rem; }}
.post-body p:first-of-type::first-letter {{ font-family: var(--display); font-weight: 500; font-size: 4em; float: left; line-height: 0.85; margin: 0.1em 0.12em -0.05em 0; color: var(--accent); }}
.post-body h2 {{ font-family: var(--display); font-weight: 500; font-size: 1.6rem; margin: 2rem 0 1rem; }}
.post-body blockquote {{ border-left: 3px solid var(--accent); padding-left: 1.25rem; margin: 1.5rem 0; font-style: italic; color: var(--fg-soft); }}
.back-row {{ margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--rule); display: flex; gap: 1.5rem; flex-wrap: wrap; }}
.back-row a {{ font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); border-bottom: 1px solid var(--accent); padding-bottom: 1px; }}
.back-row a:hover {{ opacity: 0.7; }}
</style>
</head>
<body{body_class}>
<div class="wrap" id="main-content">

<header class="topbar" id="topbar">
  <a href="/" class="brand"><span class="seal" aria-hidden="true"></span>Seminar <em>Schools</em></a>
  <a href="{section_url}" class="right" style="color:var(--accent);text-decoration:none">{section_label} &uarr;</a>
</header>

<main>

<div class="eyebrow">{eyebrow}</div>
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
  <a href="{section_url}">&larr; All {section_label}</a>
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
"""


def parse_frontmatter(text):
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
    lines = md.split('\n')
    out = []
    para = []
    def flush_para():
        if not para: return
        text = ' '.join(para).strip()
        if not text: return
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


def build(section):
    if section not in SECTIONS:
        print(f'Unknown section: {section}')
        print(f'Valid sections: {", ".join(SECTIONS.keys())}')
        return 1
    spec = SECTIONS[section]
    posts_dir = ROOT / section / 'posts'
    section_dir = ROOT / section
    blog_manifest = ROOT / 'blog' / 'posts.json'

    if not posts_dir.exists():
        posts_dir.mkdir(parents=True, exist_ok=True)
        print(f'Created {posts_dir}. Add .md files there to publish.')
        return 0

    md_files = sorted(posts_dir.glob('*.md'))
    if not md_files:
        print(f'No .md files in {posts_dir}.')
        return 0

    if blog_manifest.exists():
        manifest = json.loads(blog_manifest.read_text())
    else:
        manifest = {'posts': []}
    posts = manifest.get('posts', [])

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
        body_class = ' class="theme-dark"' if spec.get('theme_dark') else ''
        post_html = POST_TEMPLATE.format(
            title=title.replace('"', '&quot;'),
            slug=slug,
            section_label=spec['section_label'],
            section_url=spec['section_url'],
            eyebrow=spec['eyebrow'],
            fonts_url=spec['fonts_url'],
            display=spec['display'],
            body=spec['body'],
            mono=spec['mono'],
            accent=spec['accent'],
            accent_rgb=spec['accent_rgb'],
            bg=spec['bg'],
            body_class=body_class,
            date_pretty=pretty_date(date),
            excerpt=excerpt.replace('"', '&quot;'),
            venue_html=venue_html,
            speaker_html=speaker_html,
            body_html=body_html,
        )
        post_dir = section_dir / slug
        post_dir.mkdir(exist_ok=True)
        (post_dir / 'index.html').write_text(post_html, encoding='utf-8')

        post_id = f'{section}-{slug}'
        manifest_entry = {
            'id': post_id,
            'title': title,
            'date': date,
            'sectionId': section,
            'sectionLabel': spec['section_label'],
            'sectionUrl': spec['section_url'],
            'postUrl': f'{spec["section_url"]}{slug}/',
            'excerpt': excerpt,
            'tags': spec['tags'],
        }
        replaced = False
        for i, p in enumerate(posts):
            if isinstance(p, dict) and p.get('id') == post_id:
                posts[i] = manifest_entry
                replaced = True
                break
        if not replaced:
            posts.append(manifest_entry)
        built += 1
        print(f'  built {spec["section_url"]}{slug}/  ({title})')

    manifest['posts'] = posts
    blog_manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'\n{built} post(s) built. Manifest updated.')
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 scripts/build_section.py <section>')
        print(f'Sections: {", ".join(SECTIONS.keys())}')
        sys.exit(1)
    sys.exit(build(sys.argv[1]) or 0)
