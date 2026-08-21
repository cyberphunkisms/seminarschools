#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(process.argv[2] || process.cwd());
const read = relative => readFileSync(resolve(root, relative), 'utf8');
const bookwormcard = read('bookwormcard/index.html');
const aa = read('aa/index.html');
const leizu = read('leizu/index.html');

function occurrence(source, token) {
  return source.split(token).length - 1;
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => (
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function compileInlineScripts(relative, source) {
  const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let compiled = 0;
  for (const [, attributes, body] of scripts) {
    if (/\bsrc\s*=/i.test(attributes)) continue;
    if (/application\/ld\+json/i.test(attributes)) continue;
    if (!body.trim()) continue;
    assert.doesNotThrow(
      () => new Function(body),
      undefined,
      `${relative}: inline script ${compiled + 1} must parse`
    );
    compiled += 1;
  }
  assert.ok(compiled >= 1, `${relative}: expected an inline runtime script`);
}

// Bookwormcard owns a fixed CRT/light/high-contrast token system. The shared
// theme sheet must not replace those tokens after it loads.
assert.match(
  bookwormcard,
  /<html\b(?=[^>]*\blang="en")(?=[^>]*\bdata-theme-policy="fixed")[^>]*>/i,
  'Bookwormcard must opt out of shared root colour-token replacement'
);
assert.match(bookwormcard, /--bg:#08070d;\s*--fg:#ff3ee0;/);
assert.match(bookwormcard, /body\.light-mode\s*\{[\s\S]*?--bg:#f9f5e8;--fg:#253018;/);
assert.match(bookwormcard, /body\.contrast\s*\{[\s\S]*?--bg:#000;--fg:#fff;/);
assert.match(bookwormcard, /@media \(forced-colors:active\)\s*\{/);
assert.match(bookwormcard, /#student-start-card\s*\{[\s\S]*?color:var\(--fg\)/);
assert.equal(occurrence(bookwormcard, 'id="student-start-card"'), 1);
assert.equal(occurrence(bookwormcard, 'id="t-contrast"'), 1);
assert.ok(contrastRatio('#ff3ee0', '#08070d') >= 4.5, 'CRT copy contrast regressed');
assert.ok(contrastRatio('#8b5cf6', '#08070d') >= 4.5, 'CRT heading contrast regressed');
assert.ok(contrastRatio('#253018', '#f9f5e8') >= 4.5, 'light-mode contrast regressed');
assert.ok(contrastRatio('#ffffff', '#000000') >= 7, 'high-contrast mode regressed');

// The AA peer switcher is a route choice rather than a viewport control. Its
// single DOM instance stays in reading order at every size and may scroll
// horizontally without covering the archive or global controls.
assert.equal(occurrence(aa, 'id="aa-sibling-nav"'), 1);
const routeNoteAt = aa.indexOf('class="route-note archive-route-note"');
const siblingNavAt = aa.indexOf('id="aa-sibling-nav"');
const headerAt = aa.indexOf('<header id="home-link">');
assert.ok(routeNoteAt >= 0 && siblingNavAt > routeNoteAt && headerAt > siblingNavAt);
assert.match(
  aa,
  /#aa-sibling-nav\s*\{[\s\S]*?position:static!important;inset:auto!important;[\s\S]*?overflow-x:auto;/
);
assert.doesNotMatch(aa, /#aa-sibling-nav\s*\{[^}]*position:fixed/);
assert.match(aa, /#aa-sibling-nav>a,#aa-sibling-nav>span\{[\s\S]*?min-height:44px/);
assert.equal((aa.match(/class="mode-btn/g) || []).length, 7, 'AA browse modes changed');
assert.match(aa, /href="\/aa\/cloud\/"/);
assert.match(aa, /href="\/aa\/views\/"/);

// Leizu may auto-hide only when the bar is idle on a fine-pointer, adequately
// tall viewport. Focus, hover, touch/coarse pointers, and short screens hold it.
assert.match(
  leizu,
  /function chromeBarStaysVisible\(\)\{[\s\S]*?\(pointer: coarse\)[\s\S]*?\(max-height: 650px\)/
);
assert.match(
  leizu,
  /function scheduleChromeHide\(\)\{[\s\S]*?bar\.contains\(document\.activeElement\)[\s\S]*?bar\.matches\(':hover'\)/
);
assert.match(
  leizu,
  /function hideChromeBar\(\)\{[\s\S]*?chromeBarStaysVisible\(\)[\s\S]*?bar\.contains\(document\.activeElement\)[\s\S]*?bar\.matches\(':hover'\)[\s\S]*?bar\.classList\.remove\('chrome-hidden'\)/
);
assert.match(leizu, /bar\.addEventListener\('mouseleave', scheduleChromeHide\)/);
assert.match(
  leizu,
  /bar\.addEventListener\('focusout', \(\) => \{[\s\S]*?setTimeout\(scheduleChromeHide, 0\)/
);
assert.match(
  leizu,
  /@media \(pointer:coarse\),\(max-height:650px\)\s*\{[\s\S]*?\.chrome-bar\.chrome-hidden\s*\{[\s\S]*?opacity:1;transform:none;pointer-events:auto/
);
for (const lang of ['en', 'fr', 'zh', 'zhs', 'fa']) {
  assert.match(leizu, new RegExp(`data-lang-set="${lang}"`));
}
assert.match(leizu, /class="pricing-panel" id="pricing-panel" inert aria-hidden="true"/);

const chromeRuntime = leizu.slice(
  leizu.indexOf('let _chromeHideTimer = null;'),
  leizu.indexOf('// The exit control uses delegated wiring')
);
assert.ok(chromeRuntime.startsWith('let _chromeHideTimer = null;'));

function exerciseChrome({
  coarse = false,
  short = false,
  focused = false,
  hovered = false,
  calm = false,
  reduced = false,
}) {
  const classes = new Set();
  const timers = new Map();
  let nextTimer = 1;
  const state = {focused, hovered};
  const bar = {
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
    },
    contains: () => state.focused,
    matches: selector => selector === ':hover' && state.hovered,
  };
  const context = {
    window: {
      matchMedia: query => ({
        matches: query === '(pointer: coarse)' ? coarse :
          query === '(max-height: 650px)' ? short :
          query === '(prefers-reduced-motion: reduce)' ? reduced : false,
      }),
    },
    document: {
      documentElement: {
        getAttribute: name => name === 'data-motion' && calm ? 'calm' : null,
      },
      querySelector: () => bar,
      activeElement: {},
    },
    setTimeout: callback => {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: id => timers.delete(id),
  };
  vm.createContext(context);
  vm.runInContext(
    `${chromeRuntime}\nglobalThis.__chrome = {showChromeBar, hideChromeBar, scheduleChromeHide};`,
    context
  );
  return {api: context.__chrome, classes, timers, state};
}

{
  const idle = exerciseChrome({});
  idle.api.showChromeBar();
  assert.equal(idle.timers.size, 1, 'idle fine-pointer bar should schedule hiding');
  [...idle.timers.values()][0]();
  assert.ok(idle.classes.has('chrome-hidden'), 'idle fine-pointer bar should hide');
}
for (const held of [
  {focused: true},
  {hovered: true},
  {coarse: true},
  {short: true},
  {calm: true},
  {reduced: true},
]) {
  const test = exerciseChrome(held);
  test.api.showChromeBar();
  assert.equal(test.timers.size, 0, `held chrome scheduled a timer: ${JSON.stringify(held)}`);
  test.api.hideChromeBar();
  assert.ok(!test.classes.has('chrome-hidden'), `held chrome hid: ${JSON.stringify(held)}`);
}

compileInlineScripts('bookwormcard/index.html', bookwormcard);
compileInlineScripts('aa/index.html', aa);
compileInlineScripts('leizu/index.html', leizu);

process.stdout.write('Audit36 visual P0 verifier passed (3 routes, content invariants preserved).\n');
