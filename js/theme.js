/* ============================================================
 * SEMINAR SCHOOLS — THEME TOGGLE
 * /js/theme.js
 *
 * Direct, predictable light/dark toggle.
 * Earlier versions cycled through system → light/dark → system,
 * which made the button look broken whenever the system preference
 * matched the apparent page state. The control now flips the visible
 * page state every click and persists that explicit choice.
 * ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'ss-theme';
  var html = document.documentElement;

  function getStoredPreference() {
    try { return localStorage.getItem(STORAGE_KEY) || localStorage.getItem('leizu-theme'); }
    catch (e) { return null; }
  }

  function setStoredPreference(val) {
    try {
      localStorage.setItem(STORAGE_KEY, val);
      // Leizu has its own historic key. Keep both in sync so the
      // public theme button and the Leizu chrome button agree.
      localStorage.setItem('leizu-theme', val);
    } catch (e) { /* localStorage blocked, visual state still updates */ }
  }

  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function effectiveTheme() {
    var stored = getStoredPreference();
    if (stored === 'dark' || stored === 'light') return stored;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function applyPreference(pref) {
    if (pref !== 'dark') pref = 'light';
    html.classList.remove('dark', 'light');
    html.classList.add(pref);
    if (pref === 'dark') html.setAttribute('data-theme', 'dark');
    else html.removeAttribute('data-theme');
    updateButtonState();
  }

  function updateButtonState() {
    var theme = html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark' ? 'dark' : effectiveTheme();
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      buttons[i].setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      buttons[i].setAttribute('data-theme-state', theme);
    }
  }

  function announceChange(theme) {
    var live = document.getElementById('theme-toggle-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'theme-toggle-live';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);';
      document.body.appendChild(live);
    }
    live.textContent = theme === 'dark' ? 'Dark mode on' : 'Light mode on';
  }

  function toggle() {
    var current = html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark' ? 'dark' : effectiveTheme();
    var next = current === 'dark' ? 'light' : 'dark';
    setStoredPreference(next);
    applyPreference(next);
    announceChange(next);
  }

  // Apply an explicit stored preference before DOMContentLoaded; otherwise
  // leave the CSS media query in charge until the user clicks.
  var stored = getStoredPreference();
  if (stored === 'dark' || stored === 'light') applyPreference(stored);

  function init() {
    updateButtonState();
    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('.theme-toggle') : null;
      if (!button) return;
      event.preventDefault();
      toggle();
    });

    if (window.matchMedia) {
      var query = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function () {
        var stored = getStoredPreference();
        if (stored !== 'dark' && stored !== 'light') updateButtonState();
      };
      if (query.addEventListener) query.addEventListener('change', handler);
      else if (query.addListener) query.addListener(handler);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ============================================================
 * LETTER SIZE — persisted font scaling. Added 2026-06-04 per
 * Kira UI review. Hooks: [data-fz="up" | "down" | "reset"].
 * Scales the html base size through --font-scale (theme.css
 * applies the calc) and persists to localStorage. Uses event
 * delegation and its own data hooks, so it never collides with
 * any page's bespoke text-size script.
 * ============================================================ */
(function () {
  'use strict';
  var KEY = 'ss-fontscale';
  var MIN = 0.85, MAX = 1.45, STEP = 0.0833;
  var root = document.documentElement;

  function get() {
    try { var v = parseFloat(localStorage.getItem(KEY)); return isNaN(v) ? 1 : v; }
    catch (e) { return 1; }
  }
  function clamp(v) { return Math.max(MIN, Math.min(MAX, Math.round(v * 1000) / 1000)); }
  function apply(v) { root.style.setProperty('--font-scale', String(v)); root.style.fontSize = (v === 1 ? '' : (16 * v) + 'px'); }
  function save(v) {
    try { if (v === 1) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(v)); }
    catch (e) {}
  }
  function resetVis(v) {
    var btns = document.querySelectorAll('[data-fz="reset"]');
    for (var i = 0; i < btns.length; i++) btns[i].style.display = (v === 1 ? 'none' : '');
  }

  // Apply stored scale immediately to avoid a flash of unscaled type.
  apply(get());

  function init() { resetVis(get()); }

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-fz]') : null;
    if (!b) return;
    var act = b.getAttribute('data-fz');
    var v = get();
    if (act === 'up') v = clamp(v + STEP);
    else if (act === 'down') v = clamp(v - STEP);
    else if (act === 'reset') v = 1;
    else return;
    apply(v); save(v); resetVis(v);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


/* CL-2026-06-04 #6: shared site footer nav. Injected only on pages that have no <footer> of their own. */
(function(){
  function inject(){
    if (document.querySelector('.ss-sitenav') || document.querySelector('footer')) return;
    var here=(location.pathname.replace(/\/+$/,'')||'/');
    /* Hierarchy refactor: branch-aware footer. Up to Home, across to branch siblings only, no full roster. First-pass branch map; open to correction. */
    function nrm(p){return p.replace(/\/+$/,'')||'/';}
    function inb(ps){return ps.some(function(p){var n=nrm(p);return here===n||here.indexOf(n+'/')===0;});}
    var TREE={
      teaching:[['/leizu/','Leizu Academy'],['/agora/','The Agora'],['/teacherresources/','Teacher Resources']],
      whatson:[['/polymythseminars/','Calendar'],['/marginalia/','Marginalia']],
      framework:[['/polymyth/','Polymyth'],['/campaigns/','Campaigns'],['/bb/','Bookworm Burrows']],
      projects:[['/ohm-dome/','Ohm Dome'],['/florilegium/','Florilegium'],['/nutrition/','Nutrition']],
      about:[['/saul/','Founder'],['/reviews/','Reviews'],['/polymyth/sitemap/','Sitemap']]
    };
    var sibs;
    if(inb(['/leizu/'])) sibs=[['/agora/','The Agora']];
    else if(inb(['/agora/','/teacherresources/','/aitr/'])) sibs=TREE.teaching;
    else if(inb(['/polymythseminars/','/marginalia/'])) sibs=TREE.whatson;
    else if(inb(['/ohm-dome/','/florilegium/','/nutrition/'])) sibs=TREE.projects;
    else if(inb(['/saul/','/reviews/'])) sibs=TREE.about;
    else if(inb(['/polymyth/','/campaigns/','/bb/','/bookwormcard/','/aa/','/apply/'])) sibs=TREE.framework;
    else sibs=[];
    var links=[['/','Home']];
    sibs.forEach(function(l){if(here.indexOf(nrm(l[0]))!==0)links.push(l);});
    var nav=document.createElement('nav');
    nav.className='ss-sitenav';
    nav.setAttribute('aria-label','Site');
    nav.style.cssText='margin-top:4rem;padding:2.2rem 1.25rem;border-top:1px solid currentColor;opacity:0.8;font-family:var(--font-sans,system-ui,sans-serif);font-size:0.8rem;letter-spacing:0.04em;line-height:2.4;text-align:center;';
    links.forEach(function(l,i){
      var path=(l[0].replace(/\/+$/,'')||'/');
      if(i){var s=document.createElement('span');s.textContent='\u00b7';s.style.cssText='margin:0 0.7rem;opacity:0.4;';nav.appendChild(s);}
      if(path===here){var c=document.createElement('span');c.textContent=l[1];c.style.opacity='0.5';nav.appendChild(c);}
      else{var a=document.createElement('a');a.href=l[0];a.textContent=l[1];a.style.cssText='color:inherit;text-decoration:none;border-bottom:1px solid transparent;';a.addEventListener('mouseenter',function(){this.style.borderBottomColor='currentColor';});a.addEventListener('mouseleave',function(){this.style.borderBottomColor='transparent';});nav.appendChild(a);}
    });
    document.body.appendChild(nav);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject); else inject();
})();
