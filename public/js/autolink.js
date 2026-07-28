/**
 * autolink.js — contentinternet vocabulary auto-linker
 *
 * Shared module loaded by every page on the site.
 * Fetches vocabulary from /polymyth/concordance/vocabulary.json (single source of truth).
 * After page renders, walks DOM text nodes and wraps contentinternet vocabulary
 * matches in <a> links to the concordance page.
 *
 * Links are display-only: contenteditable save reads .textContent which strips them.
 * Re-injected on every render cycle via MutationObserver.
 *
 * Link density: every important occurrence in generated HTML surfaces (per Rainbowsol directive).
 * Link styling: color:inherit, faint dotted underline, solid on hover.
 *
 * Adding a new term: approve the term, run scripts/build-meaninglib-linkability-registry.js, then regen-all-txt and deploy.
 * Raw .txt/book-source layers are not mutated; this is a generated linkability surface.
 *
 * Usage: <script src="/js/autolink.js" defer></script>
 */

(function () {
  'use strict';
  if (window.__ssAutolinkMounted) return;
  window.__ssAutolinkMounted = true;

  var VOCAB = [];         // populated from vocabulary.json
  var COMBINED_RE = null;  // built after vocab loads
  var vocabReady = false;
  var canonicalCache = Object.create(null);
  var DEFAULT_SELECTOR = '.eb, .ex, .et, .entry, .bloom, .lede, .notes, .epigraph, .article-excerpt, .articles-intro, .c, .cat-sub, .cr-from, article p, article li, article blockquote, .wrap p, .wrap li, .wrap blockquote, main p, main li, main blockquote, main h1, main h2, main h3, main h4, main h5, main h6, .e h3, .e p';

  // ── Build regex structures from loaded vocabulary data ──
  function buildVocab(terms) {
    VOCAB = [];
    canonicalCache = Object.create(null);
    for (var i = 0; i < terms.length; i++) {
      VOCAB.push([terms[i].canonical, new RegExp(terms[i].pattern, 'gi')]);
    }
    COMBINED_RE = new RegExp(
      VOCAB.map(function (v) { return v[1].source; }).join('|'),
      'gi'
    );
    vocabReady = true;
  }

  // ── Map matched text to its canonical term ──
  function canonicalFor(matched) {
    var cacheKey = matched.toLowerCase();
    if (canonicalCache[cacheKey]) return canonicalCache[cacheKey];
    for (var i = 0; i < VOCAB.length; i++) {
      VOCAB[i][1].lastIndex = 0;
      if (VOCAB[i][1].test(matched)) {
        VOCAB[i][1].lastIndex = 0;
        canonicalCache[cacheKey] = VOCAB[i][0];
        return VOCAB[i][0];
      }
    }
    canonicalCache[cacheKey] = cacheKey;
    return cacheKey;
  }

  // ── CSS injection (once) ──
  var styleInjected = false;
  function injectCSS() {
    if (styleInjected) return;
    styleInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.ci-link {',
      '  color: inherit;',
      '  text-decoration: underline;',
      '  text-decoration-style: dotted;',
      '  text-decoration-color: currentColor;',
      '  text-decoration-thickness: 1px;',
      '  text-underline-offset: 2px;',
      '  opacity: 0.85;',
      '  transition: opacity 0.15s, text-decoration-style 0.15s;',
      '  cursor: pointer;',
      '}',
      '.ci-link:hover {',
      '  opacity: 1;',
      '  text-decoration-style: solid;',
      '  text-decoration-color: currentColor;',
      '}',
      '[contenteditable]:focus .ci-link,',
      '[contenteditable="true"]:focus .ci-link {',
      '  pointer-events: none;',
      '  cursor: text;',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── DOM text-node walker ──
  function collectTextNodes(root, textNodes) {
    if (root && root.nodeType === 3) {
      var rootParent = root.parentNode;
      if (!rootParent) return;
      var rootTag = rootParent.tagName;
      if (rootTag === 'A' || rootTag === 'SCRIPT' || rootTag === 'STYLE' || rootTag === 'CODE' || rootTag === 'PRE' || rootTag === 'TEXTAREA' || rootTag === 'INPUT' || rootTag === 'BUTTON' || rootTag === 'SELECT') return;
      if (rootParent.closest && rootParent.closest('[data-no-autolink], nav, .topbar, .keyboard-hint, .route-note, .site-footer')) return;
      if (rootParent.classList && rootParent.classList.contains('ci-link')) return;
      textNodes.push(root);
      return;
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var p = node.parentNode;
      if (!p) continue;
      var tag = p.tagName;
      if (tag === 'A' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT') continue;
      if (p.closest && p.closest('[data-no-autolink], nav, .topbar, .keyboard-hint, .route-note, .site-footer')) continue;
      if (p.classList && p.classList.contains('ci-link')) continue;
      textNodes.push(node);
    }
  }

  function autolinkTextNode(tn) {
    if (!tn || !tn.parentNode || tn.isConnected === false) return;
    var text = tn.nodeValue;
    if (!COMBINED_RE.test(text)) {
      COMBINED_RE.lastIndex = 0;
      return;
    }
    COMBINED_RE.lastIndex = 0;

    var frag = document.createDocumentFragment();
    var lastIdx = 0;
    var match;
    while ((match = COMBINED_RE.exec(text)) !== null) {
      if (match.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      var a = document.createElement('a');
      a.className = 'ci-link';
      a.href = '/polymyth/concordance/?term=' + encodeURIComponent(canonicalFor(match[0]));
      a.textContent = match[0];
      frag.appendChild(a);
      lastIdx = COMBINED_RE.lastIndex;
    }
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    tn.parentNode.replaceChild(frag, tn);
  }

  function autolinkNode(root) {
    if (!vocabReady) return;
    var textNodes = [];
    collectTextNodes(root, textNodes);
    for (var i = 0; i < textNodes.length; i++) {
      autolinkTextNode(textNodes[i]);
    }
  }

  // A selector union may return a container plus hundreds of its descendants.
  // Keep only outermost roots so every text node is walked once per sweep.
  function compactRoots(nodes) {
    var roots = [];
    for (var i = 0; i < nodes.length; i++) {
      var candidate = nodes[i];
      var nested = false;
      for (var j = roots.length - 1; j >= 0; j--) {
        if (roots[j].contains(candidate)) {
          nested = true;
          break;
        }
        if (candidate.contains(roots[j])) roots.splice(j, 1);
      }
      if (!nested) roots.push(candidate);
    }
    return roots;
  }

  function collectAutolinkTextNodes(selector) {
    var roots = compactRoots(document.querySelectorAll(selector || DEFAULT_SELECTOR));
    var textNodes = [];
    for (var i = 0; i < roots.length; i++) {
      collectTextNodes(roots[i], textNodes);
    }
    return textNodes;
  }

  // A mutation may report both a newly inserted card and descendants added while
  // that card was being assembled. Compact those nodes, then walk only the new
  // portions that live on an autolinkable surface. This keeps startup/full scans
  // unchanged while preventing a one-card render from rescanning the page.
  function collectIncrementalAutolinkTextNodes(nodes, selector) {
    var surfaceSelector = selector || DEFAULT_SELECTOR;
    var addedRoots = compactRoots(nodes);
    var textNodes = [];

    for (var i = 0; i < addedRoots.length; i++) {
      var root = addedRoots[i];
      if (!root || root.isConnected === false) continue;

      if (root.nodeType === 3) {
        var parent = root.parentElement || root.parentNode;
        if (parent && parent.closest && parent.closest(surfaceSelector)) {
          collectTextNodes(root, textNodes);
        }
        continue;
      }

      if (root.nodeType !== 1) continue;
      if (root.closest && root.closest(surfaceSelector)) {
        collectTextNodes(root, textNodes);
        continue;
      }

      if (!root.querySelectorAll) continue;
      var matchingRoots = compactRoots(root.querySelectorAll(surfaceSelector));
      for (var j = 0; j < matchingRoots.length; j++) {
        collectTextNodes(matchingRoots[j], textNodes);
      }
    }

    return textNodes;
  }

  // ── Public API ──
  window.autolinkEntries = function (selector) {
    if (!vocabReady) return;
    injectCSS();
    var textNodes = collectAutolinkTextNodes(selector);
    for (var i = 0; i < textNodes.length; i++) {
      autolinkTextNode(textNodes[i]);
    }
  };

  // ── Exports for concordance page ──
  window.CI_VOCAB = VOCAB;
  window.CI_canonicalFor = canonicalFor;

  // ── Self-initializing observer (re-entry-safe) ──
  var debounceId = 0;
  var isLinking = false;
  var observer = null;
  var observedContainers = [];
  var workQueue = [];
  var workIndex = 0;
  var workHandle = 0;
  var rerunRequested = false;
  var pendingFullSweep = false;
  var pendingRoots = [];
  var CONTAINER_SELECTORS = '#entries, #main, #content, #mainwrap, #main-content, #article-list, .wrap, .entry, article, main';

  function disconnectObserver() {
    if (observer) observer.disconnect();
  }

  function reconnectObserver() {
    if (!observer) return;
    for (var i = 0; i < observedContainers.length; i++) {
      observer.observe(observedContainers[i], { childList: true, subtree: true });
    }
  }

  function requestWorkSlice(callback) {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, { timeout: 120 });
    }
    return window.setTimeout(function () {
      var started = Date.now();
      callback({
        timeRemaining: function () {
          return Math.max(0, 8 - (Date.now() - started));
        }
      });
    }, 0);
  }

  function finishAutolinkSweep() {
    workQueue = [];
    workIndex = 0;
    workHandle = 0;
    isLinking = false;
    if (rerunRequested || pendingFullSweep || pendingRoots.length) {
      rerunRequested = false;
      schedulePendingAutolink();
    }
  }

  function runAutolinkSlice(deadline) {
    var processed = 0;
    disconnectObserver();
    while (
      workIndex < workQueue.length &&
      (processed === 0 || deadline.timeRemaining() > 3)
    ) {
      autolinkTextNode(workQueue[workIndex++]);
      processed++;
    }
    reconnectObserver();

    if (workIndex < workQueue.length) {
      workHandle = requestWorkSlice(runAutolinkSlice);
    } else {
      finishAutolinkSweep();
    }
  }

  function beginAutolinkSweep() {
    if (!vocabReady) return;
    injectCSS();
    isLinking = true;
    if (pendingFullSweep) {
      pendingFullSweep = false;
      pendingRoots = [];
      workQueue = collectAutolinkTextNodes();
    } else {
      var roots = pendingRoots;
      pendingRoots = [];
      workQueue = collectIncrementalAutolinkTextNodes(roots);
    }
    workIndex = 0;
    if (!workQueue.length) {
      finishAutolinkSweep();
      return;
    }
    workHandle = requestWorkSlice(runAutolinkSlice);
  }

  function schedulePendingAutolink() {
    if (isLinking) {
      rerunRequested = true;
      return;
    }
    clearTimeout(debounceId);
    debounceId = setTimeout(function () {
      beginAutolinkSweep();
    }, 80);
  }

  function scheduleAutolink(addedRoots) {
    if (addedRoots && addedRoots.length) {
      if (!pendingFullSweep) {
        pendingRoots = compactRoots(pendingRoots.concat(
          Array.prototype.slice.call(addedRoots)
        ));
      }
    } else {
      pendingFullSweep = true;
      pendingRoots = [];
    }
    schedulePendingAutolink();
  }

  function handleMutations(mutations) {
    var addedRoots = [];
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].type !== 'childList') continue;
      for (var j = 0; j < mutations[i].addedNodes.length; j++) {
        addedRoots.push(mutations[i].addedNodes[j]);
      }
    }
    if (addedRoots.length) scheduleAutolink(addedRoots);
  }

  function initObserver() {
    var containers = document.querySelectorAll(CONTAINER_SELECTORS);
    if (!containers.length) return;
    observedContainers = compactRoots(containers);
    observer = new MutationObserver(handleMutations);
    reconnectObserver();
    scheduleAutolink();
  }

  // ── Boot: fetch vocabulary then init ──
  function boot() {
    fetch('/polymyth/concordance/vocabulary.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        buildVocab(data.terms);
        window.CI_VOCAB = VOCAB;
        initObserver();
      })
      .catch(function () {
        // Vocabulary fetch failed — autolink silently disabled.
        // Page still works, just without vocabulary links.
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
