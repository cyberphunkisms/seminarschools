/* Seminar Schools pre-paint UI state.
   Applies the saved theme, font scale, and calm interaction contract before
   page styles render so navigation never flashes or reflows on load. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.setAttribute('data-motion', 'calm');
  root.classList.add('ss-ui-ready');

  try {
    var theme = localStorage.getItem('ss-theme') || localStorage.getItem('leizu-theme');
    if (theme === 'dark' || theme === 'light') {
      root.classList.remove('dark', 'light');
      root.classList.add(theme);
      if (theme === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
    }
    var scale = parseFloat(localStorage.getItem('ss-fontscale'));
    if (Number.isFinite(scale)) scale = Math.max(15.5 / 16, Math.min(1.45, scale));
    if (Number.isFinite(scale) && scale >= 15.5 / 16 && scale <= 1.45 && scale !== 1) {
      root.style.setProperty('--font-scale', String(scale));
      root.style.setProperty('--ss-user-font-size', Math.max(15.5, 16 * scale) + 'px');
    }
  } catch (error) {
    // Storage can be unavailable in private or hardened browser contexts.
  }
})();
