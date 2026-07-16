
(() => {
  'use strict';
  const root = document.querySelector('[data-cv-spectrum]');
  if (!root) return;
  const dataUrl = '/saul/assets/saul-cv-canonical-2026.json';
  let data = null;
  let selected = [];
  const unique = values => [...new Set(values.filter(Boolean))];
  const recordRecency = record => {
    const dates = String(record?.dates || '').toLowerCase();
    const years = [...dates.matchAll(/(?:19|20)\d{2}/g)].map(match => Number(match[0]));
    return [(dates.includes('present') ? 1 : 0), Math.max(0, ...years), Math.min(...years, 9999)];
  };
  const sortRecords = records => [...(records || [])].sort((a, b) => {
    const ak = recordRecency(a), bk = recordRecency(b);
    return (bk[0] - ak[0]) || (bk[1] - ak[1]) || (bk[2] - ak[2]);
  });
  const slugs = () => data ? Object.keys(data.modules) : [];
  const pathFocus = () => {
    if (!data) return [];
    const q = new URL(location.href).searchParams.get('focus');
    if (q) return unique(q.split(',')).filter(x => slugs().includes(x) && x !== 'general');
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'saul') return [];
    if (parts[1] === 'cv' && parts[2] && data.modules[parts[2]]) return parts[2] === 'general' ? [] : [parts[2]];
    if (parts[1] === 'hospitality') return ['hospitality'];
    return parts.slice(1).filter(x => data.modules[x] && x !== 'general');
  };
  const routeFor = values => {
    values = unique(values).filter(x => x !== 'general');
    if (!values.length) return '/saul/';
    if (values.length === 1) return data.modules[values[0]].route;
    return '/saul/?focus=' + encodeURIComponent(values.join(','));
  };
  const combineModules = values => {
    values = unique(values).filter(x => data.modules[x] && x !== 'general');
    if (!values.length) return data.modules.general;
    if (values.length === 1) return data.modules[values[0]];
    const chosen = values.map(x => data.modules[x]);
    const label = chosen.map(x => x.short).join(' + ');
    const skills = unique(chosen.flatMap(x => x.skills)).slice(0, 10);
    const credentials = unique(chosen.flatMap(x => x.credentials || [])).slice(0, 6);
    const seen = new Set();
    const records = [];
    sortRecords(chosen.flatMap(x => x.records)).forEach(r => {
      const k = [r.title, r.organization, r.dates].join('|');
      if (!seen.has(k)) { seen.add(k); records.push(r); }
    });
    return {
      label, short: label, color: chosen[0].color,
      profile: `Cross-functional professional combining ${chosen.map(x => x.label.toLowerCase()).join(', ')}. Brings clear communication, reliable delivery and practical experience across the selected areas.`,
      skills, credentials, records: sortRecords(records),
      downloads: chosen[0].downloads,
      combined: true,
    };
  };
  const jobHTML = r => {
    const org = r.organization ? ` <span>- ${escapeHTML(r.organization)}</span>` : '';
    const meta = [r.location, r.dates].filter(Boolean).map(escapeHTML).join(' · ');
    const bullets = (r.bullets || []).slice(0, 2).map(x => `<li>${escapeHTML(x)}</li>`).join('');
    return `<article class="cv-spectrum__job"><h4>${escapeHTML(r.title)}${org}</h4><p class="cv-spectrum__job-meta">${meta}</p><ul>${bullets}</ul></article>`;
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const render = () => {
    const module = combineModules(selected);
    root.style.setProperty('--focus', module.color || '#665A78');
    root.querySelectorAll('[data-cv-role],[data-cv-current]').forEach(el => el.textContent = module.label);
    root.querySelector('[data-cv-profile]').textContent = module.profile;
    root.querySelector('[data-cv-name]').firstChild.nodeValue = data.contact.name;
    root.querySelector('[data-cv-post]').textContent = selected.includes('education') ? ', MA' : '';
    root.querySelector('[data-cv-skills]').innerHTML = (module.skills || []).slice(0, 10).map(x => `<li>${escapeHTML(x)}</li>`).join('');
    const creds = unique([...(module.credentials || []), ...data.languages]);
    if (selected.includes('education')) creds.unshift(...data.education);
    root.querySelector('[data-cv-credentials]').textContent = unique(creds).slice(0, 9).join(' · ');
    root.querySelector('[data-cv-jobs]').innerHTML = sortRecords(module.records).slice(0, 5).map(jobHTML).join('');
    root.querySelector('[data-cv-print-jobs]').innerHTML = sortRecords(module.records).slice(0, 7).map(jobHTML).join('');
    root.querySelectorAll('[data-focus-slug]').forEach(el => {
      const on = selected.length === 1 ? el.dataset.focusSlug === selected[0] : (!selected.length && el.dataset.focusSlug === 'general');
      if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    root.querySelectorAll('[data-cv-blend]').forEach(box => box.checked = selected.includes(box.value));
    const designed = root.querySelector('[data-cv-designed]');
    const ats = root.querySelector('[data-cv-ats]');
    const text = root.querySelector('[data-cv-text]');
    const singleFormats = [...root.querySelectorAll('[data-cv-single-format]')];
    const combinedNote = root.querySelector('[data-cv-combined-note]');
    const isCombined = selected.length > 1;
    singleFormats.forEach(el => { el.hidden = isCombined; });
    if (combinedNote) combinedNote.hidden = !isCombined;
    if (!isCombined) {
      const single = selected.length ? data.modules[selected[0]] : data.modules.general;
      designed.href = single.downloads.designed; designed.textContent = 'Download professional PDF';
      ats.href = single.downloads.ats; text.href = single.downloads.text;
      designed.onclick = null;
    } else {
      designed.href = '#'; designed.textContent = 'Save combined view as PDF';
      designed.onclick = event => { event.preventDefault(); window.print(); };
    }
    document.title = `Saul Karim Nassau - ${module.label} CV`;
  };
  const setSelected = (values, push = true) => {
    const next = unique(values).filter(x => data.modules[x] && x !== 'general');
    const nextUrl = routeFor(next);
    if (push && root.dataset.focusedRoute === 'true') { location.assign(nextUrl); return; }
    selected = next;
    render();
    if (push) history.pushState({focus:selected}, '', nextUrl);
  };
  // Focus choices are ordinary links. The same URL therefore renders the same
  // focused page whether it is opened directly, clicked, reloaded or shared.
  root.querySelectorAll('[data-cv-blend]').forEach(box => box.addEventListener('change', () => {
    setSelected([...root.querySelectorAll('[data-cv-blend]:checked')].map(x => x.value));
  }));
  root.querySelector('[data-cv-copy]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    let copied = false;
    try { await navigator.clipboard.writeText(location.href); copied = true; }
    catch {
      const field = document.createElement('textarea');
      field.value = location.href; field.setAttribute('readonly', '');
      field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.append(field); field.select();
      try { copied = document.execCommand('copy'); } catch {}
      field.remove();
    }
    button.textContent = copied ? 'Link copied' : 'Copy the address bar';
    setTimeout(() => button.textContent = 'Share this view', 1600);
  });
  root.querySelector('[data-cv-print]')?.addEventListener('click', () => window.print());
  addEventListener('popstate', () => { selected = pathFocus(); render(); });
  fetch(dataUrl, {credentials:'same-origin'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => {
    data = d; selected = pathFocus(); render();
  }).catch(err => console.error('CV data failed to load', err));
})();
