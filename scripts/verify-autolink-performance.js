#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const AUTOLINK = path.join(ROOT, 'js/autolink.js');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const source = fs.existsSync(AUTOLINK)
  ? fs.readFileSync(AUTOLINK, 'utf8')
  : '';

check(source.length > 0, 'js/autolink.js is missing or empty');
check(
  source.includes('function compactRoots(nodes)'),
  'overlapping selector roots are not compacted'
);
check(
  source.includes(
    'compactRoots(document.querySelectorAll(selector || DEFAULT_SELECTOR))'
  ),
  'content sweeps do not deduplicate nested selector matches'
);
check(
  source.includes('observedContainers = compactRoots(containers)'),
  'MutationObserver still attaches to overlapping containers'
);
check(
  source.includes('function collectAutolinkTextNodes(selector)'),
  'autolink work is not represented as a deduplicated text-node queue'
);
check(
  source.includes('function collectIncrementalAutolinkTextNodes(nodes, selector)'),
  'MutationObserver additions do not have a subtree-only collection path'
);
check(
  source.includes('pendingRoots = compactRoots(pendingRoots.concat('),
  'nested or overlapping mutation roots are not deduplicated before scanning'
);
check(
  source.includes('new MutationObserver(handleMutations)'),
  'MutationObserver does not use the incremental mutation handler'
);
check(
  source.includes('workQueue = collectIncrementalAutolinkTextNodes(roots)'),
  'incremental mutations still fall through to a whole-document work queue'
);
check(
  !/addedNodes\.length > 0\)\s*\{\s*scheduleAutolink\(\)/m.test(source),
  'small childList mutations still request an unscoped full scan'
);
check(
  source.includes('requestIdleCallback') &&
    source.includes('deadline.timeRemaining() > 3'),
  'large autolink sweeps are not split into bounded idle-time slices'
);
check(
  source.includes('canonicalCache[cacheKey]'),
  'canonical term resolution is not memoized'
);
check(
  source.includes('rerunRequested = true'),
  'mutations arriving during a sliced sweep are not replayed'
);
check(
  !source.includes('observedContainers = Array.prototype.slice.call(containers)'),
  'legacy overlapping observer registration remains'
);
check(
  !/setTimeout\(function \(\) \{\s*isLinking = true;\s*disconnectObserver\(\);\s*window\.autolinkEntries\(\)/m.test(
    source
  ),
  'legacy monolithic timer sweep remains'
);

for (const selector of [
  '.eb',
  '.ex',
  '.entry',
  'article p',
  'article li',
  'main p',
  'main h1'
]) {
  check(
    source.includes(selector),
    `linkability selector was lost during performance hardening: ${selector}`
  );
}

for (const protection of [
  "tag === 'A'",
  "tag === 'CODE'",
  "tag === 'TEXTAREA'",
  '[data-no-autolink]',
  '.route-note',
  '.site-footer'
]) {
  check(
    source.includes(protection),
    `autolink exclusion was lost during performance hardening: ${protection}`
  );
}

check(
  source.includes("fetch('/polymyth/concordance/vocabulary.json')"),
  'canonical vocabulary registry fetch was lost'
);
check(
  source.includes("a.href = '/polymyth/concordance/?term='"),
  'generated concordance destinations were lost'
);
check(
  source.includes("closest('a, [data-no-autolink]"),
  'autolink must not create invalid nested links inside an existing anchor'
);
check(
  source.includes("a.contentEditable = 'false'"),
  'derived links inside editable records must remain independently keyboard-focusable'
);

function runIncrementalRuntimeCheck() {
  const walkRoots = [];
  const timers = [];
  let nextTimerId = 1;
  let mutationCallback = null;

  class FakeNode {
    constructor(nodeType) {
      this.nodeType = nodeType;
      this.parentNode = null;
      this.childNodes = [];
    }

    get parentElement() {
      return this.parentNode && this.parentNode.nodeType === 1
        ? this.parentNode
        : null;
    }

    get isConnected() {
      let node = this;
      while (node) {
        if (node.nodeType === 9) return true;
        node = node.parentNode;
      }
      return false;
    }

    contains(candidate) {
      let node = candidate;
      while (node) {
        if (node === this) return true;
        node = node.parentNode;
      }
      return false;
    }

    appendChild(child) {
      if (child.nodeType === 11) {
        for (const grandchild of child.childNodes.slice()) {
          this.appendChild(grandchild);
        }
        child.childNodes = [];
        return child;
      }
      if (child.parentNode) {
        const oldIndex = child.parentNode.childNodes.indexOf(child);
        if (oldIndex >= 0) child.parentNode.childNodes.splice(oldIndex, 1);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    replaceChild(replacement, previous) {
      const index = this.childNodes.indexOf(previous);
      if (index < 0) throw new Error('replaceChild target is missing');
      const additions = replacement.nodeType === 11
        ? replacement.childNodes.slice()
        : [replacement];
      previous.parentNode = null;
      for (const child of additions) child.parentNode = this;
      this.childNodes.splice(index, 1, ...additions);
      if (replacement.nodeType === 11) replacement.childNodes = [];
      return previous;
    }
  }

  class FakeText extends FakeNode {
    constructor(value) {
      super(3);
      this.nodeValue = value;
    }

    get textContent() {
      return this.nodeValue;
    }

    set textContent(value) {
      this.nodeValue = String(value);
    }
  }

  function matchesSimple(element, token) {
    if (!element || element.nodeType !== 1) return false;
    if (token.startsWith('.')) {
      return element.className.split(/\s+/).includes(token.slice(1));
    }
    if (token.startsWith('#')) return element.id === token.slice(1);
    if (/^\[.+\]$/.test(token)) {
      return Object.prototype.hasOwnProperty.call(
        element.attributes,
        token.slice(1, -1)
      );
    }
    return element.tagName.toLowerCase() === token.toLowerCase();
  }

  function matchesSelector(element, selector) {
    return selector.split(',').some((part) => {
      const tokens = part.trim().split(/\s+/);
      if (!matchesSimple(element, tokens[tokens.length - 1])) return false;
      let ancestor = element.parentElement;
      for (let index = tokens.length - 2; index >= 0; index--) {
        while (ancestor && !matchesSimple(ancestor, tokens[index])) {
          ancestor = ancestor.parentElement;
        }
        if (!ancestor) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });
  }

  class FakeElement extends FakeNode {
    constructor(tagName) {
      super(1);
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.attributes = Object.create(null);
      this.href = '';
      this.classList = {
        contains: (name) => this.className.split(/\s+/).includes(name)
      };
    }

    matches(selector) {
      return matchesSelector(this, selector);
    }

    closest(selector) {
      let element = this;
      while (element) {
        if (element.matches(selector)) return element;
        element = element.parentElement;
      }
      return null;
    }

    querySelectorAll(selector) {
      const matches = [];
      const visit = (node) => {
        for (const child of node.childNodes) {
          if (child.nodeType === 1 && child.matches(selector)) matches.push(child);
          visit(child);
        }
      };
      visit(this);
      return matches;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }

    get textContent() {
      return this.childNodes.map((child) => child.textContent).join('');
    }

    set textContent(value) {
      this.childNodes = [];
      this.appendChild(new FakeText(String(value)));
    }
  }

  class FakeFragment extends FakeNode {
    constructor() {
      super(11);
    }
  }

  class FakeDocument extends FakeNode {
    constructor() {
      super(9);
      this.readyState = 'loading';
      this.head = new FakeElement('head');
      this.body = new FakeElement('body');
      this.appendChild(this.head);
      this.appendChild(this.body);
    }

    createElement(tagName) {
      return new FakeElement(tagName);
    }

    createTextNode(value) {
      return new FakeText(value);
    }

    createDocumentFragment() {
      return new FakeFragment();
    }

    createTreeWalker(root) {
      walkRoots.push(root);
      const texts = [];
      const visit = (node) => {
        for (const child of node.childNodes) {
          if (child.nodeType === 3) texts.push(child);
          else visit(child);
        }
      };
      visit(root);
      let index = 0;
      return {
        nextNode() {
          return texts[index++] || null;
        }
      };
    }

    querySelectorAll(selector) {
      const matches = [];
      const visit = (node) => {
        for (const child of node.childNodes) {
          if (child.nodeType === 1 && child.matches(selector)) matches.push(child);
          visit(child);
        }
      };
      visit(this);
      return matches;
    }

    addEventListener() {}
  }

  const document = new FakeDocument();
  const main = document.createElement('main');
  main.id = 'main';
  const existing = document.createElement('p');
  existing.textContent = 'contentinternet';
  main.appendChild(existing);
  document.body.appendChild(main);

  function setTimer(callback) {
    const id = nextTimerId++;
    timers.push({ id, callback, cancelled: false });
    return id;
  }

  function clearTimer(id) {
    const timer = timers.find((item) => item.id === id);
    if (timer) timer.cancelled = true;
  }

  function drainTimers() {
    let guard = 0;
    while (timers.length) {
      if (++guard > 100) throw new Error('autolink timer loop did not settle');
      const timer = timers.shift();
      if (!timer.cancelled) timer.callback();
    }
  }

  class FakeMutationObserver {
    constructor(callback) {
      mutationCallback = callback;
    }
    observe() {}
    disconnect() {}
  }

  const window = {
    setTimeout: setTimer,
    clearTimeout: clearTimer
  };
  const marker = '  // ── Boot: fetch vocabulary then init ──';
  const instrumented = source.replace(
    marker,
    [
      '  window.__AUTOLINK_TEST__ = {',
      '    buildVocab: buildVocab,',
      '    initObserver: initObserver',
      '  };',
      '',
      marker
    ].join('\n')
  );
  if (instrumented === source) throw new Error('test hook marker was not found');

  vm.runInNewContext(instrumented, {
    document,
    window,
    NodeFilter: { SHOW_TEXT: 4 },
    MutationObserver: FakeMutationObserver,
    fetch() {
      throw new Error('boot fetch should not run in the focused test');
    },
    setTimeout: setTimer,
    clearTimeout: clearTimer,
    Date,
    encodeURIComponent
  });

  window.__AUTOLINK_TEST__.buildVocab([
    { canonical: 'contentinternet', pattern: '\\bcontentinternet\\b' }
  ]);
  window.__AUTOLINK_TEST__.initObserver();
  drainTimers();

  const initialLinks = document.querySelectorAll('.ci-link');
  if (
    initialLinks.length !== 1 ||
    initialLinks[0].href !==
      '/polymyth/concordance/?term=contentinternet'
  ) {
    throw new Error('initial full sweep changed canonical link output');
  }

  const card = document.createElement('section');
  card.className = 'entry';
  const nested = document.createElement('span');
  nested.textContent = 'contentinternet and contentinternet';
  const excludedButton = document.createElement('button');
  excludedButton.textContent = 'contentinternet';
  card.appendChild(nested);
  card.appendChild(excludedButton);
  main.appendChild(card);
  const originalNestedText = nested.childNodes[0];

  walkRoots.length = 0;
  mutationCallback([
    { type: 'childList', addedNodes: [card] },
    { type: 'childList', addedNodes: [nested, originalNestedText] }
  ]);
  drainTimers();

  if (walkRoots.length !== 1 || walkRoots[0] !== card) {
    throw new Error(
      'one-card mutation did not collapse nested additions to one subtree scan'
    );
  }
  if (walkRoots.includes(main) || walkRoots.includes(existing)) {
    throw new Error('one-card mutation rescanned an existing page surface');
  }

  const links = document.querySelectorAll('.ci-link');
  if (links.length !== 3) {
    throw new Error(`expected 3 unchanged generated links, found ${links.length}`);
  }
  if (
    links.some(
      (link) =>
        link.href !== '/polymyth/concordance/?term=contentinternet' ||
        link.textContent !== 'contentinternet'
    )
  ) {
    throw new Error('incremental linking changed a destination or visible term');
  }
  if (excludedButton.querySelectorAll('.ci-link').length !== 0) {
    throw new Error('incremental linking lost the existing button exclusion');
  }
}

try {
  runIncrementalRuntimeCheck();
} catch (error) {
  failures.push(`incremental runtime check failed: ${error.message}`);
}

if (failures.length) {
  console.error('AUTOLINK PERFORMANCE VERIFY FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  'AUTOLINK PERFORMANCE VERIFY PASSED — initial output preserved; one-card mutations stay subtree-local, nested additions deduplicate, and work remains idle-sliced.'
);
