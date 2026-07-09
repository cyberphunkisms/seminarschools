const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const ontologyEl = $('ontologyLock');
const countsEl = $('counts');
const totalsEl = $('totals');
const resultsEl = $('results');
const resultMeta = $('resultMeta');
const queryEl = $('query');
const starFilter = $('starFilter');
const searchBtn = $('searchBtn');

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function loadHealth() {
  const res = await fetch('/api/health');
  const data = await res.json();
  statusEl.textContent = data.ok ? `Ready · ${data.total_docs} docs · ${data.total_terms} terms` : 'Health check failed';
  ontologyEl.textContent = data.ontology_lock;
  const counts = data.star_file_counts || {};
  countsEl.innerHTML = Object.keys(counts).sort().map(k => `
    <div class="count"><span>${esc(k)}${k === 'readme' ? '' : '*'}</span><strong>${counts[k]}</strong></div>
  `).join('');
  totalsEl.innerHTML = `Total docs: <strong>${esc(data.total_docs)}</strong><br>Total terms: <strong>${esc(data.total_terms)}</strong><br>Reports present: <strong>${(data.reports || []).filter(r => r.exists).length}</strong>`;
}

function renderResults(data) {
  resultMeta.textContent = `${data.count} result${data.count === 1 ? '' : 's'} · ${data.star === 'all' ? 'all star files' : data.star + '*'}`;
  if (!data.results.length) {
    resultsEl.innerHTML = '<div class="empty">No results. Try another Meaninglib term.</div>';
    return;
  }
  resultsEl.innerHTML = data.results.map((r, i) => `
    <article class="result">
      <div class="result-title">
        <span class="star">${esc(r.star_file)}${r.star_file === 'readme' ? '' : '*'}</span>
        <h3>${i + 1}. ${esc(r.title)}</h3>
        <span class="score">${Number(r.score).toFixed(2)}</span>
      </div>
      <div class="meta">${esc(r.source_path)}${r.route ? ` · ${esc(r.route)}` : ''}</div>
      <p class="preview">${esc(r.preview)}</p>
    </article>
  `).join('');
}

async function runSearch() {
  const q = queryEl.value.trim();
  if (!q) return;
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching…';
  try {
    const params = new URLSearchParams({ q, star: starFilter.value, limit: '20' });
    const res = await fetch(`/api/search?${params.toString()}`);
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty">Search failed: ${esc(err.message || err)}</div>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

searchBtn.addEventListener('click', runSearch);
queryEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
starFilter.addEventListener('change', runSearch);
document.querySelectorAll('.quick button').forEach(btn => btn.addEventListener('click', () => {
  queryEl.value = btn.dataset.q;
  starFilter.value = 'all';
  runSearch();
}));

loadHealth().then(runSearch).catch(err => {
  statusEl.textContent = 'Health check failed';
  ontologyEl.textContent = err.message || String(err);
});
