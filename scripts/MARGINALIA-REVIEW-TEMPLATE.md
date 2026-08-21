# Marginalia review source template

This file is internal publishing documentation. Copy its front matter and
body structure into `marginalia/posts/a-real-review-slug.md`; do not publish
this template itself.

```markdown
---
title: Review title
date: YYYY-MM-DD
excerpt: One or two factual sentences for the public listing.
venue: Venue name
speaker: Speaker name
---

Opening paragraph.

## A useful section heading

Review text.
```

Run `python3 scripts/build_marginalia.py` after adding, revising, or removing a
review. Only real reviews with completed public copy belong in the source
folder.
