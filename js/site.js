// ============================================================================
// SITE.JS — shared behavior across all project pages
// Feature-detects which DOM elements exist and only attaches relevant handlers.
// Replaces ~6.5KB of duplicated inline JS per page with a single shared file.
// ============================================================================

(function() {
  'use strict';

  // ============================================================
  // 1. Reveal-in observer
  // ============================================================
  function initRevealObserver() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything
      document.querySelectorAll('section, header, .lede, h1, .reveal, .threshold-coords').forEach(function(el) {
        el.classList.add('reveal-in');
      });
      return;
    }
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('reveal-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('section, header, .lede, h1, .reveal, .threshold-coords').forEach(function(el) {
      io.observe(el);
    });
  }

  // ============================================================
  // 2. Topbar scrolled-state
  // ============================================================
  function initTopbarScroll() {
    var topbar = document.getElementById('topbar');
    if (!topbar) return;
    window.addEventListener('scroll', function() {
      topbar.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  // ============================================================
  // 3. Word-by-word and char-by-char reveal wrapping
  // ============================================================
  function wrapTitanicChars(html) {
    return html.replace(/(<[^>]+>)|([^<]+)/g, function(m, tag, text) {
      if (tag) return tag;
      return text.replace(/(\S+)/g, function(word) {
        var chars = '';
        for (var i = 0; i < word.length; i++) {
          chars += '<span class="char">' + word[i] + '</span>';
        }
        return '<span class="word-keep">' + chars + '</span>';
      });
    });
  }
  function wrapWords(html) {
    return html.replace(/(<[^>]+>)|([^<]+)/g, function(m, tag, text) {
      if (tag) return tag;
      return text.replace(/(\S+)/g, '<span class="word">$1</span> ').trimEnd();
    });
  }
  function initRevealWrapping() {
    document.querySelectorAll('.titanic.words').forEach(function(el) {
      el.innerHTML = wrapTitanicChars(el.innerHTML);
      el.querySelectorAll('.char').forEach(function(c, i) {
        c.style.transitionDelay = (0.018 * i + 0.05) + 's';
      });
    });
    document.querySelectorAll('.compound.words').forEach(function(el) {
      el.innerHTML = wrapWords(el.innerHTML);
      el.querySelectorAll('.word').forEach(function(w, i) {
        w.style.transitionDelay = (0.06 * i + 0.05) + 's';
      });
    });
  }

  // ============================================================
  // 4. Descent marker scroll sync
  // ============================================================
  function initDescentMarker() {
    var marker = document.getElementById('marker');
    if (!marker) return;
    var sections = document.querySelectorAll('section');
    if (!sections.length) return;
    var roman = marker.querySelector('.roman');
    var name = marker.querySelector('.name');
    var ticks = marker.querySelectorAll('.tick');
    var romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
    function update() {
      var cur = sections[0]; var idx = 0;
      var topBound = window.innerHeight * 0.4;
      for (var i = 0; i < sections.length; i++) {
        var r = sections[i].getBoundingClientRect();
        if (r.top < topBound) { cur = sections[i]; idx = i; }
      }
      var dataRoman = cur.dataset.roman || cur.getAttribute('data-roman') || romans[idx] || (idx + 1);
      var dataName = cur.dataset.name || cur.getAttribute('data-name') ||
        (cur.querySelector('h2,h1') ? cur.querySelector('h2,h1').textContent.split('.')[0].slice(0, 12) : 'Section');
      if (roman) roman.textContent = dataRoman;
      if (name) name.textContent = dataName;
      for (var t = 0; t < ticks.length; t++) {
        ticks[t].classList.toggle('active', t === Math.min(idx, ticks.length - 1));
      }
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ============================================================
  // 5. Post-list fetch (only if #post-list exists on the page)
  //    Filters posts by sectionId from the page's data-section attribute
  // ============================================================
  function initPostList() {
    var listEl = document.getElementById('post-list');
    if (!listEl) return;
    var sectionFilter = listEl.dataset.section || null;
    var emptyEl = document.getElementById('empty-state');
    function esc(str) {
      var d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }
    function formatDate(iso) {
      if (!iso) return '';
      try {
        var d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch (e) { return iso; }
    }
    fetch('/florilegium/posts.json', { cache: 'no-cache' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var posts = (data && data.posts) || [];
        if (sectionFilter) {
          posts = posts.filter(function(p) { return p.sectionId === sectionFilter; });
        }
        if (!Array.isArray(posts) || posts.length === 0) return;
        posts.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
        if (emptyEl) emptyEl.remove();
        posts.forEach(function(p) {
          var li = document.createElement('li');
          li.className = 'post-entry';
          var sectionLabel = p.sectionLabel ? '<a class="post-section-tag" href="' + esc(p.sectionUrl || '#') + '">in ' + esc(p.sectionLabel) + '</a>' : '';
          var dateText = formatDate(p.date);
          li.innerHTML =
            '<div class="post-meta">' +
              (dateText ? '<time datetime="' + esc(p.date || '') + '">' + dateText + '</time>' : '') +
              (sectionLabel ? ' ' + sectionLabel : '') +
            '</div>' +
            '<h3 class="article-title"><a href="' + esc(p.postUrl || '#') + '">' + esc(p.title || 'Untitled') + '</a></h3>' +
            (p.excerpt ? '<p class="article-excerpt">' + esc(p.excerpt) + '</p>' : '');
          listEl.appendChild(li);
        });
      })
      .catch(function() {});
  }

  // ============================================================
  // Initialize everything when DOM is ready
  // ============================================================
  function init() {
    initRevealObserver();
    initTopbarScroll();
    initRevealWrapping();
    initDescentMarker();
    initPostList();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
