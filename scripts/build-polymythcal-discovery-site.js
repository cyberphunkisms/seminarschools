#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { geometryBodyAttributes, geometryAssetVersion } = require('./lib/geometry-asset-version');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
const geometryContracts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'geometry-route-contracts.json'), 'utf8'));
const siteAssetVersion = String(release.polymythcal_asset_version || '20260815-sets1-15-synthesis');
const discoveryAssetVersion = String(release.polymythcal_discovery_asset_version || siteAssetVersion);
const geometryVersion = geometryAssetVersion(ROOT);
const outputMtimeText = String(process.env.SS_BUILD_OUTPUT_MTIME || '').trim();
const outputMtime = outputMtimeText ? new Date(outputMtimeText) : null;
if (outputMtime && Number.isNaN(outputMtime.getTime())) {
  throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp');
}

const surfaces = {
  main: {
    en: { relative: 'polymythseminars/index.html', path: '/polymythseminars/', alternate: '/polymythseminars/fr/', title: 'Polymythcal | Seminar Schools', heading: 'Polymythcal', kicker: 'Seminar Schools public calendar', lede: 'Find public events to attend and opportunities to apply for, with dates and sources you can verify.', description: 'Search and filter public events, opportunities, celestial occurrences, and observances without opening the full research taxonomy.' },
    fr: { relative: 'polymythseminars/fr/index.html', path: '/polymythseminars/fr/', alternate: '/polymythseminars/', title: 'Polymythcal | Seminar Schools', heading: 'Polymythcal', kicker: 'Calendrier public de Seminar Schools', lede: 'Trouvez des événements publics auxquels assister et des possibilités auxquelles postuler, avec des dates et des sources vérifiables.', description: 'Recherchez et filtrez les événements publics, les possibilités, les phénomènes célestes et les observances sans ouvrir toute la taxonomie de recherche.' },
  },
  research: {
    en: { relative: 'polymythseminars/research/index.html', path: '/polymythseminars/research/', alternate: '/polymythseminars/fr/research/', title: 'Research filters | Polymythcal | Seminar Schools', heading: 'Research filters', kicker: 'Polymythcal connected research view', lede: 'Use the specialist taxonomy when a broad calendar filter is not precise enough.', description: 'Search the complete Polymythcal research taxonomy by people, academic form, arts format, participation, civic form, community form, live media, programme, and celestial kind.' },
    fr: { relative: 'polymythseminars/fr/research/index.html', path: '/polymythseminars/fr/research/', alternate: '/polymythseminars/research/', title: 'Filtres de recherche | Polymythcal | Seminar Schools', heading: 'Filtres de recherche', kicker: 'Vue de recherche connectée de Polymythcal', lede: 'Utilisez la taxonomie spécialisée lorsqu’un filtre général du calendrier n’est pas assez précis.', description: 'Parcourez toute la taxonomie de recherche de Polymythcal par personne, forme universitaire, forme artistique, participation, vie civique, communauté, média en direct, programme et phénomène céleste.' },
  },
  monitoring: {
    en: { relative: 'polymythseminars/monitoring/index.html', path: '/polymythseminars/monitoring/', alternate: '/polymythseminars/fr/monitoring/', title: 'Date monitoring | Polymythcal | Seminar Schools', heading: 'Date monitoring', kicker: 'Polymythcal watchlist', lede: 'Public announcements awaiting a confirmed event date stay here until they belong in the dated calendar.', description: 'Browse Polymythcal announcements and opportunities that are being monitored for a confirmed date.' },
    fr: { relative: 'polymythseminars/fr/monitoring/index.html', path: '/polymythseminars/fr/monitoring/', alternate: '/polymythseminars/monitoring/', title: 'Suivi des dates | Polymythcal | Seminar Schools', heading: 'Suivi des dates', kicker: 'Liste de suivi de Polymythcal', lede: 'Les annonces publiques en attente d’une date confirmée restent ici jusqu’à leur entrée dans le calendrier daté.', description: 'Parcourez les annonces et les possibilités que Polymythcal surveille en attendant une date confirmée.' },
  },
};

