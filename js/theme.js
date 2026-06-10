/* ============================================================
 * SEMINAR SCHOOLS — THEME TOGGLE
 * /js/theme.js
 *
 * Manages light/dark mode preference with three priority layers:
 *  1. User manual toggle (stored in localStorage)
 *  2. OS preference (prefers-color-scheme: dark) — default
 *  3. Light (fallback)
 *
 * Sets .dark or .light class on <html> for manual overrides.
 * No class = follow OS preference via @media in theme.css.
 *
 * Built 2026-05-20 per audit CL-T98 item #19.
 * ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'ss-theme';
  var html = document.documentElement;

  // Read stored preference. Values: 'dark', 'light', or null (no override → OS).
  function getStoredPreference() {
    try { return localStorage.getItem(STORAGE_KEY); }
    catch (e) { return null; }
  }

  function setStoredPreference(val) {
    try {
      if (val === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, val);
    } catch (e) { /* localStorage blocked, fail silently */ }
  }

  // Apply preference to <html> classList.
  function applyPreference(pref) {
    html.classList.remove('dark', 'light');
    if (pref === 'dark') html.classList.add('dark');
    else if (pref === 'light') html.classList.add('light');
    // null preference → no class → @media (prefers-color-scheme) handles it
  }

  // Apply stored preference immediately (before DOMContentLoaded
  // to prevent flash of wrong theme).
  applyPreference(getStoredPreference());

  // Wait for DOM to wire up the toggle button.
  function init() {
    var button = document.querySelector('.theme-toggle');
    if (!button) {
      // Page does not have a toggle button. That is fine — the
      // stored preference is still applied from above.
      return;
    }

    // Initial aria-label reflects what the button DOES (toggles to opposite).
    updateButtonState(button);

    button.addEventListener('click', function () {
      // Toggle logic: cycle through dark → light → null (system).
      // Most users will pick one and stay, so the three-state cycle
      // is for the small subset who want to override and then revert
      // to system.
      var current = getStoredPreference();
      var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next;
      if (current === null) {
        // No override yet → flip away from system default
        next = systemDark ? 'light' : 'dark';
      } else if ((current === 'dark' && systemDark) || (current === 'light' && !systemDark)) {
        // User had flipped TO system default → clear override
        next = null;
      } else {
        // User had flipped AWAY from system → flip back to system default
        next = null;
      }
      setStoredPreference(next);
      applyPreference(next);
      updateButtonState(button);
      announceChange(button);
    });

    // Listen for system preference changes (e.g., user changes OS
    // setting mid-session). Only matters if user has no manual
    // override.
    if (window.matchMedia) {
      var query = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function () {
        if (getStoredPreference() === null) {
          updateButtonState(button);
        }
      };
      if (query.addEventListener) query.addEventListener('change', handler);
      else if (query.addListener) query.addListener(handler);
    }
  }

  function updateButtonState(button) {
    var stored = getStoredPreference();
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var effectiveDark = stored === 'dark' || (stored === null && systemDark);
    button.setAttribute('aria-label', effectiveDark ? 'Switch to light mode' : 'Switch to dark mode');
    button.setAttribute('aria-pressed', effectiveDark ? 'true' : 'false');
  }

  function announceChange(button) {
    // Briefly populate an ARIA live region so screen readers
    // announce the theme switch.
    var live = document.getElementById('theme-toggle-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'theme-toggle-live';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);';
      document.body.appendChild(live);
    }
    var stored = getStoredPreference();
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var effectiveDark = stored === 'dark' || (stored === null && systemDark);
    live.textContent = effectiveDark ? 'Dark mode on' : 'Light mode on';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
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
    var links=[['/','Home'],['/polymythseminars/','Calendar'],['/agora/','Agora'],['/marginalia/','Marginalia'],['/sabachtan-seminar/','Sabachtan'],['/ohm-dome/','Ohm Dome'],['/nutrition/','Nutrition'],['/teacherresources/','Resources'],['/leizu/','Leizu Academy'],['/florilegium/','Florilegium'],['/saul/','Founder']];
    var here=(location.pathname.replace(/\/+$/,'')||'/');
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
