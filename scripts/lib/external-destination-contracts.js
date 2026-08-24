'use strict';

function httpUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch (_) {
    return '';
  }
}

const OFFICIAL_SOURCE_QUALITIES = new Set(['official', 'official-or-institutional', 'institutional']);
const DESTINATION_STATUSES = new Set([
  'official-event-page',
  'official-series-page',
  'source-event-page',
  'source-series-page',
  'unavailable-specific-page',
]);
const DESTINATION_SCOPES = new Set(['event', 'series', 'unavailable']);
const DESTINATION_KINDS = new Set([
  'detail', 'schedule', 'registration', 'application', 'submission', 'tickets', 'review', 'results', 'unavailable',
]);
const STOP_TOKENS = new Set([
  'a', 'an', 'and', 'at', 'by', 'de', 'des', 'du', 'en', 'et', 'for', 'from', 'in', 'la', 'le', 'les',
  'of', 'on', 'or', 'the', 'to', 'with', 'www', 'ca', 'com', 'org', 'net', '2025', '2026', '2027',
]);
const BROAD_TERMINALS = new Set([
  'about', 'activities', 'annual', 'archive', 'awards', 'calendar', 'calendrier', 'calls', 'classes', 'competitions',
  'conference', 'conferences', 'courses', 'deadlines', 'event', 'events', 'events-calendar', 'event-listings',
  'festival', 'festivals', 'fellowships', 'funding', 'grants', 'home', 'information', 'lectures', 'lineup', 'news',
  'opportunities', 'performances', 'program', 'programme', 'programs', 'programmes', 'schedule', 'seminars',
  'shows', 'whats-on', 'workshops',
]);
const ROUTE_MARKERS = new Set([
  'activity', 'article', 'articles', 'event', 'events', 'event-details', 'festival', 'festivals', 'news', 'play',
  'plays', 'production', 'productions', 'program', 'programme', 'show', 'shows', 'workshop', 'workshops',
]);
const GENERIC_COMPOUND_TERMINALS = new Set([
  'activities-and-events', 'all-events', 'community-events', 'event-calendar', 'event-calendars', 'event-list',
  'event-listings', 'events-and-activities', 'events-calendar', 'events-list', 'festivals-and-events',
  'opportunities-board', 'programs-and-events', 'summer-event-programs', 'upcoming-events', 'upcoming-shows',
]);
const RECURRING_ROUTE_TOKENS = new Set([
  'annual', 'biennial', 'colloquium', 'conference', 'congress', 'convention', 'festival', 'meetings',
  'recurring', 'season', 'series', 'symposium',
]);
const NONOFFICIAL_EXACT_SOURCE_IDS = new Set([
  'watch-findaprotest-palestinian-football-exhibit-2026-07-18',
]);
// Reviewed generic indexes are research inputs only. Title/path token overlap
// must never promote them to visitor-facing actions.
const REVIEWED_GENERIC_DENIED_ROUTES = new Set([
  'accute.ca/category/contest',
  'apaonline.org/events/event_list.asp',
  'appliedphil.org/conference',
  'archaeological.org/programs/professionals/grants-awards',
  'hastac.org/opportunities',
  'iwm.at/program/fellowships',
  'folger.edu/research/fellowships',
  'nias.knaw.nl/fellowships',
  'sshrc-crsh.gc.ca/society-societe/storytellers-jai_une_histoire_a_raconter/index-eng.aspx',
  'studentpress.org/acp/conventions',
  'studentpress.org/nspa/conventions',
  'toronto.ca/explore-enjoy/festivals-events/doorsopen',
  'warburg.sas.ac.uk/research/fellowships',
]);
// These stable organizer routes were reviewed because their CMS slugs do not
// preserve enough of the event title for token matching (pluralization,
// acronyms, or compact slugs). They are still exact series/program pages, not
// organizer homepages, calendars, or category listings.
const REVIEWED_EXACT_SERIES_ROUTES = new Set([
  'adho.org/conference',
  'americanliteratureassociation.org/ala-conferences/ala-annual-conference',
  'canadianarchaeology.com/presidents-messages/presidents-fall-message',
  'cas-sca.ca/en/conferences',
  'cfacanada.org/ethics/canada-ethics-challenge',
  'cha-shc.ca/about/what-we-do/annual-meeting',
  'collegeart.org/programs/conference/proposals',
  'isanet.org/conferences/isa2027/call',
  'lawandsociety.org/annual-meetings',
  'philos.humanities.mcmaster.ca/philosophy-department-speaker-series',
  'saa.org/annualmeeting/saaannualmeeting/annual-meeting.aspx',
  'studentphilosophyjournal.ca/submission-criteria',
  'torontozinelibrary.org/hourslocation',
  'younginklings.org/inklingsbookcontest',
]);
const REVIEWED_EXACT_EVENT_ROUTES = new Set([
  'toronto.ca/explore-enjoy/festivals-events/nuitblanche',
]);

