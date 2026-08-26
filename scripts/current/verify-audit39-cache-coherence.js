#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const headers = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
const netlify = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function headerValue(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = headers.match(
    new RegExp(`^${escaped}\\s*\\n((?:[ \\t]+[^\\n]+\\n?)*)`, 'm'),
  );
  if (!match) return '';
  return match[1].match(/^[ \t]+Cache-Control:\s*(.+)$/mi)?.[1]?.trim() || '';
}

function netlifyValue(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = netlify.match(
    new RegExp(
      `\\[\\[headers\\]\\]\\s*\\n\\s*for\\s*=\\s*"${escaped}"\\s*`
        + `\\n\\s*\\[headers\\.values\\]\\s*\\n\\s*Cache-Control\\s*=\\s*"([^"]+)"`,
      'm',
    ),
  );
  return match?.[1]?.trim() || '';
}

const IMAGE_POLICY = 'public, max-age=2592000, stale-while-revalidate=604800';
check(
  headerValue('/img/*') === IMAGE_POLICY,
  '_headers /img/* policy changed or disappeared',
);
for (const extension of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico']) {
  check(
    netlifyValue(`/*.${extension}`) === IMAGE_POLICY,
    `netlify.toml *.${extension} conflicts with the /img/* browser-cache policy`,
  );
}

for (const extension of ['woff2', 'woff', 'ttf']) {
  check(
    netlifyValue(`/*.${extension}`)
      === 'public, max-age=2592000, stale-while-revalidate=86400',
    `netlify.toml *.${extension} font policy changed`,
  );
}

const expectedHeaderPolicies = new Map([
  ['/*', 'no-cache, max-age=0, must-revalidate'],
  ['/css/*', 'public, max-age=86400, stale-while-revalidate=604800'],
  ['/js/*', 'public, max-age=86400, stale-while-revalidate=604800'],
  ['/polymyth/archive/*', IMAGE_POLICY],
  ['/polymythseminars/events.json', 'no-store, max-age=0'],
  ['/polymythseminars/browse.json', 'public, max-age=300, must-revalidate'],
  ['/polymythseminars/watchlist.json', 'public, max-age=300, must-revalidate'],
  ['/polymythseminars/research.json', 'public, max-age=300, must-revalidate'],
  ['/polymythseminars/featured.json', 'public, max-age=3600, must-revalidate'],
  ['/polymythseminars/feeds/*', 'public, max-age=900, must-revalidate'],
]);
for (const [route, expected] of expectedHeaderPolicies) {
  check(headerValue(route) === expected, `${route} cache policy changed`);
}

check(
  !fs.existsSync(path.join(ROOT, 'public', 'polymythseminars', 'events.json')),
  'the private canonical event corpus is present in the public deploy tree',
);
check(
  headers.includes('/polymythseminars/events.json\n  Cache-Control: no-store, max-age=0\n  X-Robots-Tag: noindex, nofollow'),
  'the private canonical route lost no-store and noindex defence in depth',
);
check(
  fs.existsSync(path.join(ROOT, 'public', 'polymythseminars', 'browse.json'))
    && fs.existsSync(path.join(ROOT, 'public', 'polymythseminars', 'watchlist.json'))
    && fs.existsSync(path.join(ROOT, 'public', 'polymythseminars', 'research.json')),
  'the safe discovery projections are missing from the public deploy tree',
);

check(
  netlify.includes('/img/* rule in _headers'),
  'cache-policy ownership comment no longer explains the overlapping rule',
);

if (failures.length) {
  console.error('CURRENT CACHE COHERENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'CURRENT CACHE COHERENCE PASSED — overlapping image rules agree, fonts remain '
    + 'long-lived, shared code revalidates daily, HTML revalidates immediately, and '
    + 'the private calendar corpus is no-store/absent while public projections retain bounded freshness.',
);