const ui = {
  en: {
    calendar: 'Calendar', research: 'Research filters', monitoring: 'Date monitoring', views: 'Polymythcal views',
    popularTitle: 'Popular starting points', popularHelp: 'Each link opens a clear, shareable view.', week: 'Next 7 days', apply: 'Applications and deadlines', toronto: 'Toronto and GTA', online: 'Online', celestial: 'Celestial occurrences', openResearch: 'Open Research filters',
    searchCalendar: 'Search the calendar', searchMonitoring: 'Search date monitoring', searchPlaceholder: 'Search titles, people, organizers, places, and topics', monitoringPlaceholder: 'Search monitored announcements', clear: 'Clear', searchHelp: 'Use exact words, quoted phrases, forward prefixes of at least five characters, or a field such as title:, person:, organizer:, place:, topic:, or format:. Similar spellings appear only as suggestions you choose. Press / to focus search.',
    filters: 'Filters', none: 'No filters selected', loading: 'Loading…', commonFilters: 'Common filters', commonHelp: 'Date, attend or apply, place, topic, audience, and participation mode', researchTaxonomy: 'Research taxonomy', researchHelp: 'Families stay closed until you open one or search for a filter.', findFilter: 'Find a specialist filter', filterExample: 'For example: repair café, filmmaker, eclipse', families: 'Research filter families', precise: 'Need a precise format, participant role, level, or celestial kind? Open Research filters.',
    loadingListings: 'Loading listings', calendarLoading: 'The calendar is loading.', sort: 'Sort', soonest: 'Soonest first', relevance: 'Best search match', latest: 'Farthest date first', checked: 'Recently checked', title: 'Title A to Z', chooseView: 'Choose list or calendar view', list: 'List', calendarView: 'Calendar', selected: 'Selected filters', pages: 'Results pages',
    tools: 'Calendar tools', toolsHelp: 'Share, contribute, subscribe, or change language', share: 'Share this view', feeds: 'Calendar feeds', submit: 'Submit an event', correct: 'Correct a listing', french: 'Français', english: 'English',
    related: 'Related Polymyth Commons projects', commons: 'Polymyth Commons', commonsText: 'See the collection and shared method.', teacher: 'Teacher Resources', teacherText: 'Find classroom material.', library: 'Polymythlib', libraryText: 'Browse libraries and commons projects.', noScript: 'Interactive discovery requires JavaScript. You can still use the calendar feeds or site map.', siteMap: 'site map', skip: 'Skip to results', theme: 'Switch colour theme', publicCalendar: 'public calendar', researchView: 'research filters', monitoringView: 'date monitoring', viewResults: 'View results',
  },
  fr: {
    calendar: 'Calendrier', research: 'Filtres de recherche', monitoring: 'Suivi des dates', views: 'Vues de Polymythcal',
    popularTitle: 'Points de départ populaires', popularHelp: 'Chaque lien ouvre une vue claire et partageable.', week: '7 prochains jours', apply: 'Candidatures et échéances', toronto: 'Toronto et le Grand Toronto', online: 'En ligne', celestial: 'Phénomènes célestes', openResearch: 'Ouvrir les filtres de recherche',
    searchCalendar: 'Rechercher dans le calendrier', searchMonitoring: 'Rechercher dans le suivi des dates', searchPlaceholder: 'Rechercher des titres, personnes, organismes, lieux et sujets', monitoringPlaceholder: 'Rechercher les annonces surveillées', clear: 'Effacer', searchHelp: 'Utilisez des mots exacts, des expressions entre guillemets, des préfixes progressifs d’au moins cinq caractères ou un champ comme titre:, personne:, organisme:, lieu:, sujet: ou forme:. Les graphies proches ne paraissent que comme suggestions à choisir. Appuyez sur / pour atteindre la recherche.',
    filters: 'Filtres', none: 'Aucun filtre sélectionné', loading: 'Chargement…', commonFilters: 'Filtres courants', commonHelp: 'Date, assister ou postuler, lieu, sujet, public et mode de participation', researchTaxonomy: 'Taxonomie de recherche', researchHelp: 'Les familles restent fermées jusqu’à leur ouverture ou à la recherche d’un filtre.', findFilter: 'Trouver un filtre spécialisé', filterExample: 'Par exemple : café de réparation, cinéaste, éclipse', families: 'Familles de filtres de recherche', precise: 'Besoin d’une forme, d’un rôle, d’un niveau ou d’un phénomène céleste précis? Ouvrez les filtres de recherche.',
    loadingListings: 'Chargement des fiches', calendarLoading: 'Le calendrier se charge.', sort: 'Trier', soonest: 'Plus proche d’abord', relevance: 'Meilleure correspondance', latest: 'Date la plus éloignée d’abord', checked: 'Vérification la plus récente', title: 'Titre de A à Z', chooseView: 'Choisir la vue liste ou calendrier', list: 'Liste', calendarView: 'Calendrier', selected: 'Filtres sélectionnés', pages: 'Pages de résultats',
    tools: 'Outils du calendrier', toolsHelp: 'Partager, contribuer, s’abonner ou changer de langue', share: 'Partager cette vue', feeds: 'Fils du calendrier', submit: 'Proposer un événement', correct: 'Corriger une fiche', french: 'Français', english: 'English',
    related: 'Projets connexes de Polymyth Commons', commons: 'Polymyth Commons', commonsText: 'Voir la collection et la méthode commune.', teacher: 'Ressources pédagogiques', teacherText: 'Trouver du matériel pour la classe.', library: 'Polymythlib', libraryText: 'Parcourir les bibliothèques et les projets communs.', noScript: 'La découverte interactive exige JavaScript. Vous pouvez toujours utiliser les fils du calendrier ou le plan du site.', siteMap: 'plan du site', skip: 'Aller aux résultats', theme: 'Changer le thème de couleur', publicCalendar: 'calendrier public', researchView: 'filtres de recherche', monitoringView: 'suivi des dates', viewResults: 'Voir les résultats',
  },
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function writeOutput(target, output) {
  const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (old === output) return false;
  const priorMtime = fs.existsSync(target) ? fs.statSync(target).mtimeMs : 0;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
  const futurePrior = priorMtime > Date.now() + 60_000 ? priorMtime + 2_000 : 0;
  const requested = outputMtime ? outputMtime.getTime() : 0;
  const preserved = Math.max(futurePrior, requested);
  if (preserved) fs.utimesSync(target, preserved / 1000, preserved / 1000);
  return true;
}

function staticNavigation(surface, locale) {
  const t = ui[locale];
  const links = [
    [t.calendar, surfaces.main[locale].path, 'main'],
    [t.research, surfaces.research[locale].path, 'research'],
    [t.monitoring, surfaces.monitoring[locale].path, 'monitoring'],
  ];
  return `<nav class="pmd-context-nav" aria-label="${esc(t.views)}" data-i18n-key="views-nav">
${links.map(([label, href, key]) => `<a href="${href}" data-state-link="${key}"${key === surface ? ' aria-current="page"' : ''}>${label}</a>`).join('\n')}
</nav>`;
}

function focusedCalendars(locale) {
  const labels = locale === 'fr'
    ? [['Club d’écriture', 'writingclub'], ['Écriture : enfants', 'writingkids'], ['Écriture : juniors', 'writingjuniors'], ['Écriture : adolescents', 'writingteens'], ['Écriture : cycles supérieurs', 'writinggrads'], ['Université', 'university'], ['Philosophie', 'philosophy'], ['Sciences humaines', 'humanities'], ['Appels à contributions', 'cfps'], ['Conférences', 'lectures'], ['Bourses', 'fellowships']]
    : [['Writing Club', 'writingclub'], ['Writing Kids', 'writingkids'], ['Writing Juniors', 'writingjuniors'], ['Writing Teens', 'writingteens'], ['Writing Grads', 'writinggrads'], ['University', 'university'], ['Philosophy', 'philosophy'], ['Humanities', 'humanities'], ['Calls for papers', 'cfps'], ['Lectures', 'lectures'], ['Fellowships', 'fellowships']];
  const title = locale === 'fr' ? 'Calendriers ciblés' : 'Focused calendars';
  const help = locale === 'fr' ? 'Ouvrir un calendrier consacré à un seul public ou sujet' : 'Open a calendar dedicated to one audience or subject';
  return `<details class="pmd-focused"><summary><strong>${title}</strong><span>${help}</span></summary><nav aria-label="${title}">${labels.map(([label, slug]) => `<a href="/${slug}/${locale === 'fr' ? 'fr/' : ''}">${label}</a>`).join('')}</nav></details>`;
}

function popularStarts(locale) {
  const t = ui[locale];
  return `<nav class="pmd-popular" aria-labelledby="pmdPopularTitle">
<div class="pmd-section-heading"><h2 id="pmdPopularTitle" data-i18n-key="popular-title">${t.popularTitle}</h2><p data-i18n-key="popular-help">${t.popularHelp}</p></div>
<div class="pmd-popular-links">
<a href="?date=7d" data-i18n-key="popular-week">${t.week}</a>
<a href="?kind=apply" data-i18n-key="popular-apply">${t.apply}</a>
<a href="?places=toronto-gta" data-i18n-key="popular-toronto">${t.toronto}</a>
<a href="?formats=online" data-i18n-key="popular-online">${t.online}</a>
<a href="?what=event%3Acelestial-occurrence" data-i18n-key="popular-celestial">${t.celestial}</a>
<a href="${surfaces.research[locale].path}" data-state-link="research" data-i18n-key="popular-research">${t.openResearch}</a>
</div></nav>`;
}

function searchPanel(surface, locale) {
  const t = ui[locale];
  const monitoring = surface === 'monitoring';
  const placeholder = monitoring
    ? t.monitoringPlaceholder
    : t.searchPlaceholder;
  return `<section class="pmd-search-panel" aria-labelledby="pmdSearchLabel">
<label id="pmdSearchLabel" for="pmdSearch" data-i18n-key="search-label">${monitoring ? t.searchMonitoring : t.searchCalendar}</label>
<div class="pmd-search-control">
<input id="pmdSearch" type="search" inputmode="search" autocomplete="off" spellcheck="false" maxlength="240" placeholder="${placeholder}" aria-describedby="pmdSearchHelp pmdSearchStatus" data-i18n-key="search-placeholder">
<button id="pmdClearSearch" type="button" hidden aria-label="${t.clear}" data-i18n-key="clear-search">${t.clear}</button>
</div>
<p id="pmdSearchHelp" class="pmd-help" data-i18n-key="search-help">${t.searchHelp}</p>
<div id="pmdSearchAssist" class="pmd-search-assist" hidden></div>
<p id="pmdSearchStatus" class="pmd-status" role="status" aria-live="polite"></p>
</section>`;
}

function filters(surface, locale) {
  const t = ui[locale];
  if (surface === 'monitoring') {
    return `<details class="pmd-filter-drawer" id="pmdFilterDrawer">
<summary><span><strong data-i18n-key="filters">${t.filters}</strong><span id="pmdFilterSummary">${t.none}</span></span><span id="pmdFilterPreview">${t.loading}</span></summary>
<div class="pmd-filter-body"><div id="pmdCommonFilters" class="pmd-filter-grid" data-filter-mode="monitoring"></div></div>
</details>`;
  }
  if (surface === 'research') {
    return `<section class="pmd-research-tools" aria-labelledby="pmdResearchTitle">
<div class="pmd-section-heading"><h2 id="pmdResearchTitle" data-i18n-key="research-taxonomy">${t.researchTaxonomy}</h2><p data-i18n-key="research-taxonomy-help">${t.researchHelp}</p></div>
<details class="pmd-filter-drawer pmd-research-common" id="pmdResearchCommonDrawer">
<summary><span><strong>${t.commonFilters}</strong><span id="pmdFilterSummary">${t.none}</span></span><span id="pmdFilterPreview">${t.loading}</span></summary>
<div class="pmd-filter-body"><p class="pmd-help">${t.commonHelp}</p><div id="pmdResearchCommonFilters" class="pmd-filter-grid" data-filter-mode="research-common"></div></div>
</details>
<label for="pmdFacetSearch" data-i18n-key="find-filter">${t.findFilter}</label>
<input id="pmdFacetSearch" type="search" autocomplete="off" spellcheck="false" placeholder="${t.filterExample}" aria-describedby="pmdFacetSearchStatus">
<p id="pmdFacetSearchStatus" class="pmd-status" role="status" aria-live="polite"></p>
</section>
<div id="pmdResearchFilters" class="pmd-research-families" aria-label="${t.families}"></div>`;
  }
  return `<details class="pmd-filter-drawer" id="pmdFilterDrawer">
<summary><span><strong data-i18n-key="filters">${t.filters}</strong><span id="pmdFilterSummary">${t.none}</span></span><span id="pmdFilterPreview">${t.loading}</span></summary>
<div class="pmd-filter-body">
<div id="pmdCommonFilters" class="pmd-filter-grid" data-filter-mode="common"></div>
<p class="pmd-research-path"><a href="${surfaces.research[locale].path}" data-state-link="research" data-i18n-key="research-path">${t.precise}</a></p>
</div></details>`;
}

function results(surface, locale) {
  const t = ui[locale];
  const calendar = surface !== 'monitoring';
  return `<section class="pmd-results" id="pmdResults" aria-busy="true" aria-labelledby="pmdResultsTitle">
<div class="pmd-results-heading">
<div><h2 id="pmdResultsTitle" tabindex="-1">${t.loadingListings}</h2><p id="pmdResultsCount">${t.calendarLoading}</p></div>
<div class="pmd-result-controls">
<div class="pmd-sort-control" id="pmdSortControl">
<label for="pmdSort" data-i18n-key="sort">${t.sort}</label>
<select id="pmdSort">
${surface !== 'monitoring' ? `<option value="soonest">${t.soonest}</option><option value="relevance">${t.relevance}</option><option value="latest">${t.latest}</option>` : `<option value="checked">${t.checked}</option><option value="relevance">${t.relevance}</option>`}
<option value="title">${t.title}</option>
</select>
</div>
${calendar ? `<div class="pmd-view-switch" role="group" aria-label="${t.chooseView}"><button type="button" data-view="list" aria-pressed="true">${t.list}</button><button type="button" data-view="calendar" aria-pressed="false">${t.calendarView}</button></div>` : ''}
</div></div>
<div id="pmdSelected" class="pmd-selected" hidden aria-label="${t.selected}"></div>
<p id="pmdLiveStatus" class="pmd-live-status" role="status" aria-live="polite"></p>
<div id="pmdList" class="pmd-list"></div>
${calendar ? '<div id="pmdCalendar" class="pmd-calendar" hidden></div>' : ''}
<nav id="pmdPagination" class="pmd-pagination" aria-label="${t.pages}" hidden></nav>
</section>`;
}

function utilityTools(surface, locale) {
  const t = ui[locale];
  const otherLocale = locale === 'fr' ? 'en' : 'fr';
  return `<details class="pmd-tools">
<summary><strong data-i18n-key="tools">${t.tools}</strong><span data-i18n-key="tools-help">${t.toolsHelp}</span></summary>
<div class="pmd-tool-links">
<button id="pmdShare" type="button" data-i18n-key="share">${t.share}</button>
<a href="${locale === 'fr' ? '/polymythseminars/fr/subscribe/' : '/polymythseminars/subscribe/'}" data-i18n-key="subscribe">${t.feeds}</a>
<a href="${locale === 'fr' ? '/polymythseminars/fr/submit/' : '/polymythseminars/submit/'}" data-i18n-key="submit">${t.submit}</a>
<a href="${locale === 'fr' ? '/polymythseminars/fr/correct/' : '/polymythseminars/correct/'}" data-i18n-key="correct">${t.correct}</a>
<a id="pmdLanguageLink" href="${surfaces[surface][locale].alternate}" hreflang="${otherLocale === 'fr' ? 'fr-CA' : 'en-CA'}">${locale === 'fr' ? t.english : t.french}</a>
</div></details>`;
}

function page(surface, locale) {
  const cfg = surfaces[surface][locale];
  const t = ui[locale];
  const geometry = geometryBodyAttributes(geometryContracts, cfg.relative, 'calendar');
  const isMonitoring = surface === 'monitoring';
  const dataUrl = isMonitoring ? '/polymythseminars/watchlist.json' : '/polymythseminars/browse.json';
  const mobileFilterAttributes = surface === 'research'
    ? 'aria-controls="pmdResearchCommonDrawer pmdResearchFilters"'
    : 'aria-controls="pmdFilterDrawer" aria-expanded="false"';
  const noScript = locale === 'fr'
    ? `La découverte interactive exige JavaScript. Vous pouvez toujours utiliser les <a href="/polymythseminars/fr/subscribe/">fils du calendrier</a> ou le <a href="/sitemap/">plan du site</a>.`
    : `Interactive discovery requires JavaScript. You can still use the <a href="/polymythseminars/subscribe/">calendar feeds</a> or <a href="/sitemap/">site map</a>.`;
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE}${cfg.path}#webpage`,
    url: `${SITE}${cfg.path}`,
    name: cfg.title,
    description: cfg.description,
    inLanguage: locale === 'fr' ? 'fr-CA' : 'en-CA',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'Seminar Schools' },
    about: { '@type': 'Thing', name: surface === 'main' ? 'Polymythcal public calendar' : surface === 'research' ? 'Polymythcal research taxonomy' : 'Polymythcal date monitoring' },
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${locale === 'fr' ? 'fr-CA' : 'en-CA'}">
<head>
<meta charset="utf-8">
<script src="/js/theme-init.js?v=20260723-steady"></script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="ss-build" content="${esc(discoveryAssetVersion)}">
<meta name="description" content="${esc(cfg.description)}">
<meta name="robots" content="index,follow">
<title>${esc(cfg.title)}</title>
<link rel="canonical" href="${SITE}${cfg.path}">
<link rel="alternate" hreflang="en-CA" href="${SITE}${surfaces[surface].en.path}">
<link rel="alternate" hreflang="fr-CA" href="${SITE}${surfaces[surface].fr.path}">
<link rel="alternate" hreflang="x-default" href="${SITE}${surfaces[surface].en.path}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Seminar Schools">
<meta property="og:url" content="${SITE}${cfg.path}"><meta property="og:title" content="${esc(cfg.title)}"><meta property="og:description" content="${esc(cfg.description)}"><meta property="og:image" content="${SITE}/og-image.png">
<script type="application/ld+json">${schema}</script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.json">
<link rel="stylesheet" href="/css/theme.css?v=${esc(siteAssetVersion)}">
<link rel="stylesheet" href="/css/alive.css?v=${esc(geometryVersion)}">
<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=${esc(siteAssetVersion)}" data-site-wide-type-zoom="${esc(siteAssetVersion)}">
<link rel="stylesheet" href="/css/polymythcal-discovery.css?v=${esc(discoveryAssetVersion)}">
<link rel="stylesheet" href="/css/audit43-approved.css?v=20260725-audit43">
<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">
</head>
<body ${geometry} data-page-weight="light" data-pm-app="discovery-v2" data-pmd-surface="${surface}" data-pmd-source="${dataUrl}"${surface === 'research' ? ' data-pmd-research-source="/polymythseminars/research.json"' : ''}>
<a class="skip-link" href="#pmdResultsTitle">${t.skip}</a>
<button class="theme-toggle" type="button" aria-label="${t.theme}" aria-pressed="false"><span class="sun" aria-hidden="true">☀</span><span class="moon" aria-hidden="true">☾</span></button>
<main class="pmd-shell" id="main-content">
<header class="pmd-header"><p class="pmd-kicker"><a href="/">${esc(cfg.kicker)}</a></p><p class="pmd-commons"><a href="/polymythcommons/">Polymyth Commons</a><span aria-hidden="true"> / </span>${surface === 'main' ? t.publicCalendar : surface === 'research' ? t.researchView : t.monitoringView}</p><h1>${esc(cfg.heading)}</h1><p>${esc(cfg.lede)}</p></header>
${staticNavigation(surface, locale)}
${searchPanel(surface, locale)}
${surface === 'main' ? popularStarts(locale) : ''}
${focusedCalendars(locale)}
${filters(surface, locale)}
${results(surface, locale)}
${utilityTools(surface, locale)}
<nav class="pmd-related" aria-label="${t.related}"><a href="/polymythcommons/"><strong>${t.commons}</strong><span>${t.commonsText}</span></a><a href="/teacherresources/"><strong>${t.teacher}</strong><span>${t.teacherText}</span></a><a href="/polymythlib/"><strong>${t.library}</strong><span>${t.libraryText}</span></a></nav>
<noscript><p class="pmd-noscript">${noScript}</p></noscript>
</main>
<div class="pmd-mobile-bar" id="pmdMobileBar" hidden><button id="pmdMobileFilters" type="button" ${mobileFilterAttributes}>${t.filters} <span id="pmdMobileFilterCount">0</span></button><a id="pmdMobileResults" href="#pmdResults">${t.viewResults}</a></div>
<script defer src="/js/polymythcal-discovery-core.js?v=${esc(discoveryAssetVersion)}"></script>
<script defer src="/js/polymythcal-discovery.js?v=${esc(discoveryAssetVersion)}"></script>
<script defer src="/js/theme.js?v=cl91"></script>
<script defer src="/js/mandala.js?v=${esc(geometryVersion)}"></script>
<script defer src="/js/indra.js?v=${esc(geometryVersion)}"></script>
<script defer src="/js/footer.js?v=20260805-predeploy-audit"></script>
<script defer src="/js/site-keyboard-enhancements.js?v=${esc(siteAssetVersion)}"></script>
</body>
</html>`;
}

let changed = 0;
for (const surface of Object.keys(surfaces)) {
  for (const locale of ['en', 'fr']) {
    const cfg = surfaces[surface][locale];
    const output = `${page(surface, locale)}\n`;
    const target = path.join(ROOT, cfg.relative);
    changed += Number(writeOutput(target, output));
  }
}

console.log(`POLYMYTHCAL DISCOVERY SITE BUILT — ${Object.keys(surfaces).length * 2} bilingual routes, ${changed} changed.`);
