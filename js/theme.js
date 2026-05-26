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
