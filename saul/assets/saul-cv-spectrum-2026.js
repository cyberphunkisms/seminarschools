(() => {
  'use strict';
  const root = document.querySelector('[data-cv-spectrum]');
  if (!root) return;
  const dataUrl = '/saul/assets/saul-cv-canonical-2026.json';
  let data = null;
  let selected = [];
  let printJobs = null;
  const unique = values => [...new Set(values.filter(Boolean))];
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
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
  const comboKey = values => [...values].sort().join('+');
  const COMBINATION_PROFILES = {
    'performance+teaching': 'Educator and performer combining classroom facilitation, improvisation, presentation, audience awareness, and youth engagement.',
    'programs+teaching': 'Educator and program coordinator combining curriculum, facilitation, events, stakeholder communication, and practical delivery.',
    'programs+research': 'Research and program professional combining evaluation, reporting, coordination, budgeting, partnerships, and public communication.',
    'arts-culture+performance': 'Arts and performance professional with stage, screen, cultural research, public presentation, and festival experience.',
    'community+programs': 'Community and program professional combining partnerships, fundraising, volunteer coordination, events, and public service.',
    'hospitality+programs': 'Hospitality and program professional combining high-volume service, team support, events, scheduling, and practical coordination.',
    'customer-education+teaching': 'Education and learner-support professional combining teaching, onboarding, workshops, clear guidance, and responsive communication.',
    'education+research': 'Education researcher combining mixed-method inquiry, curriculum assessment, source synthesis, reporting, and teaching practice.',
    'portfolio+research': 'Independent project and research professional combining source verification, public information, editorial systems, and digital delivery.',
    'portfolio+teaching': 'Educator and independent project builder creating teaching resources, public learning formats, curriculum tools, and accessible digital materials.',
    'community+volunteer-events': 'Community and volunteer coordinator with fundraising, logistics, accessibility support, public events, and cross-cultural service experience.'
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
    const exact = COMBINATION_PROFILES[comboKey(values)];
    const list = chosen.map(x => x.label.toLowerCase());
    const joined = list.length > 2 ? `${list.slice(0,-1).join(', ')}, and ${list.at(-1)}` : list.join(' and ');
    const profile = exact || `Professional working across ${joined}, with strengths in ${skills.slice(0,3).map(x => x.toLowerCase()).join(', ')}.`;
    return { label, short: label, color: chosen[0].color, profile, skills, credentials, records: sortRecords(records), downloads: chosen[0].downloads, combined: true };
  };
  const jobHTML = r => {
    const title = r.url ? `<a href="${escapeHTML(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(r.title)}</a>` : escapeHTML(r.title);
    const org = r.organization ? ` <span>- ${escapeHTML(r.organization)}</span>` : '';
    const meta = [r.location, r.dates].filter(Boolean).map(escapeHTML).join(' · ');
    const bullets = (r.bullets || []).slice(0, 2).map(x => `<li>${escapeHTML(x)}</li>`).join('');
    return `<article class="cv-spectrum__job"><h4>${title}${org}</h4><p class="cv-spectrum__job-meta">${meta}</p><ul>${bullets}</ul></article>`;
  };
  const preparePrintJobs = () => {
    if (printJobs?.isConnected) return printJobs;
    const template = root.querySelector('[data-cv-print-template]');
    const screen = root.querySelector('[data-cv-jobs]');
    if (!template || !screen) return null;
    printJobs = document.createElement('div');
    printJobs.className = 'cv-spectrum__print-jobs';
    printJobs.dataset.cvPrintJobs = '';
    printJobs.setAttribute('aria-hidden', 'true');
    printJobs.innerHTML = template.innerHTML;
    screen.insertAdjacentElement('afterend', printJobs);
    return printJobs;
  };
  const clearPrintJobs = () => { if (printJobs?.isConnected) printJobs.remove(); printJobs = null; };
  const render = () => {
    const module = combineModules(selected);
    root.style.setProperty('--focus', module.color || '#665A78');
    document.documentElement.style.setProperty('--cv-focus', module.color || '#665A78');
    root.querySelectorAll('[data-cv-role],[data-cv-current]').forEach(el => el.textContent = module.label);
    root.querySelector('[data-cv-profile]').textContent = module.profile;
    root.querySelector('[data-cv-name]').firstChild.nodeValue = data.contact.name;
    root.querySelector('[data-cv-post]').textContent = selected.includes('education') ? ', MA' : '';
    root.querySelector('[data-cv-skills]').innerHTML = (module.skills || []).slice(0, 10).map(x => `<li>${escapeHTML(x)}</li>`).join('');
    const creds = unique([...(module.credentials || []), ...data.languages]);
    if (selected.includes('education')) creds.unshift(...data.education);
    root.querySelector('[data-cv-credentials]').textContent = unique(creds).slice(0, 9).join(' · ');
    root.querySelector('[data-cv-jobs]').innerHTML = sortRecords(module.records).slice(0, 5).map(jobHTML).join('');
    const template = root.querySelector('[data-cv-print-template]');
    if (template) template.innerHTML = sortRecords(module.records).slice(0, 7).map(jobHTML).join('');
    clearPrintJobs();
    root.querySelectorAll('[data-focus-slug]').forEach(el => {
      const on = selected.length === 1 ? el.dataset.focusSlug === selected[0] : (!selected.length && el.dataset.focusSlug === 'general');
      if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    root.querySelectorAll('[data-cv-blend]').forEach(box => box.checked = selected.includes(box.value));
    const count = root.querySelector('[data-cv-selection-count]');
    if (count) count.textContent = selected.length === 0 ? 'Choose focus areas to combine.' : selected.length === 1 ? '1 area selected. Choose one more area for a combined view.' : `${selected.length} areas selected. Combined view ready.`;
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
      designed.href = routeFor(selected); designed.textContent = 'Save combined view as PDF';
      designed.onclick = event => { event.preventDefault(); preparePrintJobs(); requestAnimationFrame(() => window.print()); };
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
  root.querySelectorAll('[data-cv-blend]').forEach(box => box.addEventListener('change', () => setSelected([...root.querySelectorAll('[data-cv-blend]:checked')].map(x => x.value))));
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
    const status = root.querySelector('[data-cv-share-status]');
    if (status) status.textContent = copied ? 'Link copied.' : 'Copy the address from the browser bar.';
    const heading = button.closest('.cv-spectrum__focus-heading');
    if (copied && heading) { heading.classList.add('is-copied'); setTimeout(() => heading.classList.remove('is-copied'), 1600); }
  });
  root.querySelector('[data-cv-print]')?.addEventListener('click', () => { preparePrintJobs(); requestAnimationFrame(() => window.print()); });
  addEventListener('beforeprint', preparePrintJobs);
  addEventListener('afterprint', clearPrintJobs);
  addEventListener('popstate', () => { selected = pathFocus(); render(); });

  const mapFrame = document.querySelector('[data-cv-map-frame]');
  if (mapFrame) {
    const stage = mapFrame.closest('[data-cv-map-stage]');
    const loaded = () => stage?.classList.add('is-loaded');
    mapFrame.addEventListener('load', loaded, {once:true});
    mapFrame.addEventListener('error', () => stage?.classList.add('is-unavailable'), {once:true});
    if (mapFrame.contentDocument?.readyState === 'complete') loaded();
    window.setTimeout(() => {
      if (!stage?.classList.contains('is-loaded')) stage?.classList.add('is-unavailable');
    }, 6500);
  }
  const localNav = document.querySelector('[data-cv-local-nav]');
  if (localNav && 'IntersectionObserver' in window) {
    const links = [...localNav.querySelectorAll('a[href^="#"]')];
    const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(a => a.removeAttribute('aria-current'));
      byId.get(visible.target.id)?.setAttribute('aria-current', 'location');
    }, {rootMargin:'-18% 0px -68% 0px', threshold:[0,.1,.4]});
    sections.forEach(section => observer.observe(section));
  }
  fetch(dataUrl, {credentials:'same-origin'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => { data = d; selected = pathFocus(); render(); }).catch(err => console.error('CV data failed to load', err));
})();
