(() => {
  'use strict';

  const STORAGE_KEY = 'seminarSchools.readerMode.v1';
  const ROOT_CLASS = 'a43-reader-mode';
  let enabled = false;

  try {
    enabled = localStorage.getItem(STORAGE_KEY) === 'on';
  } catch (_) {
    enabled = false;
  }
  document.documentElement.classList.toggle(ROOT_CLASS, enabled);

  function mount() {
    const body = document.body;
    if (!body || body.dataset.readerEligible !== 'true') return;
    if (document.querySelector('[data-a43-reader-control]')) return;

    const region = document.createElement('p');
    region.className = 'a43-reader-control';
    region.dataset.a43ReaderControl = '';

    const button = document.createElement('button');
    button.className = 'a43-reader-toggle';
    button.type = 'button';
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', 'Toggle quiet reader view');

    function paint() {
      button.textContent = enabled ? 'Reader view on' : 'Reader view';
      button.setAttribute('aria-pressed', String(enabled));
      document.documentElement.classList.toggle(ROOT_CLASS, enabled);
    }

    button.addEventListener('click', () => {
      enabled = !enabled;
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
      } catch (_) {
        // The view remains available for this page when storage is disabled.
      }
      paint();
    });

    region.append(button);
    body.prepend(region);
    paint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
