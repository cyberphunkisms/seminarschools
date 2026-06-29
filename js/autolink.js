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
 * Link density: every occurrence (per Rainbowsol directive).
 * Link styling: color:inherit, faint dotted underline, solid on hover.
 *
 * Adding a new term: edit vocabulary.json, run regen-concordance-index.js, deploy.
 * This file never needs editing for vocabulary changes.
 *
 * Usage: <script src="/js/autolink.js" defer></script>
 */

(function () {
  'use strict';

  var VOCAB = [];         // populated from vocabulary.json
  var COMBINED_RE = null;  // built after vocab loads
  var vocabReady = false;

  // ── Build regex structures from loaded vocabulary data ──
  function buildVocab(terms) {
    VOCAB = [];
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
    for (var i = 0; i < VOCAB.length; i++) {
      VOCAB[i][1].lastIndex = 0;
      if (VOCAB[i][1].test(matched)) {
        VOCAB[i][1].lastIndex = 0;
        return VOCAB[i][0];
      }
    }
    return matched.toLowerCase();
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
  function autolinkNode(root) {
    if (!vocabReady) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) {
      var p = node.parentNode;
      if (!p) continue;
      var tag = p.tagName;
      if (tag === 'A' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') continue;
      if (p.classList && p.classList.contains('ci-link')) continue;
      textNodes.push(node);
    }

    for (var i = 0; i < textNodes.length; i++) {
      var tn = textNodes[i];
      var text = tn.nodeValue;
      if (!COMBINED_RE.test(text)) {
        COMBINED_RE.lastIndex = 0;
        continue;
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
  }

  // ── Public API ──
  window.autolinkEntries = function (selector) {
    if (!vocabReady) return;
    injectCSS();
    var sel = selector || '.eb, .ex, .et, .entry, .bloom, .lede, .notes, .epigraph, .article-excerpt, .articles-intro, .c, .cat-sub, .cr-from, article p, .wrap p, main p';
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      autolinkNode(els[i]);
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

  function scheduleAutolink() {
    if (isLinking) return;
    clearTimeout(debounceId);
    debounceId = setTimeout(function () {
      isLinking = true;
      disconnectObserver();
      window.autolinkEntries();
      reconnectObserver();
      isLinking = false;
    }, 80);
  }

  function initObserver() {
    var containers = document.querySelectorAll(CONTAINER_SELECTORS);
    if (!containers.length) return;
    observedContainers = Array.prototype.slice.call(containers);
    observer = new MutationObserver(function (mutations) {
      if (isLinking) return;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === 'childList' && mutations[i].addedNodes.length > 0) {
          scheduleAutolink();
          return;
        }
      }
    });
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