function httpsUrl(value) {
  const href = httpUrl(value);
  if (!href) return '';
  try { return new URL(href).protocol === 'https:' ? href : ''; } catch (_) { return ''; }
}

function fold(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokens(value) {
  return fold(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !STOP_TOKENS.has(token));
}

function positivePathEvidence(event, parsed) {
  const pathTokens = new Set(tokens(decodeURIComponent(parsed.pathname)));
  const segments = parsed.pathname.split('/').filter(Boolean);
  const finalTokens = new Set(tokens(decodeURIComponent(segments[segments.length - 1] || '')));
  const titleTokens = [...new Set(tokens(event && event.title))];
  const overlap = titleTokens.filter((token) => pathTokens.has(token));
  const finalOverlap = titleTokens.filter((token) => finalTokens.has(token));
  return {
    overlap,
    finalOverlap,
    strongOverlap: overlap.length >= 2 || overlap.some((token) => token.length >= 7),
    strongFinalOverlap: finalOverlap.length >= 2 || finalOverlap.some((token) => token.length >= 7),
    pathTokens,
    finalTokens,
    titleTokens,
  };
}

function opaqueIdentifierEvidence(parsed) {
  const values = [
    ...parsed.pathname.split('/').filter(Boolean),
    ...[...parsed.searchParams.entries()].flat(),
  ].map((value) => decodeURIComponent(value));
  return values.some((value) => {
    const clean = value.replace(/[^A-Za-z0-9]/g, '');
    if (/^(?:19|20)\d{2}$/.test(clean) || /^\d{8}$/.test(clean)) return false;
    if (/^\d{5,}$/.test(clean)) return true;
    // Pure words are never identifiers. Require both letters and numeric entropy.
    return clean.length >= 8 && /[A-Za-z]/.test(clean) && /\d/.test(clean);
  });
}

function inferActionKind(event, parsed) {
  const segments = parsed.pathname.split('/').filter(Boolean)
    .map((value) => fold(decodeURIComponent(value)).replace(/\.(?:aspx?|html?|php)$/i, ''));
  const title = fold(event && event.title);
  const hasSegment = (values) => segments.some((segment) => values.includes(segment));
  // Action kinds come from structural route segments, not incidental words in
  // an event slug or organizer/publication name (for example "Design Review
  // Panel" or "Harvard International Review").
  if (hasSegment(['peer-review', 'peerreview', 'judging', 'review', 'reviews'])) return 'review';
  if (hasSegment(['result', 'results', 'winner', 'winners', 'finalist', 'finalists', 'timeline'])) return 'results';
  if (hasSegment(['ticket', 'tickets', 'box-office', 'boxoffice'])) return 'tickets';
  if (hasSegment(['registration', 'register', 'rsvp']) && /\b(registration|register|rsvp|deadline)\b/.test(title)) return 'registration';
  if (hasSegment(['application', 'applications', 'apply']) && /\b(application|applications|apply|deadline|fellowship|grant|residency)\b/.test(title)) return 'application';
  if (hasSegment(['submission', 'submissions', 'submit', 'enter']) && /\b(submission|submissions|submit|entry|enter|deadline|contest|competition|call)\b/.test(title)) return 'submission';
  return '';
}

function terminalRoute(parsed) {
  const segments = parsed.pathname.split('/').filter(Boolean).map((value) => fold(decodeURIComponent(value)));
  return (segments[segments.length - 1] || '').replace(/\.(?:aspx?|html?|php)$/i, '');
}

function reviewedRouteKey(parsed) {
  const host = fold(parsed.hostname).replace(/^www\./, '');
  const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, '').toLowerCase();
  return `${host}${path || '/'}`;
}

