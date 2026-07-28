(() => {
  'use strict';

  const root = document.querySelector('#pmAnnouncementCandidates');
  const list = document.querySelector('#pmAnnouncementCandidateList');
  if (!root || !list) return;
  const french = /^\/polymythseminars\/fr(?:\/|$)/.test(location.pathname)
    || new URLSearchParams(location.search).get('lang') === 'fr';

  function escapeHtml(value) {
    return String(value || '').replace(
      /[&<>"]/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
      }[character]),
    );
  }

  function short(value, maximum = 320) {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    return clean.length > maximum
      ? `${clean.slice(0, maximum - 1).trimEnd()}…`
      : clean;
  }

  function checked(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(french ? 'fr-CA' : 'en-CA', {
      dateStyle: 'medium',
      timeZone: 'America/Toronto',
    }).format(date);
  }

  function card(item) {
    const missing = (item.missing_details || [])
      .map(value => String(value).replaceAll('-', ' '))
      .join(', ');
    const source = item.announcement_url || item.source_url;
    const excerpt = short(item.original_announcement_text);
    return `<article class="pm-announcement-card">
      <p class="pm-badge-row">
        <span class="pm-badge pending">${escapeHtml(
          french ? 'Date à confirmer' : 'Date pending',
        )}</span>
        ${item.cause ? `<span class="pm-badge">${escapeHtml(item.cause)}</span>` : ''}
      </p>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="pm-announcement-meta">${escapeHtml(
        item.organizer || item.source_id,
      )}${missing ? ` · ${escapeHtml(missing)}` : ''}</p>
      ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''}
      <p class="pm-announcement-actions"><a class="pm-action primary-link" href="${escapeHtml(
        source,
      )}" rel="noopener noreferrer">${escapeHtml(
        french ? 'Voir l’annonce originale' : 'Open original announcement',
      )}</a></p>
      ${item.last_checked_at ? `<p class="pm-announcement-checked">${escapeHtml(
        french ? 'Vérifiée' : 'Checked',
      )} ${escapeHtml(checked(item.last_checked_at))}</p>` : ''}
    </article>`;
  }

  async function load() {
    try {
      const response = await fetch('/polymythseminars/candidates.json', {
        cache: 'default',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const payload = await response.json();
      const rows = Array.isArray(payload.announcements)
        ? payload.announcements
        : [];
      if (!rows.length || payload.count !== rows.length) return;
      list.innerHTML = rows.slice(0, 12).map(card).join('');
      root.hidden = false;
    } catch (_) {
      // The dated calendar remains fully usable when this optional surface fails.
    }
  }

  void load();
})();
