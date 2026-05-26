---
title: Example review
date: 2026-05-06
excerpt: A stub. Replace this file with a lecture review. Or delete it.
venue: Seminar Schools
speaker: The system
---

A stub. The first real review goes here.

## Writing a review

Create a Markdown file in `marginalia/posts/`. The filename without `.md` becomes the URL slug.

The frontmatter holds title, date in ISO format, a one-line excerpt, and optional venue and speaker.

The body is plain Markdown. Paragraphs separate with blank lines. Headings use `## `. Block quotes use `> `.

## Building

Run `python3 scripts/build_marginalia.py` from the project root.

The script writes the post HTML at `/marginalia/[slug]/index.html`. It updates `/blog/posts.json`. The post then surfaces on `/marginalia/` and on `/blog/` simultaneously.

The script is idempotent. Run it again. Only changed posts rewrite.