function genericCompoundTerminal(parsed) {
  return GENERIC_COMPOUND_TERMINALS.has(terminalRoute(parsed));
}

function dateArchiveRoute(parsed) {
  const segments = parsed.pathname.split('/').filter(Boolean).map((value) => fold(decodeURIComponent(value)));
  const terminal = segments[segments.length - 1] || '';
  return segments.some((segment) => /^(?:19|20)\d{2}$/.test(segment))
    && (/^\d{4}-\d{2}-\d{2}$/.test(terminal) || segments.includes('day') || segments.includes('month'));
}

function recurringRecordEvidence(event) {
  if (!event) return false;
  if (String(event.series_role || '').toLowerCase() === 'child') return false;
  if (String(event.series_role || '').toLowerCase() === 'parent') return true;
  if (event.is_parent_festival) return true;
  if (Array.isArray(event.previous_dates) && event.previous_dates.length) return true;
  if (event.recurrence_note) return true;
  return /\b(annual|biennial|conference|congress|convention|festival|recurring|season|series|symposium)\b/.test(fold(event.title));
}

function explicitActionDestination(event) {
  const source = httpsUrl(event && event.source_url);
  const candidates = [
    ['registration', event && event.registration_url],
    ['application', event && event.application_url],
    ['submission', event && event.submission_url],
  ].map(([kind, value]) => [kind, httpsUrl(value)])
    .filter(([, value]) => value && value !== source);
  const distinct = new Map();
  for (const [kind, value] of candidates) if (!distinct.has(value)) distinct.set(value, kind);
  if (!distinct.size) return null;
  if (distinct.size > 1) {
    const primary = String(event && event.primary_action_kind || '').toLowerCase();
    if (!primary) return null;
    const selected = [...distinct].find(([, kind]) => kind === primary);
    return selected ? { href: selected[0], declaredKind: selected[1] } : null;
  }
  const [href, declaredKind] = [...distinct][0];
  return { href, declaredKind };
}

function normalizedOverride(override, official) {
  if (!override) return null;
  const href = httpsUrl(override.destination_url);
  const scope = String(override.destination_scope || 'event');
  const kind = String(override.destination_kind || 'detail');
  if (!href || !DESTINATION_SCOPES.has(scope) || scope === 'unavailable' || !DESTINATION_KINDS.has(kind) || kind === 'unavailable') {
    throw new Error(`Invalid reviewed destination override for ${override.event_id || 'unknown event'}`);
  }
  const parsed = new URL(href);
  if ((parsed.pathname === '/' || !parsed.pathname) && !parsed.search && override.dedicated_event_site !== true) {
    throw new Error(`Root-page destination override for ${override.event_id || 'unknown event'} is not marked as a dedicated event site`);
  }
  return {
    status: `${official ? 'official' : 'source'}-${scope}-page`,
    href,
    scope,
    kind,
    evidence: override.dedicated_event_site ? 'reviewed-dedicated-event-site' : 'reviewed-override',
  };
}

function unavailableDestination() {
  return {
    status: 'unavailable-specific-page', href: '', scope: 'unavailable', kind: 'unavailable', evidence: 'fail-closed',
  };
}

function seriesFamilyParent(event, groupEvents) {
  if (String(event && event.series_role || '').toLowerCase() === 'parent') return event;
  const parentId = String(event && event.parent_id || '');
  return parentId ? groupEvents.find((record) => String(record.id || '') === parentId) || null : null;
}

function specificSeriesRoute(event, parsed) {
  const evidence = positivePathEvidence(event, parsed);
  const identifier = opaqueIdentifierEvidence(parsed);
  const terminal = terminalRoute(parsed);
  const recurringRoute = [...evidence.pathTokens].some((token) => RECURRING_ROUTE_TOKENS.has(token));
  if (dateArchiveRoute(parsed) || genericCompoundTerminal(parsed)) return false;
  if (evidence.strongFinalOverlap || evidence.overlap.length >= 2) return true;
  if (identifier && (evidence.overlap.length >= 1 || /\/(?:event|events)\//i.test(parsed.pathname))) return true;
  // Keep recurring subject routes distinct from generic taxonomy pages. The
  // latter remain research evidence only and never become visitor actions.
  return recurringRecordEvidence(event) && recurringRoute && !BROAD_TERMINALS.has(terminal);
}

function groupSeriesEvidence(event, parsed, groupEvents) {
  if (!Array.isArray(groupEvents) || groupEvents.length < 2) return false;
  const parent = seriesFamilyParent(event, groupEvents);
  if (!parent || genericCompoundTerminal(parsed) || dateArchiveRoute(parsed)) return false;
  const evidence = positivePathEvidence(parent, parsed);
  // URL reuse is not series evidence. A shared URL is promoted only when the
  // source data declares a parent/child family and that parent's identity is
  // independently present in the path (or the route carries a non-date opaque
  // identifier). This deliberately suppresses generic calendars and duplicate
  // rows that happen to share a URL.
  return evidence.overlap.length >= 2 || opaqueIdentifierEvidence(parsed);
}

function resolvePolymythcalDestination(event, context = {}) {
  const official = OFFICIAL_SOURCE_QUALITIES.has(String(event && event.source_quality || '').toLowerCase());
  const reviewed = normalizedOverride(context.override, official);
  if (reviewed) return reviewed;
  const action = explicitActionDestination(event);
  const href = action ? action.href : httpsUrl(event && event.source_url);
  if (!href) return unavailableDestination();
  let parsed;
  try { parsed = new URL(href); } catch (_) { return unavailableDestination(); }
  if (/(^|\.)seminarschools\.com$/i.test(parsed.hostname)) return unavailableDestination();
  if (NONOFFICIAL_EXACT_SOURCE_IDS.has(String(event && event.id || ''))) {
    return { status: 'source-event-page', href, scope: 'event', kind: 'detail', evidence: 'specific-source-url' };
  }
  const segments = parsed.pathname.split('/').filter(Boolean).map((value) => fold(decodeURIComponent(value)));
  if (!segments.length) return unavailableDestination();
  const finalSegment = segments[segments.length - 1];
  const reviewedRoute = reviewedRouteKey(parsed);
  if (REVIEWED_GENERIC_DENIED_ROUTES.has(reviewedRoute)) return unavailableDestination();
  if (!action && REVIEWED_EXACT_SERIES_ROUTES.has(reviewedRoute)) {
    const schedule = /\b(schedule|calendar|calendrier|dates|deadlines|hearings|meetings)\b/.test(fold(parsed.pathname));
    return {
      status: `${official ? 'official' : 'source'}-series-page`, href, scope: 'series',
      kind: schedule ? 'schedule' : 'detail', evidence: 'reviewed-specific-series-route',
    };
  }
  if (!action && REVIEWED_EXACT_EVENT_ROUTES.has(reviewedRoute)) {
    return {
      status: `${official ? 'official' : 'source'}-event-page`, href, scope: 'event',
      kind: 'detail', evidence: 'reviewed-specific-event-route',
    };
  }
  const pathEvidence = positivePathEvidence(event, parsed);
  const identifierEvidence = opaqueIdentifierEvidence(parsed);
  const actionKind = inferActionKind(event, parsed);
  if (action) {
    const exactActionPage = pathEvidence.strongOverlap || pathEvidence.strongFinalOverlap || identifierEvidence;
    if (!exactActionPage || dateArchiveRoute(parsed) || genericCompoundTerminal(parsed)) return unavailableDestination();
    return {
      status: `${official ? 'official' : 'source'}-event-page`, href, scope: 'event',
      kind: action.declaredKind, evidence: 'specific-action-url',
    };
  }
  const markerSpecific = segments.some((segment, index) =>
    ROUTE_MARKERS.has(segment)
    && index < segments.length - 1
    && !BROAD_TERMINALS.has(segments[index + 1])
    && (pathEvidence.strongOverlap || identifierEvidence));
  const nonBroadSpecificPath = !BROAD_TERMINALS.has(finalSegment)
    && !genericCompoundTerminal(parsed)
    && !dateArchiveRoute(parsed)
    && (pathEvidence.strongFinalOverlap || pathEvidence.overlap.length >= 2 || markerSpecific
      || (identifierEvidence && pathEvidence.overlap.length >= 1));
  const groupEvents = Array.isArray(context.groupEvents) ? context.groupEvents : [];
  const series = groupEvents.length > 1 && groupSeriesEvidence(event, parsed, groupEvents);
  if (series) {
    const schedule = /\b(schedule|calendar|calendrier|dates|deadlines|hearings|meetings)\b/.test(fold(parsed.pathname));
    return {
      status: `${official ? 'official' : 'source'}-series-page`, href, scope: 'series',
      kind: actionKind || (schedule ? 'schedule' : 'detail'), evidence: 'specific-source-series',
    };
  }
  if (groupEvents.length > 1) return unavailableDestination();
  // A recognized event/detail route ending in a specific slug or a non-date
  // opaque ID is an exact event page. It outranks generic title words such as
  // "conference" or "festival", which do not by themselves make a page a
  // recurring-series destination.
  const declaredChild = String(event && event.series_role || '').toLowerCase() === 'child';
  if (markerSpecific && (identifierEvidence || declaredChild)) {
    return {
      status: `${official ? 'official' : 'source'}-event-page`, href, scope: 'event',
      kind: actionKind || 'detail', evidence: 'specific-source-url',
    };
  }
  if (recurringRecordEvidence(event) && specificSeriesRoute(event, parsed)) {
    const schedule = /\b(schedule|calendar|calendrier|dates|deadlines|hearings|meetings)\b/.test(fold(parsed.pathname));
    return {
      status: `${official ? 'official' : 'source'}-series-page`, href, scope: 'series',
      kind: actionKind || (schedule ? 'schedule' : 'detail'), evidence: 'specific-source-series',
    };
  }
  if (!actionKind && !nonBroadSpecificPath) return unavailableDestination();
  return {
    status: `${official ? 'official' : 'source'}-event-page`, href, scope: 'event',
    kind: actionKind || 'detail', evidence: 'specific-source-url',
  };
}

function destinationLabel(destination, lang = 'en') {
  const french = String(lang).toLowerCase().startsWith('fr');
  const kind = destination && destination.kind;
  const sourcePage = String(destination && destination.status || '').startsWith('source-');
  const byKind = french ? {
    registration: "Ouvrir la page d’inscription", application: "Ouvrir la page de candidature",
    submission: "Ouvrir la page de soumission", tickets: "Ouvrir la billetterie",
    review: "Ouvrir la page d’évaluation", results: "Ouvrir la page des résultats",
    schedule: sourcePage ? "Ouvrir l’horaire source" : (destination && destination.scope === 'series' ? "Ouvrir l’horaire officiel" : "Ouvrir l’horaire"),
  } : {
    registration: 'Open registration page', application: 'Open application page',
    submission: 'Open submission page', tickets: 'Open ticket page',
    review: 'Open review page', results: 'Open results page',
    schedule: sourcePage ? 'Open source schedule' : (destination && destination.scope === 'series' ? 'Open official schedule' : 'Open schedule'),
  };
  if (byKind[kind]) return byKind[kind];
  if (destination && destination.scope === 'series') {
    if (sourcePage) return french ? 'Ouvrir la page source de la série' : 'Open series source page';
    return french ? 'Ouvrir la page officielle de la série' : 'Open official series page';
  }
  if (sourcePage) return french ? "Ouvrir la page source de l’événement" : 'Open event source page';
  return french ? "Ouvrir la page officielle de l’événement" : 'Open official event page';
}

function materializedPolymythcalDestination(event) {
  const status = String(event && event.destination_status || '');
  const rawHref = String(event && event.destination_url || '');
  const href = httpsUrl(rawHref);
  const scope = String(event && event.destination_scope || '');
  const kind = String(event && event.destination_kind || '');
  const evidence = String(event && event.destination_evidence || '');
  if (!DESTINATION_STATUSES.has(status) || !DESTINATION_SCOPES.has(scope) || !DESTINATION_KINDS.has(kind) || !evidence) {
    throw new Error(`Polymythcal event ${event && event.id || 'unknown'} has no valid materialized destination contract`);
  }
  if (status === 'unavailable-specific-page') {
    if (rawHref || scope !== 'unavailable' || kind !== 'unavailable') {
      throw new Error(`Polymythcal event ${event && event.id || 'unknown'} has an inconsistent unavailable destination contract`);
    }
    return { status, href: '', scope, kind, evidence };
  }
  if (!href || !status.endsWith(`-${scope}-page`) || !['event', 'series'].includes(scope) || kind === 'unavailable') {
    throw new Error(`Polymythcal event ${event && event.id || 'unknown'} has an inconsistent available destination contract`);
  }
  return { status, href, scope, kind, evidence };
}

function polymythcalDestination(event) {
  return materializedPolymythcalDestination(event);
}

function polymythCommonsDestination(project) {
  const current = httpUrl(project && project.currentCanonicalUrl);
  if (project && project.verified && current) {
    const byState = {
      ACTIVE: ['current-site', 'Visit current site'],
      ACTIVE_AT_NEW_URL: ['current-site', 'Visit current site'],
      ABSORBED: ['continuing-service', 'Visit continuing service'],
      ARCHIVED_READ_ONLY: ['surviving-archive', 'Open surviving archive'],
      BOOK_ONLY_HISTORICAL: ['surviving-documentation', 'Open surviving documentation'],
    };
    const [status, label] = byState[project.currentStatusGroup] || ['reviewed-destination', 'Open reviewed destination'];
    return { status, href: current, label };
  }
  const historical = (project && Array.isArray(project.bookPrintedUrls) ? project.bookPrintedUrls : [])
    .map(httpUrl).find(Boolean) || '';
  return historical
    ? { status: 'book-listed-site', href: historical, label: 'Open website listed in the book' }
    : { status: 'unavailable', href: '', label: 'No surviving website recorded' };
}

function teacherResourceDestination(entry, allowedInternalOriginals = []) {
  const value = String(entry && entry.url || '').trim();
  const external = httpUrl(value);
  if (external) return { status: 'external-publisher', href: external, label: 'Open original resource' };
  if (value.startsWith('/') && allowedInternalOriginals.includes(value)) {
    return { status: 'seminar-schools-original', href: value, label: 'Open original resource' };
  }
  return { status: 'unavailable', href: '', label: 'Original resource unavailable' };
}

function assertDestination(result, context) {
  if (!result || typeof result.status !== 'string') throw new Error(`${context}: destination status is missing`);
  const unavailable = result.status === 'unavailable' || result.status === 'unavailable-specific-page';
  if (unavailable && result.href) throw new Error(`${context}: unavailable destination must not have an href`);
  if (!unavailable && !result.href) throw new Error(`${context}: available destination must have an href`);
  return result;
}

module.exports = {
  assertDestination,
  httpUrl,
  httpsUrl,
  DESTINATION_STATUSES,
  DESTINATION_SCOPES,
  DESTINATION_KINDS,
  BROAD_TERMINALS,
  destinationLabel,
  materializedPolymythcalDestination,
  polymythcalDestination,
  resolvePolymythcalDestination,
  polymythCommonsDestination,
  teacherResourceDestination,
};
