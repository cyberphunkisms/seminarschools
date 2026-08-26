(() => {
  'use strict';

  if (window.__polymythcalDiscoveryMounted) return;
  window.__polymythcalDiscoveryMounted = true;
  const CORE = window.PolymythcalDiscoveryCore;
  if (!CORE) throw new Error('Polymythcal discovery core did not load');

  const PAGE_SIZE = 24;
  const FETCH_TIMEOUT_MS = 12000;
  const FETCH_ATTEMPTS = 2;
  const CALENDAR_TIME_ZONE = 'America/Toronto';
  const locale = document.documentElement.lang.toLocaleLowerCase().startsWith('fr') ? 'fr' : 'en';
  const UI_LOCALE = locale === 'fr' ? 'fr-CA' : 'en-CA';
  const surface = document.body.dataset.pmdSurface || 'main';
  const focusedRoute = document.body.dataset.pmRoute || '';
  const defaultContent = document.body.dataset.pmDefaultContent || '';
  const FOCUSED_ROUTES = Object.freeze(['writingclub', 'writingkids', 'writingjuniors', 'writingteens', 'writinggrads', 'university', 'philosophy', 'humanities', 'cfps', 'lectures', 'fellowships']);
  const ROUTE_LABELS = Object.freeze(locale === 'fr' ? {
    writingclub: 'Club d’écriture', writingkids: 'Écriture : enfants', writingjuniors: 'Écriture : juniors', writingteens: 'Écriture : adolescents', writinggrads: 'Écriture : cycles supérieurs', university: 'Université', philosophy: 'Philosophie', humanities: 'Sciences humaines', cfps: 'Appels à contributions', lectures: 'Conférences', fellowships: 'Bourses',
  } : {
    writingclub: 'Writing Club', writingkids: 'Writing Kids', writingjuniors: 'Writing Juniors', writingteens: 'Writing Teens', writinggrads: 'Writing Grads', university: 'University', philosophy: 'Philosophy', humanities: 'Humanities', cfps: 'Calls for papers', lectures: 'Lectures', fellowships: 'Fellowships',
  });
  const CONFIRMATION_LABELS = Object.freeze(locale === 'fr'
    ? { confirmed: 'Confirmé', unconfirmed: 'Non confirmé' }
    : { confirmed: 'Confirmed', unconfirmed: 'Unconfirmed' });
  const DESTINATION_LABELS = Object.freeze(locale === 'fr' ? {
    'official-event-page': 'page officielle de l’événement', 'official-series-page': 'page officielle de la série', 'source-event-page': 'page source de l’événement', 'unavailable-specific-page': 'page précise indisponible',
  } : {
    'official-event-page': 'official event page', 'official-series-page': 'official series page', 'source-event-page': 'source event page', 'unavailable-specific-page': 'specific page unavailable',
  });
  const ACTION_LABELS = Object.freeze(locale === 'fr' ? {
    details: 'Détails', detail: 'Page officielle', event: 'Page officielle de l’événement', registration: 'S’inscrire', application: 'Postuler', apply: 'Postuler', submission: 'Soumettre', rules: 'Règlement', schedule: 'Horaire', review: 'Examiner', results: 'Résultats', source: 'Fiche source', organizer: 'Organisme', series: 'Page officielle de la série', tickets: 'Billets', stream: 'Regarder',
  } : {
    details: 'Details', detail: 'Official page', event: 'Official event page', registration: 'Register', application: 'Apply', apply: 'Apply', submission: 'Submit', rules: 'Rules', schedule: 'Schedule', review: 'Review', results: 'Results', source: 'Source record', organizer: 'Organizer', series: 'Official series page', tickets: 'Tickets', stream: 'Watch',
  });
  let routeScope = focusedRoute;
  const dataUrl = document.body.dataset.pmdSource || (surface === 'monitoring'
    ? '/polymythseminars/watchlist.json'
    : '/polymythseminars/browse.json');
  const researchDataUrl = document.body.dataset.pmdResearchSource || '/polymythseminars/research.json';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const PATHS = Object.freeze({
    main: { en: '/polymythseminars/', fr: '/polymythseminars/fr/' },
    research: { en: '/polymythseminars/research/', fr: '/polymythseminars/fr/research/' },
    monitoring: { en: '/polymythseminars/monitoring/', fr: '/polymythseminars/fr/monitoring/' },
  });

  const COPY = Object.freeze(locale === 'fr' ? {
    loading: 'Chargement des fiches', unavailable: 'Les fiches sont temporairement indisponibles', unavailableHelp: 'Actualisez la page ou utilisez les fils du calendrier pendant l’indisponibilité des données.', retry: 'Réessayer',
    noResults: 'Aucune fiche ne correspond à cette vue', noResultsHelp: 'Retirez un filtre ou effacez la recherche pour élargir les résultats.', noFilters: 'Aucun filtre sélectionné', filtersSelected: count => `${count} sélectionné${count === 1 ? '' : 's'}`,
    results: count => `${count.toLocaleString(UI_LOCALE)} ${count === 1 ? 'fiche' : 'fiches'}`, groups: (eventCount, groupCount) => `${eventCount.toLocaleString(UI_LOCALE)} fiches dans ${groupCount.toLocaleString(UI_LOCALE)} groupes de résultats`, showing: (first, last, total) => `Affichage de ${first.toLocaleString(UI_LOCALE)} à ${last.toLocaleString(UI_LOCALE)} sur ${total.toLocaleString(UI_LOCALE)}`, calendarShowing: (monthCount, total, month) => `${monthCount.toLocaleString(UI_LOCALE)} en ${month} · ${total.toLocaleString(UI_LOCALE)} correspondance${total === 1 ? '' : 's'} au total`,
    matched: (field, value) => `Correspondance — ${field} : ${value}`, remove: label => `Retirer ${label}`, clearAll: 'Tout effacer', reviewMore: count => `Voir ${count} autre${count === 1 ? '' : 's'} dans les filtres de recherche`, scope: label => `Calendrier ciblé : ${label}`, details: 'Détails', source: 'Fiche source', official: 'Page officielle', officialSeries: 'Page officielle de la série', officialEvent: 'Page officielle de l’événement', sourceEvent: 'Page source de l’événement', noVerifiedLink: 'Aucun lien public vérifié n’est disponible.', datePending: 'Date confirmée à venir', timePending: 'Heure non publiée', timeNotApplicable: 'Heure sans objet', allDay: 'Toute la journée', estimatedDate: value => `Date estimée : ${value}`, approximateTime: value => `Environ ${value}`, estimatedTime: value => `Heure estimée : ${value}`, placePending: 'Lieu non publié', checked: 'Dernière vérification', filters: 'Filtres', viewResults: count => `Voir ${count.toLocaleString(UI_LOCALE)} résultats`, page: number => `Page ${number}`, previous: 'Précédent', next: 'Suivant', today: 'Aujourd’hui', previousMonth: 'Mois précédent', nextMonth: 'Mois suivant', showMoreDay: count => `Afficher ${count} de plus`, showFewerDay: 'Afficher moins', seriesOccurrences: count => `${count.toLocaleString(UI_LOCALE)} occurrence${count === 1 ? '' : 's'}`, matchingOccurrences: (matching, total) => `${matching.toLocaleString(UI_LOCALE)} occurrence${matching === 1 ? '' : 's'} correspondante${matching === 1 ? '' : 's'} sur ${total.toLocaleString(UI_LOCALE)}`, openOccurrences: 'Afficher les occurrences', exact: 'mot exact', phrase: 'expression', prefix: 'préfixe de mot',
  } : {
    loading: 'Loading listings', unavailable: 'Listings are temporarily unavailable', unavailableHelp: 'Refresh the page or use the calendar feeds while the data is unavailable.', retry: 'Try again', noResults: 'No listings match this view', noResultsHelp: 'Remove one filter or clear the search to widen the results.', noFilters: 'No filters selected', filtersSelected: count => `${count} selected`, results: count => `${count.toLocaleString(UI_LOCALE)} ${count === 1 ? 'listing' : 'listings'}`, groups: (eventCount, groupCount) => `${eventCount.toLocaleString(UI_LOCALE)} listings in ${groupCount.toLocaleString(UI_LOCALE)} result groups`, showing: (first, last, total) => `Showing ${first.toLocaleString(UI_LOCALE)}–${last.toLocaleString(UI_LOCALE)} of ${total.toLocaleString(UI_LOCALE)}`, calendarShowing: (monthCount, total, month) => `${monthCount.toLocaleString(UI_LOCALE)} in ${month} · ${total.toLocaleString(UI_LOCALE)} matching overall`, matched: (field, value) => `Matched ${field}: ${value}`, remove: label => `Remove ${label}`, clearAll: 'Clear all', reviewMore: count => `Review ${count} more in Research filters`, scope: label => `Focused calendar: ${label}`, details: 'Details', source: 'Source record', official: 'Official page', officialSeries: 'Official series page', officialEvent: 'Official event page', sourceEvent: 'Source event page', noVerifiedLink: 'No verified public link is available.', datePending: 'Awaiting confirmed date', timePending: 'Time unpublished', timeNotApplicable: 'Time not applicable', allDay: 'All day', estimatedDate: value => `Estimated date: ${value}`, approximateTime: value => `Approx. ${value}`, estimatedTime: value => `Estimated time: ${value}`, placePending: 'Location unpublished', checked: 'Last checked', filters: 'Filters', viewResults: count => `View ${count.toLocaleString(UI_LOCALE)} results`, page: number => `Page ${number}`, previous: 'Previous', next: 'Next', today: 'Today', previousMonth: 'Previous month', nextMonth: 'Next month', showMoreDay: count => `Show ${count} more`, showFewerDay: 'Show fewer', seriesOccurrences: count => `${count.toLocaleString(UI_LOCALE)} ${count === 1 ? 'occurrence' : 'occurrences'}`, matchingOccurrences: (matching, total) => `${matching.toLocaleString(UI_LOCALE)} matching of ${total.toLocaleString(UI_LOCALE)} occurrences`, openOccurrences: 'Show occurrences', exact: 'exact wording', phrase: 'phrase', prefix: 'word prefix',
  });

  const TEXT = Object.freeze(locale === 'fr' ? {
    allListings: 'Toutes les fiches', chooseOne: 'Choisissez une option', chooseAny: 'Choisissez toutes les options pertinentes', chooseTypes: 'Choisissez des types d’événements ou de possibilités', eventsAttend: 'Événements auxquels assister', opportunitiesApply: 'Possibilités auxquelles postuler', selected: 'Sélection', selectedSuffix: count => `${count} sélectionné${count === 1 ? '' : 's'}`, optionSuffix: count => `${count.toLocaleString(UI_LOCALE)} option${count === 1 ? '' : 's'}`, filterMatches: count => `${count.toLocaleString(UI_LOCALE)} option${count === 1 ? '' : 's'} de filtre correspondante${count === 1 ? '' : 's'}`, genericAxisHelp: label => `Choisissez un nombre quelconque d’options pour ${label.toLocaleLowerCase(UI_LOCALE)}.`,
    celestialTitle: 'Précisez le sens de « céleste »', occurrenceTitle: 'Phénomènes célestes', occurrenceText: 'Éclipses, pluies de météores, phases de la Lune, solstices, équinoxes et phénomènes planétaires.', occurrenceAction: 'Afficher les phénomènes', astronomyTitle: 'Astronomie et astrologie', astronomyText: 'Causeries, ateliers et autres fiches sur l’astronomie ou l’astrologie.', astronomyAction: 'Afficher les résultats du sujet', observanceTitle: 'Observances', observanceText: 'Les observances saisonnières et rituelles restent distinctes afin de ne pas confondre leurs sens.', seasonal: 'Observances saisonnières', ritual: 'Observances rituelles', facetMatch: 'Filtre correspondant', useFacet: (axis, label, count) => `${axis} : ${label} — ${count.toLocaleString(UI_LOCALE)} fiches`, spelling: 'Vérifiez l’orthographe', suggestionHelp: 'Les suggestions ne changent ni n’ajoutent de résultats tant que vous n’en choisissez pas une.', searchFor: label => `Rechercher « ${label} »`, searchStatus: query => `Recherche de « ${query} » par mots exacts, expressions et préfixes d’au moins cinq caractères.`,
    apply: 'Postuler', attend: 'Assister', series: 'Série', dateConfirm: 'Date à confirmer', link: 'lien', forTitle: ' pour ', calendarCaption: title => `Calendrier de ${title}; à fort grossissement ou sur petit écran, utilisez l’ordre du jour ci-dessous.`, emptyMonth: title => `Aucune fiche en ${title}`, changeMonth: 'Utilisez Précédent ou Suivant pour changer de mois.', calendarResults: 'Résultats du calendrier', listings: 'Fiches', monitored: 'Annonces surveillées', shareOpened: 'Feuille de partage ouverte.', copied: 'Lien de la vue copié.', copyFailed: 'Impossible de copier le lien. Copiez-le depuis la barre d’adresse.', onDate: 'le', countLabel: count => `${count} fiches`,
  } : {
    allListings: 'All listings', chooseOne: 'Choose one', chooseAny: 'Choose any that apply', chooseTypes: 'Choose event or opportunity types', eventsAttend: 'Events to attend', opportunitiesApply: 'Opportunities to apply for', selected: 'Selected', selectedSuffix: count => `${count} selected`, optionSuffix: count => `${count.toLocaleString(UI_LOCALE)} ${count === 1 ? 'option' : 'options'}`, filterMatches: count => `${count.toLocaleString(UI_LOCALE)} matching filter ${count === 1 ? 'option' : 'options'}`, genericAxisHelp: label => `Choose any number of ${label.toLocaleLowerCase(UI_LOCALE)} options.`,
    celestialTitle: 'Choose what “celestial” means here', occurrenceTitle: 'Celestial occurrences', occurrenceText: 'Eclipses, meteor showers, moon phases, solstices, equinoxes, and planetary events.', occurrenceAction: 'Show occurrences', astronomyTitle: 'Astronomy and astrology', astronomyText: 'Talks, workshops, and other listings about astronomy or astrology.', astronomyAction: 'Show topic results', observanceTitle: 'Observances', observanceText: 'Seasonal and ritual observances stay distinct so their meanings are not collapsed.', seasonal: 'Seasonal observances', ritual: 'Ritual observances', facetMatch: 'Matching filter', useFacet: (axis, label, count) => `${axis}: ${label} — ${count.toLocaleString(UI_LOCALE)} listings`, spelling: 'Check the spelling', suggestionHelp: 'Suggestions never change or add results until you choose one.', searchFor: label => `Search for “${label}”`, searchStatus: query => `Searching for “${query}” using exact words, phrases, and forward prefixes of at least five characters.`,
    apply: 'Apply', attend: 'Attend', series: 'Series', dateConfirm: 'Date to be confirmed', link: 'link', forTitle: ' for ', calendarCaption: title => `${title} calendar; use the agenda below at high zoom or on a small screen.`, emptyMonth: title => `No listings in ${title}`, changeMonth: 'Use Previous or Next to change month.', calendarResults: 'Calendar results', listings: 'Listings', monitored: 'Monitored announcements', shareOpened: 'Share sheet opened.', copied: 'View link copied.', copyFailed: 'The view link could not be copied. Copy it from the address bar.', onDate: 'on', countLabel: count => `${count} listings`,
  });

  const FIELD_LABELS = Object.freeze(locale === 'fr'
    ? { title: 'titre', aliases: 'terme associé', description: 'description', people: 'personne', organizer: 'organisme', place: 'lieu', topics: 'sujet', format: 'forme' }
    : { title: 'title', aliases: 'known term', description: 'description', people: 'person', organizer: 'organizer', place: 'place', topics: 'topic', format: 'format' });

  const AXIS_LABELS = Object.freeze(locale === 'fr' ? {
    kind: 'Assister ou postuler', date: 'Quand', what: 'Quoi', places: 'Où', topics: 'Sujets', formats: 'En ligne ou en personne', audiences: 'Public', statuses: 'État de la fiche', presence: 'Qui est présent', academicForms: 'Forme universitaire', artsFormats: 'Forme artistique', participationFormats: 'Forme de participation', civicFormats: 'Forme civique, juridique et syndicale', communityFormats: 'Forme communautaire, caritative, patrimoniale et locale', digitalFormats: 'Média en direct et forme numérique', programFormats: 'Forme de cours et de programme', grades: 'Niveau', celestialKinds: 'Type de phénomène céleste',
  } : {
    kind: 'Attend or apply', date: 'When', what: 'What', places: 'Where', topics: 'Topics', formats: 'Online or in person', audiences: 'Audience', statuses: 'Listing status', presence: 'Who is present', academicForms: 'Academic format', artsFormats: 'Arts format', participationFormats: 'Participation format', civicFormats: 'Civic, legal, and labour format', communityFormats: 'Community, charity, heritage, and place format', digitalFormats: 'Live media and digital format', programFormats: 'Course and programme format', grades: 'Grade or level', celestialKinds: 'Celestial occurrence kind',
  });

  const AXIS_HELP = Object.freeze(locale === 'fr' ? {
    kind: 'Choisissez toutes les fiches, les événements auxquels assister ou les possibilités auxquelles postuler.', date: 'Choisissez une période.', places: 'Choisissez un nombre quelconque de régions.', topics: 'Choisissez un nombre quelconque de grands sujets.', formats: 'Choisissez le mode de participation.', audiences: 'Choisissez un nombre quelconque de publics.', what: 'Les événements et les possibilités partagent une seule hiérarchie; un choix ne peut donc pas se glisser dans l’autre branche.',
  } : {
    kind: 'Choose all listings, events to attend, or opportunities to apply for.', date: 'Choose one date range.', places: 'Choose any number of regions.', topics: 'Choose any number of broad subjects.', formats: 'Choose how participation happens.', audiences: 'Choose any number of audiences.', what: 'Event and opportunity leaves share one hierarchy, so a choice cannot leak into the other branch.',
  });

  const DATE_OPTIONS = Object.freeze(locale === 'fr' ? [
    { value: 'upcoming', label: 'Toutes les dates à venir' }, { value: 'today', label: 'Aujourd’hui' },
    { value: '7d', label: '7 prochains jours' }, { value: '30d', label: '30 prochains jours' }, { value: 'all', label: 'Toutes les dates' },
  ] : [
    { value: 'upcoming', label: 'All upcoming' }, { value: 'today', label: 'Today' },
    { value: '7d', label: 'Next 7 days' }, { value: '30d', label: 'Next 30 days' }, { value: 'all', label: 'All dates' },
  ]);

  const COMMON_AXES = Object.freeze(['kind', 'date', 'places', 'topics', 'audiences', 'formats']);
  const REQUIRED_PUBLIC_FACETS = Object.freeze(['kind', 'what', 'places', 'topics', 'formats', 'audiences', 'statuses']);
  const MONITORING_AXES = Object.freeze(['kind', 'places', 'topics', 'audiences', 'formats']);
  const RESEARCH_SPECIALIST_ORDER = Object.freeze([
    'what', 'celestialKinds', 'presence', 'academicForms', 'artsFormats', 'participationFormats',
    'civicFormats', 'communityFormats', 'digitalFormats', 'programFormats', 'grades', 'statuses',
  ]);
  const RESEARCH_ORDER = Object.freeze([...COMMON_AXES, ...RESEARCH_SPECIALIST_ORDER]);
  const RESEARCH_ONLY_AXES = Object.freeze([
    'celestialKinds', 'presence', 'academicForms', 'artsFormats', 'participationFormats',
    'civicFormats', 'communityFormats', 'digitalFormats', 'programFormats', 'grades',
  ]);

  const LEGACY_EVENT_TYPES = Object.freeze({
    talks: 'event:talks', workshops: 'event:workshops', conferences: 'event:conferences',
    performances: 'event:performances', exhibitions: 'event:exhibitions', screenings: 'event:screenings',
    festivals: 'event:festivals', community: 'event:community-civic', celestial: 'event:celestial-occurrence',
    rituals: 'event:ritual-observance', 'other-events': 'event:other',
  });
  const LEGACY_OPPORTUNITY_TYPES = Object.freeze({
    cfp: 'opportunity:cfp', competitions: 'opportunity:competitions', funding: 'opportunity:funding',
    applications: 'opportunity:applications', 'other-opportunities': 'opportunity:other',
  });

  const state = {
    q: '', date: 'upcoming', facets: Object.create(null), sort: surface === 'monitoring' ? 'checked' : 'soonest',
    sortExplicit: false, kindExplicitAll: false, view: 'list', month: '', page: 1,
  };

  let payload = null;
  let events = [];
  let filteredEvents = [];
  let resultGroups = [];
  let axes = new Map();
  let searchTimer = null;
  let activeFetchController = null;
  let loadGeneration = 0;
  let pageIsHiding = false;
  let facetSearchUpdating = false;
  let dataReady = false;
  let activeQueryTerms = [];
  let activeQueryInvalid = false;
  let activeQueryMatchCount = 0;
  let activeToday = null;
  let loadFailed = false;
  const expandedDays = new Set();

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function normalizeText(value) {
    return CORE.normalizeText(value);
  }

  function asArray(value) {
    if (Array.isArray(value)) return value.filter(item => item !== null && item !== undefined && String(item).trim());
    if (value === null || value === undefined || value === '') return [];
    return [value];
  }

  function localLabel(value, fallback = '') {
    if (value && typeof value === 'object' && !Array.isArray(value)) return String(locale === 'fr' ? (value.fr || value['fr-CA'] || value.en || fallback || '') : (value.en || value['en-CA'] || value.fr || fallback || ''));
    return String(value || fallback || '');
  }

  function titleCase(value) {
    return String(value || '')
      .replace(/^event:|^opportunity:/, '')
      .replaceAll('-', ' ')
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  function parseDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split('-').map(Number);
      const result = new Date(Date.UTC(year, month - 1, day, 12));
      return Number.isNaN(result.getTime()) ? null : result;
    }
    const result = new Date(text);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  function validCalendarDay(value) {
    const text = String(value || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})(?=$|T)/.exec(text);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
    return text.length === 10 || !Number.isNaN(Date.parse(text));
  }

  function calendarToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: CALENDAR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 12));
  }

  function dayValue(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?=$|T)/.exec(String(value || '').trim());
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  }

  function isoDay(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function monthValue(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function addDays(date, amount) {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + amount);
    return copy;
  }

  function addMonths(date, amount) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1, 12));
  }

  function eventLanguage(event) {
    const raw = String(event.content_language || 'und').trim();
    return /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(raw) ? raw : 'und';
  }

  function normalizeEvent(raw, monitoring = false) {
    const display = raw && typeof raw.display === 'object' ? raw.display : raw;
    const temporal = raw && raw.temporal && typeof raw.temporal === 'object' ? raw.temporal : {};
    const explicitFacets = raw && raw.facets && typeof raw.facets === 'object' ? raw.facets : {};
    const kind = asArray(explicitFacets.kind)[0] || '';
    const facets = {};
    for (const [key, value] of Object.entries(explicitFacets)) facets[key] = [...new Set(asArray(value).map(String))];
    const searchFields = CORE.buildSearchFields({ ...raw, display, facets });
    const startValue = monitoring ? '' : String(temporal.start || temporal.date || display.date || raw.date || '');
    const endValue = monitoring ? '' : String(temporal.end || temporal.end_date || display.end_date || raw.end_date || '');
    const startDay = monitoring ? '' : CORE.zonedCalendarDay(startValue, temporal);
    const endDay = monitoring ? '' : CORE.zonedCalendarDay(endValue || startValue, temporal);
    const relation = CORE.normalizedRelation(raw);
    return {
      ...raw,
      id: String(raw.id || ''),
      title: String(display.title || raw.title || 'Untitled listing'),
      description: String(display.description || raw.description || ''),
      speaker_or_director: String(display.speaker_or_director || raw.speaker_or_director || ''),
      organizer: String(display.organizer || raw.organizer || ''),
      venue: String(display.venue || raw.venue || ''),
      city: String(display.city || raw.city || ''),
      country: String(display.country || raw.country || ''),
      date: startValue,
      end_date: endValue,
      date_precision: temporal.date_precision || temporal.precision || raw.date_precision || '',
      time_precision: temporal.time_precision || raw.time_precision || '',
      timezone: temporal.timezone || raw.timezone || '',
      facets,
      search: searchFields.search,
      _searchDisplay: searchFields.display,
      series: relation.id ? relation : null,
      _start: monitoring ? null : parseDate(startValue),
      _startDay: monitoring ? null : dayValue(startDay),
      _endDay: monitoring ? null : dayValue(endDay || startDay),
      _match: null,
      _matchScore: 0,
      _queryMatched: true,
    };
  }

  function taxonomyFromPayload(documentPayload) {
    const result = new Map();
    const source = documentPayload?.taxonomy?.axes || {};
    for (const [key, rawAxis] of Object.entries(source)) {
      const options = [];
      for (const [value, rawOption] of Object.entries(rawAxis?.values || {})) {
        options.push({
          value,
          label: localLabel(rawOption, titleCase(value)),
          group: localLabel(rawOption?.group, rawOption?.group || ''),
          aliases: [...new Set([value, rawOption?.en, rawOption?.fr, rawOption?.['en-CA'], rawOption?.['fr-CA'], ...asArray(rawOption?.aliases)].filter(Boolean).map(String))],
        });
      }
      result.set(key, { key, label: localLabel(rawAxis?.label, AXIS_LABELS[key] || titleCase(key)), options });
    }
    const allFacetKeys = new Set();
    for (const event of events) for (const key of Object.keys(event.facets)) allFacetKeys.add(key);
    for (const key of allFacetKeys) {
      if (result.has(key)) continue;
      const values = [...new Set(events.flatMap(event => event.facets[key] || []))].sort();
      result.set(key, { key, label: AXIS_LABELS[key] || titleCase(key), options: values.map(value => ({ value, label: titleCase(value), group: '', aliases: [value, titleCase(value)] })) });
    }
    result.set('date', { key: 'date', label: AXIS_LABELS.date, options: DATE_OPTIONS.map(option => ({ ...option, group: '', aliases: [option.value, option.label] })) });
    return result;
  }

  function searchFieldForAxis(key) {
    if (key === 'places') return 'place';
    if (key === 'topics') return 'topics';
    if (key === 'presence') return 'people';
    return 'format';
  }

  function registerFacetSearchAliases() {
    for (const event of events) {
      const publicSearch = {};
      for (const field of CORE.SEARCH_FIELDS) publicSearch[field] = [...asArray(event._searchDisplay?.[field])];
      for (const [key, values] of Object.entries(event.facets)) {
        const field = searchFieldForAxis(key);
        for (const value of values) {
          const option = axes.get(key)?.options.find(candidate => candidate.value === value);
          publicSearch[field].push(...(option?.aliases || [value]));
        }
      }
      const rebuilt = CORE.buildSearchFields({ ...event, search: publicSearch });
      event.search = rebuilt.search;
      event._searchDisplay = rebuilt.display;
    }
  }

  function selectedFor(key) {
    if (!state.facets[key]) state.facets[key] = new Set();
    return state.facets[key];
  }

  function safeUrl(rawUrl) {
    return CORE.safeHttpUrl(rawUrl, window.location.origin);
  }

  function axisLabel(key) {
    return axes.get(key)?.label || AXIS_LABELS[key] || titleCase(key);
  }

  function optionLabel(key, value) {
    if (key === 'date') return DATE_OPTIONS.find(option => option.value === value)?.label || titleCase(value);
    return axes.get(key)?.options.find(option => option.value === value)?.label || titleCase(value);
  }

  function queryTerms(query) {
    return CORE.queryTerms(query);
  }

  function queryIsInvalid(query, terms = queryTerms(query)) {
    return CORE.queryIsInvalid(query, terms);
  }

  function searchMatch(event, terms) {
    return CORE.searchMatch(event, terms, {
      fieldLabels: FIELD_LABELS,
      matchLabels: { exact: COPY.exact, phrase: COPY.phrase, prefix: COPY.prefix }
    });
  }

  function editDistance(left, right) {
    return CORE.editDistance(left, right);
  }

  function correctionSuggestions(query) {
    const normalized = normalizeText(query);
    if (!normalized || normalized.includes(' ') || normalized.length < 4) return [];
    const vocabulary = new Map();
    for (const axis of axes.values()) {
      for (const option of axis.options) {
        const label = normalizeText(option.label);
        if (label && !label.includes(' ')) vocabulary.set(label, option.label);
      }
    }
    const controlledWords = locale === 'fr'
      ? ['celeste', 'astronomie', 'astrologie', 'eclipse', 'festival', 'atelier', 'conference', 'spectacle']
      : ['celestial', 'astronomy', 'astrology', 'eclipse', 'festival', 'workshop', 'conference', 'performance'];
    for (const word of controlledWords) {
      vocabulary.set(word, titleCase(word));
    }
    return [...vocabulary.entries()]
      .map(([value, label]) => ({ value, label, distance: editDistance(normalized, value) }))
      .filter(item => item.distance > 0 && item.distance <= Math.max(1, Math.floor(normalized.length / 4)))
      .sort((left, right) => left.distance - right.distance || left.label.localeCompare(right.label))
      .slice(0, 3);
  }

  function validSort(value) {
    const allowed = surface === 'monitoring' ? ['checked', 'relevance', 'title'] : ['soonest', 'relevance', 'latest', 'title'];
    return allowed.includes(value) ? value : (surface === 'monitoring' ? 'checked' : 'soonest');
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requestedRoute = String(params.get('route') || '');
    routeScope = focusedRoute || (FOCUSED_ROUTES.includes(requestedRoute) ? requestedRoute : '');
    state.q = String(params.get('q') || '').trim().slice(0, 240);
    state.date = surface === 'monitoring' ? 'all' : (DATE_OPTIONS.some(option => option.value === params.get('date')) ? params.get('date') : 'upcoming');
    const rawSort = params.get('sort');
    state.sort = validSort(rawSort);
    state.sortExplicit = Boolean(rawSort && state.sort === rawSort);
    if (!state.q && state.sort === 'relevance') {
      state.sort = surface === 'monitoring' ? 'checked' : 'soonest';
      state.sortExplicit = false;
    }
    state.view = surface !== 'monitoring' && params.get('view') === 'calendar' ? 'calendar' : 'list';
    state.month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month') : '';
    state.page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    state.facets = Object.create(null);
    state.kindExplicitAll = params.get('kind') === 'all';

    const compatibility = new Map();
    for (const [key, value] of Object.entries(LEGACY_EVENT_TYPES)) compatibility.set(`eventTypes:${key}`, value);
    for (const [key, value] of Object.entries(LEGACY_OPPORTUNITY_TYPES)) compatibility.set(`opportunityTypes:${key}`, value);
    for (const key of axes.keys()) {
      if (key === 'date') continue;
      const allowed = new Set(axes.get(key)?.options.map(option => option.value) || []);
      const values = String(params.get(key) || '').split(',').filter(value => allowed.has(value));
      if (values.length) state.facets[key] = new Set(values);
    }
    for (const legacyKey of ['eventTypes', 'opportunityTypes']) {
      for (const value of String(params.get(legacyKey) || '').split(',').filter(Boolean)) {
        const mapped = compatibility.get(`${legacyKey}:${value}`);
        if (mapped) selectedFor('what').add(mapped);
      }
    }
    if (params.get('content') === 'events') selectedFor('kind').add('attend');
    if (params.get('content') === 'opportunities') selectedFor('kind').add('apply');
    if (!selectedFor('kind').size && !state.kindExplicitAll && ['attend', 'apply'].includes(defaultContent)) selectedFor('kind').add(defaultContent);
    if (!params.has('date') && params.has('time')) {
      const oldTime = params.get('time');
      state.date = ({ all: 'all', today: 'today', week: '7d', month: '30d' })[oldTime] || state.date;
    }
  }

  function stateParams(overrides = {}, targetSurface = surface) {
    const targetDate = surface === 'monitoring' && targetSurface !== 'monitoring' ? 'upcoming' : state.date;
    const values = { q: state.q, date: targetDate, sort: state.sort, view: state.view, month: state.month, page: state.page, ...overrides };
    const params = new URLSearchParams();
    if (values.q) params.set('q', values.q);
    if (targetSurface !== 'monitoring' && values.date && values.date !== 'upcoming') params.set('date', values.date);
    const defaultSort = targetSurface === 'monitoring' ? 'checked' : 'soonest';
    const allowedSorts = targetSurface === 'monitoring' ? ['checked', 'relevance', 'title'] : ['soonest', 'relevance', 'latest', 'title'];
    if (allowedSorts.includes(values.sort) && (state.sortExplicit || values.sort !== defaultSort)) params.set('sort', values.sort);
    if (targetSurface !== 'monitoring' && values.view === 'calendar') params.set('view', 'calendar');
    if (targetSurface !== 'monitoring' && values.view === 'calendar' && values.month) params.set('month', values.month);
    if (Number(values.page) > 1 && values.view !== 'calendar') params.set('page', String(values.page));
    if (routeScope && !(focusedRoute && targetSurface === 'main')) params.set('route', routeScope);
    for (const key of [...axes.keys()].sort()) {
      if (key === 'date') continue;
      if (targetSurface === 'monitoring' && RESEARCH_ONLY_AXES.includes(key)) continue;
      const chosen = [...(state.facets[key] || [])].sort();
      if (chosen.length) params.set(key, chosen.join(','));
      else if (key === 'kind' && state.kindExplicitAll && ['attend', 'apply'].includes(defaultContent)) params.set('kind', 'all');
    }
    return params;
  }

  function targetUrl(targetSurface = surface, overrides = {}) {
    const path = targetSurface === 'main' && routeScope
      ? `/${routeScope}/${locale === 'fr' ? 'fr/' : ''}`
      : (PATHS[targetSurface]?.[locale] || PATHS.main[locale]);
    const params = stateParams(overrides, targetSurface);
    if (targetSurface === 'main' && routeScope) params.delete('route');
    const query = params.toString();
    return `${path}${query ? `?${query}` : ''}`;
  }

  function writeUrl(mode = 'replace') {
    const query = stateParams().toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const method = mode === 'push' ? 'pushState' : 'replaceState';
    window.history[method]({}, '', url);
    updateStateLinks();
  }

  function updateStateLinks() {
    $$('[data-state-link]').forEach(link => {
      const target = link.dataset.stateLink;
      link.href = targetUrl(target, { page: 1, view: target === 'monitoring' ? 'list' : state.view });
    });
    const language = $('#pmdLanguageLink');
    if (language) {
      const query = stateParams().toString();
      const alternateLocale = locale === 'fr' ? 'en' : 'fr';
      const path = surface === 'main' && routeScope
        ? `/${routeScope}/${alternateLocale === 'fr' ? 'fr/' : ''}`
        : PATHS[surface][alternateLocale];
      language.href = `${path}${query ? `?${query}` : ''}`;
    }
  }

  function eventMatchesDate(event) {
    if (surface === 'monitoring' || state.date === 'all') return true;
    if (!event._startDay) return false;
    const today = activeToday || calendarToday();
    if (state.date === 'upcoming') return event._endDay ? event._endDay >= today : event._startDay >= today;
    if (state.date === 'today') return event._startDay <= today && (event._endDay || event._startDay) >= today;
    const days = state.date === '7d' ? 7 : 30;
    const end = addDays(today, days - 1);
    return event._startDay <= end && (event._endDay || event._startDay) >= today;
  }

  function routeMatches(event) {
    if (!routeScope) return true;
    const routes = event.facets.routes || [];
    if (routes.length) return routes.includes(routeScope);
    const writing = asArray(event.writing_bands).map(String);
    const academic = asArray(event.academic_bands).map(String);
    if (routeScope === 'writingclub') return writing.length > 0;
    if (routeScope === 'writingkids') return writing.includes('kids');
    if (routeScope === 'writingjuniors') return writing.includes('juniors');
    if (routeScope === 'writingteens') return writing.includes('teens');
    if (routeScope === 'writinggrads') return writing.includes('grads');
    return academic.includes(routeScope);
  }

  function eventPasses(event, omittedAxis = '') {
    if (!routeMatches(event)) return false;
    if (omittedAxis !== 'date' && !eventMatchesDate(event)) return false;
    if (state.q && !event._queryMatched) return false;
    return CORE.matchesFacets(event, state.facets, omittedAxis);
  }

  function optionCount(key, value) {
    if (key === 'date') {
      return events.reduce((count, event) => {
        if (!eventPasses(event, 'date')) return count;
        const prior = state.date;
        state.date = value;
        const matches = eventMatchesDate(event);
        state.date = prior;
        return count + (matches ? 1 : 0);
      }, 0);
    }
    const eligible = events.filter(event => routeMatches(event) && eventMatchesDate(event) && (!state.q || event._queryMatched));
    if (key === 'kind' && value === 'all') return eligible.filter(event => CORE.matchesFacets(event, state.facets, key)).length;
    return CORE.facetCounts(eligible, state.facets, key).get(value) || 0;
  }

  function countSelections() {
    return Object.values(state.facets).reduce((sum, values) => sum + values.size, 0)
      + (surface !== 'monitoring' && state.date !== 'upcoming' ? 1 : 0)
      + (routeScope && !focusedRoute ? 1 : 0);
  }

  function focusToken(element = document.activeElement) {
    if (!(element instanceof HTMLElement)) return null;
    const token = {
      id: element.id || '',
      axis: element.dataset.axis || '',
      value: element.dataset.value || '',
      action: element.dataset.action || '',
      view: element.dataset.view || '',
    };
    return Object.values(token).some(Boolean) ? token : null;
  }

  function restoreFocus(token, fallback = '#pmdResultsTitle') {
    if (!token) return;
    let target = token.id ? document.getElementById(token.id) : null;
    if (!target && token.axis && token.value) target = $(`[data-axis="${CSS.escape(token.axis)}"][data-value="${CSS.escape(token.value)}"]`);
    if (!target && token.action) {
      const valueSelector = token.value ? `[data-value="${CSS.escape(token.value)}"]` : '';
      target = $(`[data-action="${CSS.escape(token.action)}"]${valueSelector}`);
    }
    if (!target && token.view) target = $(`[data-view="${CSS.escape(token.view)}"]`);
    if (!target) target = $(fallback);
    target?.focus({ preventScroll: true });
  }

  function optionIsSelected(key, value) {
    return key === 'date'
      ? state.date === value
      : key === 'kind' && value === 'all'
        ? selectedFor('kind').size === 0
        : selectedFor(key).has(value);
  }

  function renderableOptions(key) {
    const axis = axes.get(key);
    if (!axis) return [];
    const options = key === 'kind'
      ? [{ value: 'all', label: TEXT.allListings, group: '' }, ...axis.options]
      : axis.options;
    return options.filter(option => optionIsSelected(key, option.value) || optionCount(key, option.value) > 0);
  }

  function axisSelectionCount(key) {
    if (key === 'date') return state.date === 'upcoming' ? 0 : 1;
    return selectedFor(key).size;
  }

  function renderOption(key, option, count, inputType = 'checkbox') {
    const checked = optionIsSelected(key, option.value);
    if (count === 0 && !checked) return '';
    const name = key === 'date' ? 'pmd-date' : `pmd-${key}`;
    const id = `pmd-${key}-${option.value}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `<label class="pmd-option" for="${escapeHtml(id)}"><input id="${escapeHtml(id)}" type="${inputType}" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}" data-axis="${escapeHtml(key)}" data-value="${escapeHtml(option.value)}"${checked ? ' checked' : ''}><span>${escapeHtml(option.label)}</span><span class="pmd-option-count" aria-label="${escapeHtml(TEXT.countLabel(count))}">${count.toLocaleString(UI_LOCALE)}</span></label>`;
  }

  function axisMarkup(key, visibleOptions = null) {
    const axis = axes.get(key);
    if (!axis) return '';
    const options = key === 'kind' && !visibleOptions
      ? [{ value: 'all', label: TEXT.allListings, group: '' }, ...axis.options]
      : (visibleOptions || axis.options);
    const radio = key === 'date' || key === 'kind';
    const rows = options.map(option => renderOption(key, option, optionCount(key, option.value), radio ? 'radio' : 'checkbox')).filter(Boolean);
    if (!rows.length) return '';
    const description = AXIS_HELP[key] || TEXT.genericAxisHelp(axis.label);
    if (key === 'what') {
      const eventRows = options.filter(option => option.value.startsWith('event:')).map(option => renderOption(key, option, optionCount(key, option.value))).filter(Boolean);
      const opportunityRows = options.filter(option => option.value.startsWith('opportunity:')).map(option => renderOption(key, option, optionCount(key, option.value))).filter(Boolean);
      return `<section class="pmd-filter-axis"><h3>${escapeHtml(axis.label)}</h3><p>${escapeHtml(description)}</p><fieldset><legend>${TEXT.chooseTypes}</legend>${eventRows.length ? `<div class="pmd-what-group"><h4>${TEXT.eventsAttend}</h4><div class="pmd-option-list">${eventRows.join('')}</div></div>` : ''}${opportunityRows.length ? `<div class="pmd-what-group"><h4>${TEXT.opportunitiesApply}</h4><div class="pmd-option-list">${opportunityRows.join('')}</div></div>` : ''}</fieldset></section>`;
    }
    return `<section class="pmd-filter-axis"><h3>${escapeHtml(axis.label)}</h3><p>${escapeHtml(description)}</p><fieldset><legend>${radio ? TEXT.chooseOne : TEXT.chooseAny}</legend><div class="pmd-option-list ${key === 'kind' ? 'pmd-purpose-list' : ''}">${rows.join('')}</div></fieldset></section>`;
  }

  function renderCommonFilters() {
    const root = $('#pmdCommonFilters');
    if (!root) return;
    const order = surface === 'monitoring' ? MONITORING_AXES : COMMON_AXES;
    root.innerHTML = order.map(axisMarkup).join('');
  }

  function renderResearchFamilies() {
    const commonRoot = $('#pmdResearchCommonFilters');
    if (commonRoot) commonRoot.innerHTML = COMMON_AXES.filter(key => axes.has(key)).map(axisMarkup).join('');
    const root = $('#pmdResearchFilters');
    if (!root) return;
    const existing = new Map($$('.pmd-research-family', root).map(details => [details.dataset.axis, { open: details.open, userOpen: details.dataset.userOpen === 'true' }]));
    root.innerHTML = RESEARCH_SPECIALIST_ORDER.filter(key => axes.has(key)).map(key => {
      const axis = axes.get(key);
      const options = renderableOptions(key);
      const chosen = axisSelectionCount(key);
      if (!options.length && !chosen) return '';
      const suffix = chosen ? TEXT.selectedSuffix(chosen) : TEXT.optionSuffix(options.length);
      const prior = existing.get(key);
      const open = prior ? prior.open : chosen > 0;
      const userOpen = prior ? prior.userOpen : chosen > 0;
      return `<details class="pmd-research-family" data-axis="${escapeHtml(key)}" data-user-open="${userOpen ? 'true' : 'false'}"${open ? ' open' : ''}><summary><strong>${escapeHtml(axis.label)}</strong><span>${escapeHtml(suffix)}</span></summary><div class="pmd-research-family-body" data-lazy-axis="${escapeHtml(key)}"></div></details>`;
    }).filter(Boolean).join('');
    $$('.pmd-research-family[open]', root).forEach(details => mountResearchFamily(details));
  }

  function mountResearchFamily(details, options = null) {
    const key = details?.dataset.axis;
    const body = details?.querySelector('[data-lazy-axis]');
    if (!key || !body) return;
    body.innerHTML = axisMarkup(key, options);
    body.dataset.mounted = 'true';
  }

  function filterResearchFamilies() {
    const input = $('#pmdFacetSearch');
    const status = $('#pmdFacetSearchStatus');
    if (!input || !status) return;
    const needle = normalizeText(input.value);
    const detailsList = $$('.pmd-research-family', $('#pmdResearchFilters'));
    let optionMatches = 0;
    facetSearchUpdating = true;
    for (const details of detailsList) {
      const key = details.dataset.axis;
      const axis = axes.get(key);
      if (!axis) continue;
      const available = renderableOptions(key);
      if (!needle) {
        details.hidden = !available.length;
        const intended = details.dataset.userOpen === 'true';
        details.open = intended;
        if (intended && available.length) mountResearchFamily(details, available);
        continue;
      }
      const familyMatch = normalizeText(axis.label).includes(needle);
      const options = familyMatch ? available : available.filter(option => normalizeText(option.label).includes(needle));
      details.hidden = !options.length;
      details.open = Boolean(options.length);
      if (options.length) {
        optionMatches += options.length;
        mountResearchFamily(details, options);
      }
    }
    facetSearchUpdating = false;
    status.textContent = needle ? TEXT.filterMatches(optionMatches) : '';
  }

  function allSelectedItems() {
    const items = [];
    if (routeScope && !focusedRoute) items.push({ key: 'route', value: routeScope, label: COPY.scope(ROUTE_LABELS[routeScope] || titleCase(routeScope)) });
    if (surface !== 'monitoring' && state.date !== 'upcoming') items.push({ key: 'date', value: state.date, label: `${axisLabel('date')}: ${optionLabel('date', state.date)}` });
    for (const key of RESEARCH_ORDER) {
      for (const value of state.facets[key] || []) items.push({ key, value, label: `${axisLabel(key)}: ${optionLabel(key, value)}` });
    }
    for (const [key, values] of Object.entries(state.facets)) {
      if (RESEARCH_ORDER.includes(key)) continue;
      for (const value of values) items.push({ key, value, label: `${axisLabel(key)}: ${optionLabel(key, value)}` });
    }
    return items;
  }

  function renderSelected() {
    const root = $('#pmdSelected');
    const items = allSelectedItems();
    if (!root) return;
    root.hidden = items.length === 0;
    if (!items.length) {
      root.innerHTML = '';
    } else {
      const visible = surface === 'main' ? items.slice(0, 3) : items;
      const hiddenCount = items.length - visible.length;
      root.innerHTML = `<strong>${TEXT.selected}</strong>${visible.map(item => `<button type="button" data-action="remove-filter" data-axis="${escapeHtml(item.key)}" data-value="${escapeHtml(item.value)}" aria-label="${escapeHtml(COPY.remove(item.label))}">${escapeHtml(item.label)} <span aria-hidden="true">×</span></button>`).join('')}${hiddenCount ? `<a href="${escapeHtml(targetUrl('research', { page: 1 }))}" data-state-link="research">${escapeHtml(COPY.reviewMore(hiddenCount))}</a>` : ''}<button type="button" data-action="clear-filters">${COPY.clearAll}</button>`;
    }
    const count = countSelections();
    const summary = $('#pmdFilterSummary');
    if (summary) summary.textContent = count ? COPY.filtersSelected(count) : COPY.noFilters;
    const filterCount = $('#pmdMobileFilterCount');
    if (filterCount) filterCount.textContent = String(count);
  }

  function setFacet(key, values) {
    state.facets[key] = new Set(asArray(values));
    state.page = 1;
  }

  function taxonomyValuesMatching(key, expression) {
    return axes.get(key)?.options
      .filter(option => expression.test(normalizeText(option.label)) || expression.test(normalizeText(option.value)))
      .map(option => option.value) || [];
  }

  function facetActionCount(key, rawValues) {
    const eligible = events.filter(event => routeMatches(event) && eventMatchesDate(event));
    const selections = { ...state.facets, [key]: new Set(asArray(rawValues)) };
    return eligible.filter(event => CORE.matchesFacets(event, selections)).length;
  }

  function exactFacetIntents(query) {
    const normalized = normalizeText(query);
    if (!normalized) return [];
    const matches = [];
    for (const [key, axis] of axes) {
      if (key === 'date') continue;
      for (const option of axis.options) {
        const aliases = option.aliases?.length ? option.aliases : [option.value, option.label];
        if (!aliases.some(alias => normalizeText(alias) === normalized)) continue;
        matches.push({ key, value: option.value, label: option.label, axis: axis.label, count: facetActionCount(key, [option.value]) });
      }
    }
    return matches.sort((left, right) => right.count - left.count || left.axis.localeCompare(right.axis, UI_LOCALE));
  }

  function renderSearchAssist() {
    const root = $('#pmdSearchAssist');
    if (!root) return;
    const normalized = normalizeText(state.q);
    if (normalized === 'celestial' || normalized === 'celeste') {
      const topics = taxonomyValuesMatching('topics', /astronom|astrolog/);
      const occurrenceCount = facetActionCount('what', ['event:celestial-occurrence']);
      const astronomyCount = facetActionCount('topics', topics);
      const seasonalCount = facetActionCount('what', ['event:seasonal-observance']);
      const ritualCount = facetActionCount('what', ['event:ritual-observance']);
      root.hidden = false;
      root.innerHTML = `<h2>${TEXT.celestialTitle}</h2><div class="pmd-intent-grid">
<section class="pmd-intent"><h3>${TEXT.occurrenceTitle}</h3><p>${TEXT.occurrenceText}</p><div class="pmd-intent-actions"><button type="button" data-intent-axis="what" data-intent-value="event:celestial-occurrence">${TEXT.occurrenceAction} (${occurrenceCount.toLocaleString(UI_LOCALE)})</button></div></section>
<section class="pmd-intent"><h3>${TEXT.astronomyTitle}</h3><p>${TEXT.astronomyText}</p><div class="pmd-intent-actions"><button type="button" data-intent-axis="topics" data-intent-values="${escapeHtml(topics.join(','))}"${topics.length ? '' : ' disabled'}>${TEXT.astronomyAction} (${astronomyCount.toLocaleString(UI_LOCALE)})</button></div></section>
<section class="pmd-intent"><h3>${TEXT.observanceTitle}</h3><p>${TEXT.observanceText}</p><div class="pmd-intent-actions"><button type="button" data-intent-axis="what" data-intent-value="event:seasonal-observance">${TEXT.seasonal} (${seasonalCount.toLocaleString(UI_LOCALE)})</button><button type="button" data-intent-axis="what" data-intent-value="event:ritual-observance">${TEXT.ritual} (${ritualCount.toLocaleString(UI_LOCALE)})</button></div></section>
</div>`;
      return;
    }
    const facetIntents = exactFacetIntents(state.q);
    if (facetIntents.length) {
      root.hidden = false;
      root.innerHTML = `<h2>${TEXT.facetMatch}</h2><p class="pmd-help">${TEXT.suggestionHelp}</p><div class="pmd-intent-actions">${facetIntents.map(item => `<button type="button" data-intent-axis="${escapeHtml(item.key)}" data-intent-value="${escapeHtml(item.value)}"${item.count ? '' : ' disabled'}>${escapeHtml(TEXT.useFacet(item.axis, item.label, item.count))}</button>`).join('')}</div>`;
      return;
    }
    const suggestions = activeQueryMatchCount ? [] : correctionSuggestions(state.q);
    if (suggestions.length) {
      root.hidden = false;
      root.innerHTML = `<h2>${TEXT.spelling}</h2><p class="pmd-help">${TEXT.suggestionHelp}</p><div class="pmd-intent-actions">${suggestions.map(item => `<button type="button" data-correction="${escapeHtml(item.value)}">${escapeHtml(TEXT.searchFor(item.label))}</button>`).join('')}</div>`;
      return;
    }
    root.hidden = true;
    root.innerHTML = '';
  }

  function updateSearchControls() {
    const input = $('#pmdSearch');
    const clear = $('#pmdClearSearch');
    if (input && input.value !== state.q) input.value = state.q;
    if (clear) clear.hidden = !state.q;
    const status = $('#pmdSearchStatus');
    if (status) status.textContent = state.q ? TEXT.searchStatus(state.q) : '';
  }

  function effectiveSort() {
    return state.q && !state.sortExplicit ? 'relevance' : state.sort;
  }

  function compareEvents(left, right, sort = effectiveSort()) {
    return CORE.compareRecords(left, right, sort, UI_LOCALE);
  }

  function groupTitle(group) {
    const representative = group.event || group.parent || group.occurrences?.[0];
    return representative?.series?.title || representative?.title || '';
  }

  function groupSortEvent(group, sort = effectiveSort()) {
    if (group.event) return group.event;
    const chronology = ['soonest', 'latest'].includes(sort);
    const candidates = chronology && group.occurrences.length ? group.occurrences : group.events;
    return [...candidates].sort((left, right) => compareEvents(left, right, sort))[0] || group.parent || group.occurrences[0];
  }

  function compareGroups(left, right, sort = effectiveSort()) {
    if (sort === 'title') return groupTitle(left).localeCompare(groupTitle(right), UI_LOCALE, { sensitivity: 'base' });
    return compareEvents(groupSortEvent(left, sort), groupSortEvent(right, sort), sort)
      || groupTitle(left).localeCompare(groupTitle(right), UI_LOCALE, { sensitivity: 'base' });
  }

  function buildResultGroups(list) {
    return CORE.groupSeries(list, effectiveSort(), UI_LOCALE).sort((left, right) => compareGroups(left, right));
  }

  function applyFiltersAndSort() {
    activeQueryTerms = queryTerms(state.q);
    activeQueryInvalid = queryIsInvalid(state.q, activeQueryTerms);
    activeQueryMatchCount = 0;
    activeToday = calendarToday();
    filteredEvents = [];
    for (const event of events) {
      const match = activeQueryInvalid
        ? { matched: false, score: 0, reason: null }
        : searchMatch(event, activeQueryTerms);
      if (state.q && match.matched) activeQueryMatchCount += 1;
      event._queryMatched = match.matched;
      event._match = match.reason;
      event._matchScore = match.score;
      if (!routeMatches(event) || !match.matched || !eventMatchesDate(event)) continue;
      if (CORE.matchesFacets(event, state.facets)) filteredEvents.push(event);
    }
    filteredEvents = CORE.sortRecords(filteredEvents, effectiveSort(), UI_LOCALE);
    resultGroups = buildResultGroups(filteredEvents);
  }

  function detailHref(event) {
    return `${locale === 'fr' ? '/polymythseminars/fr/events/' : '/polymythseminars/events/'}${encodeURIComponent(event.id)}/`;
  }

  function displayDate(event, compact = false) {
    if (!event._startDay) return COPY.datePending;
    const monthOnly = event.date_precision === 'month';
    const options = monthOnly
      ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
      : compact
        ? { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
        : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
    const formatter = new Intl.DateTimeFormat(UI_LOCALE, options);
    const start = formatter.format(event._startDay);
    const value = !event._endDay || isoDay(event._endDay) === isoDay(event._startDay)
      ? start
      : `${start} ${locale === 'fr' ? 'au' : 'to'} ${formatter.format(event._endDay)}`;
    return event.temporal?.type === 'estimated' || ['estimated', 'approximate'].includes(event.date_precision) ? COPY.estimatedDate(value) : value;
  }

  function displayTime(event) {
    if (event.time_precision === 'all-day') return COPY.allDay;
    if (event.time_precision === 'not-applicable') return COPY.timeNotApplicable;
    if (event.time_precision === 'unknown') return COPY.timePending;
    const clock = CORE.temporalClock(event.date, event.temporal || {}, UI_LOCALE);
    if (!clock) return COPY.timePending;
    const value = clock.text;
    if (event.time_precision === 'approximate') return COPY.approximateTime(value);
    if (event.time_precision === 'estimated') return COPY.estimatedTime(value);
    return value;
  }

  function displayPlace(event) {
    return [event.venue, event.city, event.country].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' · ') || COPY.placePending;
  }

  function eventDomId(event) {
    const safe = String(event.id || event.title).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 90);
    return `pmd-event-${safe || 'listing'}`;
  }

  function trustLine(event) {
    const parts = [];
    if (event.confirmation_status) parts.push(CONFIRMATION_LABELS[event.confirmation_status] || titleCase(event.confirmation_status));
    if (event.destination_status) parts.push(`${TEXT.link}${locale === 'fr' ? ' :' : ':'} ${DESTINATION_LABELS[event.destination_status] || titleCase(event.destination_status).toLocaleLowerCase(UI_LOCALE)}`);
    const checkedValue = event.checked_on || event.last_checked_at;
    if (checkedValue) {
      const checked = parseDate(checkedValue);
      parts.push(`${COPY.checked} ${checked ? new Intl.DateTimeFormat(UI_LOCALE, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(checked) : checkedValue}`);
    }
    return parts.join(' · ');
  }

  function eventActions(event) {
    const rendered = [];
    const seen = new Set();
    const addAction = (href, label, className = '') => {
      const url = safeUrl(href);
      if (!url || seen.has(url)) return;
      seen.add(url);
      const external = new URL(url).origin !== window.location.origin;
      rendered.push(`<a class="pm-action${className ? ` ${className}` : ''}" href="${escapeHtml(url)}"${external ? ' rel="noopener noreferrer"' : ''}>${escapeHtml(label)}<span class="visually-hidden">${TEXT.forTitle}${escapeHtml(event.title)}</span></a>`);
    };
    if (surface !== 'monitoring') addAction(detailHref(event), COPY.details, 'primary-link');
    for (const action of asArray(event.actions)) {
      if (!action || typeof action !== 'object') continue;
      const kind = String(action.kind || 'detail');
      const scope = String(action.scope || '');
      const label = kind === 'detail' && scope === 'series'
        ? COPY.officialSeries
        : kind === 'detail' && scope === 'event'
          ? COPY.officialEvent
          : scope === 'series' && kind === 'source'
            ? COPY.officialSeries
            : (ACTION_LABELS[kind] || titleCase(kind));
      const href = kind === 'details' ? detailHref(event) : action.url;
      addAction(href, label, kind === 'source' ? 'pm-source-action' : '');
    }
    if (!rendered.length) return `<p class="pmd-card-trust">${COPY.noVerifiedLink}</p>`;
    return `<div class="pmd-card-actions pm-card-actions">${rendered.join('')}</div>`;
  }

  function eventCard(event) {
    const lang = eventLanguage(event);
    const kind = event.facets.kind?.[0] || 'attend';
    const what = event.facets.what?.[0];
    const description = event.description.length > 420 ? `${event.description.slice(0, 417).trim()}…` : event.description;
    const title = surface === 'monitoring'
      ? escapeHtml(event.title)
      : `<a href="${escapeHtml(detailHref(event))}">${escapeHtml(event.title)}</a>`;
    const datePanel = surface === 'monitoring'
      ? `<div class="pmd-card-date"><strong>${COPY.datePending}</strong></div>`
      : `<div class="pmd-card-date"><strong>${escapeHtml(displayDate(event, true))}</strong><span>${escapeHtml(displayTime(event))}</span></div>`;
    const reason = state.q && event._match ? `<p class="pmd-match-reason">${escapeHtml(COPY.matched(event._match.field, event._match.source))} <span>(${escapeHtml(event._match.kind)})</span></p>` : '';
    return `<article class="pmd-card pm-event-card" data-event-id="${escapeHtml(event.id)}" id="${escapeHtml(eventDomId(event))}">${datePanel}<div class="pmd-card-main"><div class="pmd-card-badges"><span class="pmd-badge ${escapeHtml(kind)}">${kind === 'apply' ? TEXT.apply : TEXT.attend}</span>${what ? `<span class="pmd-badge">${escapeHtml(optionLabel('what', what))}</span>` : ''}</div><h3 lang="${escapeHtml(lang)}">${title}</h3>${event.speaker_or_director ? `<p class="pmd-card-meta" lang="${escapeHtml(lang)}">${escapeHtml(event.speaker_or_director)}</p>` : ''}<p class="pmd-card-meta">${escapeHtml(displayPlace(event))}</p>${description ? `<p class="pmd-card-description" lang="${escapeHtml(lang)}">${escapeHtml(description)}</p>` : ''}${reason}${trustLine(event) ? `<p class="pmd-card-trust">${escapeHtml(trustLine(event))}</p>` : ''}${eventActions(event)}</div></article>`;
  }

  function seriesCard(group) {
    const representative = group.parent || group.occurrences[0];
    if (!representative) return '';
    const matchingCount = group.occurrences.length;
    const declaredCount = Math.max(Number(representative.series?.occurrence_count) || 0, matchingCount);
    const occurrenceLabel = matchingCount < declaredCount
      ? COPY.matchingOccurrences(matchingCount, declaredCount)
      : COPY.seriesOccurrences(declaredCount);
    const title = representative.series?.title || representative.title;
    const summarySort = surface === 'monitoring' ? 'checked' : ['soonest', 'latest', 'relevance'].includes(effectiveSort()) ? effectiveSort() : 'soonest';
    const summaryEvent = groupSortEvent(group, summarySort) || representative;
    const heading = surface === 'monitoring'
      ? escapeHtml(title)
      : `<a href="${escapeHtml(detailHref(representative))}">${escapeHtml(title)}</a>`;
    const visibleOccurrences = group.occurrences;
    const reasonEvent = group.events.find(event => event._match);
    const reason = state.q && reasonEvent?._match ? `<p class="pmd-match-reason">${escapeHtml(COPY.matched(reasonEvent._match.field, reasonEvent._match.source))} <span>(${escapeHtml(reasonEvent._match.kind)})</span></p>` : '';
    const occurrences = visibleOccurrences.length
      ? `<details class="pmd-series-occurrences"><summary>${COPY.openOccurrences}</summary><ol>${visibleOccurrences.map(event => surface === 'monitoring'
        ? `<li lang="${escapeHtml(eventLanguage(event))}">${escapeHtml(event.title)}</li>`
        : `<li><a href="${escapeHtml(detailHref(event))}" lang="${escapeHtml(eventLanguage(event))}">${escapeHtml(displayDate(event))}: ${escapeHtml(event.title)}</a></li>`).join('')}</ol></details>`
      : '';
    const summaryMeta = surface === 'monitoring'
      ? displayPlace(summaryEvent)
      : `${displayDate(summaryEvent)} · ${displayTime(summaryEvent)} · ${displayPlace(summaryEvent)}`;
    const trust = trustLine(summaryEvent);
    return `<article class="pmd-series-card pm-event-card" data-event-id="${escapeHtml(representative.id)}"><div class="pmd-series-summary"><div><div class="pmd-card-badges"><span class="pmd-badge">${TEXT.series}</span></div><h3 lang="${escapeHtml(eventLanguage(representative))}">${heading}</h3></div><span class="pmd-series-count">${escapeHtml(occurrenceLabel)}</span></div><p class="pmd-card-meta">${escapeHtml(summaryMeta)}</p>${representative.description ? `<p class="pmd-card-description" lang="${escapeHtml(eventLanguage(representative))}">${escapeHtml(representative.description.slice(0, 420))}</p>` : ''}${reason}${trust ? `<p class="pmd-card-trust">${escapeHtml(trust)}</p>` : ''}${occurrences}${eventActions(representative)}</article>`;
  }

  function chronologyHeading(group) {
    const representative = groupSortEvent(group, effectiveSort());
    if (!representative?._startDay) return TEXT.dateConfirm;
    return new Intl.DateTimeFormat(UI_LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(representative._startDay);
  }

  function renderPagination(totalPages) {
    const nav = $('#pmdPagination');
    if (!nav) return;
    if (totalPages <= 1 || state.view === 'calendar') {
      nav.hidden = true;
      nav.innerHTML = '';
      return;
    }
    nav.hidden = false;
    const pages = new Set([1, totalPages, state.page - 2, state.page - 1, state.page, state.page + 1, state.page + 2]);
    const chosen = [...pages].filter(page => page >= 1 && page <= totalPages).sort((left, right) => left - right);
    const items = [];
    if (state.page > 1) items.push(`<a href="${escapeHtml(targetUrl(surface, { page: state.page - 1 }))}" data-page="${state.page - 1}" rel="prev">${COPY.previous}</a>`);
    let prior = 0;
    for (const page of chosen) {
      if (prior && page - prior > 1) items.push('<span aria-hidden="true">…</span>');
      items.push(page === state.page ? `<span aria-current="page">${COPY.page(page)}</span>` : `<a href="${escapeHtml(targetUrl(surface, { page }))}" data-page="${page}">${COPY.page(page)}</a>`);
      prior = page;
    }
    if (state.page < totalPages) items.push(`<a href="${escapeHtml(targetUrl(surface, { page: state.page + 1 }))}" data-page="${state.page + 1}" rel="next">${COPY.next}</a>`);
    nav.innerHTML = items.join('');
  }

  function renderList() {
    const root = $('#pmdList');
    if (!root) return;
    const page = CORE.paginate(resultGroups, state.page, PAGE_SIZE);
    const totalPages = page.pages;
    state.page = page.page;
    const start = page.start;
    const pageGroups = page.items;
    if (!pageGroups.length) {
      root.innerHTML = `<div class="pmd-empty"><h3>${COPY.noResults}</h3><p>${COPY.noResultsHelp}</p><button type="button" data-action="clear-all">${COPY.clearAll}</button></div>`;
    } else {
      const chronology = ['soonest', 'latest'].includes(effectiveSort());
      let lastHeading = '';
      root.innerHTML = pageGroups.map(group => {
        const heading = chronology ? chronologyHeading(group) : '';
        const header = heading && heading !== lastHeading ? `<h3 class="pmd-month-heading">${escapeHtml(heading)}</h3>` : '';
        lastHeading = heading || lastHeading;
        return `${header}${group.type === 'series' ? seriesCard(group) : eventCard(group.event)}`;
      }).join('');
    }
    renderPagination(totalPages);
    const first = resultGroups.length ? start + 1 : 0;
    const last = page.end;
    $('#pmdLiveStatus').textContent = resultGroups.length ? COPY.showing(first, last, resultGroups.length) : COPY.noResults;
  }

  function calendarMonth() {
    if (state.month) {
      const [year, month] = state.month.split('-').map(Number);
      if (year >= 1900 && month >= 1 && month <= 12) return new Date(Date.UTC(year, month - 1, 1, 12));
    }
    const firstDated = filteredEvents.find(event => event._startDay && event.series?.role !== 'parent');
    const basis = firstDated?._startDay || calendarToday();
    state.month = monthValue(basis);
    return new Date(Date.UTC(basis.getUTCFullYear(), basis.getUTCMonth(), 1, 12));
  }

  function calendarEventLink(event) {
    const text = escapeHtml(event.title);
    return `<a href="${escapeHtml(detailHref(event))}" lang="${escapeHtml(eventLanguage(event))}">${text}</a>`;
  }

  function eventOccursOnDay(event, day) {
    return event.series?.role !== 'parent'
      && Boolean(event._startDay)
      && event._startDay <= day
      && (event._endDay || event._startDay) >= day;
  }

  function calendarDayEvents(day) {
    return CORE.sortRecords(filteredEvents.filter(event => eventOccursOnDay(event, day)), 'soonest', UI_LOCALE);
  }

  function calendarVisibleEvents() {
    return filteredEvents.filter(event => event.series?.role !== 'parent' && event._startDay);
  }

  function calendarMonthEvents(month = calendarMonth()) {
    const monthEnd = addMonths(month, 1);
    return calendarVisibleEvents().filter(event => event._startDay < monthEnd && (event._endDay || event._startDay) >= month);
  }

  function renderCalendar(focusDay = '') {
    const root = $('#pmdCalendar');
    if (!root) return;
    const month = calendarMonth();
    state.month = monthValue(month);
    const title = new Intl.DateTimeFormat(UI_LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month);
    const monthCount = calendarMonthEvents(month).length;
    const overallCount = calendarVisibleEvents().length;
    const calendarSummary = COPY.calendarShowing(monthCount, overallCount, title);
    const firstCell = addDays(month, -month.getUTCDay());
    const today = calendarToday();
    const weekdayNames = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(UI_LOCALE, { weekday: 'long', timeZone: 'UTC' }).format(addDays(new Date(Date.UTC(2026, 7, 2, 12)), index)));
    const weeks = [];
    const agenda = [];
    for (let week = 0; week < 6; week += 1) {
      const cells = [];
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const day = addDays(firstCell, week * 7 + weekday);
        const key = isoDay(day);
        const dayEvents = calendarDayEvents(day);
        const expanded = expandedDays.has(key);
        const visible = expanded ? dayEvents : dayEvents.slice(0, 3);
        const classes = [day.getUTCMonth() !== month.getUTCMonth() ? 'pmd-outside' : '', key === isoDay(today) ? 'pmd-today' : ''].filter(Boolean).join(' ');
        const label = new Intl.DateTimeFormat(UI_LOCALE, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(day);
        cells.push(`<td class="${classes}" data-calendar-day="${key}"><time class="pmd-calendar-day-number" datetime="${key}" aria-label="${escapeHtml(label)}">${day.getUTCDate()}</time>${dayEvents.length ? `<ul class="pmd-calendar-events">${visible.map(event => `<li>${calendarEventLink(event)}</li>`).join('')}</ul>` : ''}${dayEvents.length > 3 ? `<button class="pmd-calendar-more" type="button" data-action="toggle-day" data-value="${key}" aria-expanded="${expanded}" aria-label="${escapeHtml(expanded ? `${COPY.showFewerDay} ${TEXT.onDate} ${label}` : `${COPY.showMoreDay(dayEvents.length - 3)} ${TEXT.onDate} ${label}`)}">${escapeHtml(expanded ? COPY.showFewerDay : COPY.showMoreDay(dayEvents.length - 3))}</button>` : ''}</td>`);
        if (day.getUTCMonth() === month.getUTCMonth() && dayEvents.length) {
          agenda.push(`<section class="pmd-agenda-day"><h4><time datetime="${key}">${escapeHtml(label)}</time></h4><ul>${dayEvents.map(event => `<li>${calendarEventLink(event)}</li>`).join('')}</ul></section>`);
        }
      }
      weeks.push(`<tr>${cells.join('')}</tr>`);
    }
    root.innerHTML = `<div class="pmd-calendar-head"><div class="pmd-calendar-nav"><button type="button" data-action="calendar-previous" aria-label="${COPY.previousMonth}">${COPY.previous}</button><button class="pmd-calendar-today" type="button" data-action="calendar-today">${COPY.today}</button></div><h3 aria-live="polite"><span>${escapeHtml(title)}</span><small>${escapeHtml(calendarSummary)}</small></h3><div class="pmd-calendar-nav"><button type="button" data-action="calendar-next" aria-label="${COPY.nextMonth}">${COPY.next}</button></div></div><div class="pmd-calendar-table-wrap"><table class="pmd-calendar-table"><caption>${escapeHtml(TEXT.calendarCaption(title))} ${escapeHtml(calendarSummary)}</caption><thead><tr>${weekdayNames.map(name => `<th scope="col">${escapeHtml(name)}</th>`).join('')}</tr></thead><tbody>${weeks.join('')}</tbody></table></div><div class="pmd-calendar-agenda" aria-label="${escapeHtml(`${title} ${locale === 'fr' ? 'ordre du jour' : 'agenda'}`)}">${agenda.length ? agenda.join('') : `<div class="pmd-empty"><h3>${escapeHtml(TEXT.emptyMonth(title))}</h3><p>${TEXT.changeMonth}</p></div>`}</div>`;
    renderPagination(1);
    $('#pmdLiveStatus').textContent = calendarSummary;
    if (focusDay) restoreFocus({ action: 'toggle-day', value: focusDay }, '#pmdCalendar h3');
  }

  function renderResults() {
    const list = $('#pmdList');
    const calendar = $('#pmdCalendar');
    const inCalendar = state.view === 'calendar' && surface !== 'monitoring';
    const visibleCount = inCalendar ? calendarVisibleEvents().length : filteredEvents.length;
    if (list) list.hidden = inCalendar;
    if (calendar) calendar.hidden = !inCalendar;
    if (inCalendar) renderCalendar();
    else renderList();
    const title = $('#pmdResultsTitle');
    if (title) title.textContent = surface === 'monitoring' ? TEXT.monitored : inCalendar ? TEXT.calendarResults : TEXT.listings;
    const count = $('#pmdResultsCount');
    if (count) count.textContent = inCalendar
      ? COPY.calendarShowing(calendarMonthEvents().length, visibleCount, new Intl.DateTimeFormat(UI_LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(calendarMonth()))
      : resultGroups.some(group => group.type === 'series') ? COPY.groups(filteredEvents.length, resultGroups.length) : COPY.results(filteredEvents.length);
    const preview = $('#pmdFilterPreview');
    if (preview) preview.textContent = COPY.results(visibleCount);
    const mobile = $('#pmdMobileResults');
    if (mobile) mobile.textContent = COPY.viewResults(visibleCount);
    const sort = $('#pmdSort');
    if (sort) sort.value = effectiveSort();
    const relevanceOption = sort?.querySelector('option[value="relevance"]');
    if (relevanceOption) {
      relevanceOption.hidden = !state.q;
      relevanceOption.disabled = !state.q;
    }
    const sortControl = $('#pmdSortControl');
    if (sortControl) sortControl.hidden = inCalendar;
    if (sort) sort.disabled = inCalendar;
    $$('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
  }

  function renderAll({ history = 'replace', focus = null } = {}) {
    if (loadFailed) return;
    if (!state.q && state.sort === 'relevance') {
      state.sort = surface === 'monitoring' ? 'checked' : 'soonest';
      state.sortExplicit = false;
    }
    applyFiltersAndSort();
    if (surface === 'research') {
      renderResearchFamilies();
      if ($('#pmdFacetSearch')?.value) filterResearchFamilies();
    }
    else renderCommonFilters();
    renderSelected();
    renderResults();
    renderSearchAssist();
    updateSearchControls();
    writeUrl(history);
    if (focus) restoreFocus(focus);
  }

  function clearFilters(includeSearch = false) {
    state.facets = Object.create(null);
    state.kindExplicitAll = false;
    if (!focusedRoute) routeScope = '';
    if (['attend', 'apply'].includes(defaultContent)) selectedFor('kind').add(defaultContent);
    state.date = surface === 'monitoring' ? 'all' : 'upcoming';
    state.page = 1;
    if (includeSearch) state.q = '';
  }

  function handleFilterChange(input) {
    const key = input.dataset.axis;
    const value = input.dataset.value;
    const token = focusToken(input);
    if (key === 'date') state.date = value;
    else if (key === 'kind') {
      if (value === 'all') {
        selectedFor('kind').clear();
        state.kindExplicitAll = true;
      } else {
        state.kindExplicitAll = false;
        setFacet('kind', [value]);
      }
    }
    else if (input.checked) selectedFor(key).add(value);
    else selectedFor(key).delete(value);
    state.page = 1;
    renderAll({ history: 'push', focus: token });
  }

  function moveCalendar(amount) {
    const current = calendarMonth();
    const next = addMonths(current, amount);
    state.month = monthValue(next);
    state.page = 1;
    renderAll({ history: 'push', focus: { action: amount < 0 ? 'calendar-previous' : 'calendar-next' } });
  }

  function bindEvents() {
    document.addEventListener('keydown', event => {
      if (event.key !== '/' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target?.isContentEditable) return;
      event.preventDefault();
      $('#pmdSearch')?.focus();
    });
    $('#pmdSearch')?.addEventListener('input', event => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.q = event.target.value.trim().slice(0, 240);
        state.page = 1;
        renderAll({ history: 'replace' });
      }, 180);
    });
    $('#pmdSearch')?.addEventListener('search', event => {
      window.clearTimeout(searchTimer);
      state.q = event.target.value.trim().slice(0, 240);
      state.page = 1;
      renderAll({ history: 'push' });
    });
    $('#pmdClearSearch')?.addEventListener('click', () => {
      state.q = '';
      state.page = 1;
      $('#pmdSearch').value = '';
      renderAll({ history: 'push' });
      $('#pmdSearch').focus();
    });
    $('#pmdSort')?.addEventListener('change', event => {
      state.sort = validSort(event.target.value);
      state.sortExplicit = true;
      state.page = 1;
      renderAll({ history: 'push', focus: focusToken(event.target) });
    });
    $('#pmdFacetSearch')?.addEventListener('input', filterResearchFamilies);

    document.addEventListener('change', event => {
      const input = event.target.closest('input[data-axis][data-value]');
      if (input) handleFilterChange(input);
    });
    document.addEventListener('toggle', event => {
      const details = event.target.closest?.('.pmd-research-family');
      if (!details) return;
      if (!facetSearchUpdating && event.isTrusted) details.dataset.userOpen = String(details.open);
      if (details.open) mountResearchFamily(details);
    }, true);
    document.addEventListener('click', event => {
      const pageLink = event.target.closest('#pmdPagination a[data-page]');
      if (pageLink) {
        event.preventDefault();
        state.page = Number(pageLink.dataset.page);
        renderAll({ history: 'push' });
        $('#pmdResultsTitle')?.focus();
        return;
      }
      const view = event.target.closest('[data-view]');
      if (view) {
        state.view = view.dataset.view === 'calendar' ? 'calendar' : 'list';
        state.page = 1;
        renderAll({ history: 'push', focus: focusToken(view) });
        return;
      }
      const correction = event.target.closest('[data-correction]');
      if (correction) {
        state.q = correction.dataset.correction;
        state.page = 1;
        renderAll({ history: 'push' });
        $('#pmdSearch')?.focus();
        return;
      }
      const intent = event.target.closest('[data-intent-axis][data-intent-value], [data-intent-axis][data-intent-values]');
      if (intent) {
        state.q = '';
        const values = String(intent.dataset.intentValues || intent.dataset.intentValue || '').split(',').filter(Boolean);
        setFacet(intent.dataset.intentAxis, values);
        renderAll({ history: 'push' });
        $('#pmdResultsTitle')?.focus();
        return;
      }
      const action = event.target.closest('[data-action]');
      if (!action) return;
      if (action.dataset.action === 'remove-filter') {
        const key = action.dataset.axis;
        if (key === 'route' && !focusedRoute) routeScope = '';
        else if (key === 'date') state.date = 'upcoming';
        else {
          selectedFor(key).delete(action.dataset.value);
          if (key === 'kind' && selectedFor(key).size === 0 && ['attend', 'apply'].includes(defaultContent)) state.kindExplicitAll = true;
        }
        state.page = 1;
        renderAll({ history: 'push', focus: { action: 'remove-filter' } });
      } else if (action.dataset.action === 'clear-filters') {
        clearFilters(false);
        renderAll({ history: 'push', focus: { action: 'clear-filters' } });
      } else if (action.dataset.action === 'clear-all') {
        clearFilters(true);
        renderAll({ history: 'push' });
        $('#pmdSearch')?.focus();
      } else if (action.dataset.action === 'calendar-previous') moveCalendar(-1);
      else if (action.dataset.action === 'calendar-next') moveCalendar(1);
      else if (action.dataset.action === 'calendar-today') {
        state.month = monthValue(calendarToday());
        renderAll({ history: 'push', focus: { action: 'calendar-today' } });
      } else if (action.dataset.action === 'toggle-day') {
        const key = action.dataset.value;
        if (expandedDays.has(key)) expandedDays.delete(key); else expandedDays.add(key);
        renderCalendar(key);
      }
    });

    $('#pmdMobileFilters')?.addEventListener('click', event => {
      if (surface === 'research') {
        const common = $('#pmdResearchCommonDrawer');
        if (common) {
          common.open = true;
          common.scrollIntoView({ block: 'start' });
          common.querySelector('input')?.focus() || common.querySelector('summary')?.focus();
        }
        return;
      }
      const drawer = $('#pmdFilterDrawer');
      if (!drawer) return;
      drawer.open = !drawer.open;
      event.currentTarget.setAttribute('aria-expanded', String(drawer.open));
      if (drawer.open) drawer.querySelector('input')?.focus();
    });
    $('#pmdMobileResults')?.addEventListener('click', () => {
      const drawer = $('#pmdFilterDrawer');
      if (drawer) drawer.open = false;
    });
    $('#pmdFilterDrawer')?.addEventListener('toggle', event => {
      $('#pmdMobileFilters')?.setAttribute('aria-expanded', String(event.target.open));
    });
    $('#pmdShare')?.addEventListener('click', async () => {
      const share = { title: document.title, url: window.location.href };
      try {
        if (navigator.share) await navigator.share(share);
        else await navigator.clipboard.writeText(share.url);
        $('#pmdLiveStatus').textContent = navigator.share ? TEXT.shareOpened : TEXT.copied;
      } catch (error) {
        if (error?.name !== 'AbortError') $('#pmdLiveStatus').textContent = TEXT.copyFailed;
      }
    });
    window.addEventListener('popstate', () => {
      const focus = focusToken();
      if (urlNeedsResearchProjection() && !RESEARCH_ONLY_AXES.some(key => axes.has(key))) {
        loadData();
        return;
      }
      readStateFromUrl();
      renderAll({ history: 'replace', focus });
    });
  }

  function validatePayload(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Discovery payload is not an object');
    const expectedSchema = surface === 'monitoring' ? 'polymythcal-watchlist-v2' : 'polymythcal-discovery-v2';
    const schema = candidate._schema || candidate.schema;
    if (schema !== expectedSchema) throw new Error(`Unexpected discovery schema: ${String(schema || 'missing')}`);
    const collection = surface === 'monitoring' ? candidate.items : candidate.events;
    if (!Array.isArray(collection)) throw new Error('Discovery payload has no public collection');
    if (!Number.isInteger(candidate.count) || candidate.count !== collection.length) throw new Error('Discovery payload count does not match its public collection');
    const seen = new Set();
    for (const item of collection) {
      const id = String(item?.id || '').trim();
      if (!id || seen.has(id)) throw new Error('Discovery payload has an empty or duplicate listing id');
      seen.add(id);
      if (item.content_language && !/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(String(item.content_language))) throw new Error(`Listing ${id} has an invalid content language`);
      if (!item.facets || typeof item.facets !== 'object' || Array.isArray(item.facets)) throw new Error(`Listing ${id} has no safe facet projection`);
      for (const key of REQUIRED_PUBLIC_FACETS) {
        if (!Array.isArray(item.facets[key])) throw new Error(`Listing ${id} is missing the canonical ${key} facet`);
      }
      for (const key of ['kind', 'what', 'places', 'formats', 'statuses']) {
        if (!item.facets[key].length) throw new Error(`Listing ${id} has no canonical ${key} value`);
      }
      for (const [key, values] of Object.entries(item.facets)) {
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value.trim())) throw new Error(`Listing ${id} has an invalid ${key} facet array`);
      }
      if (surface === 'monitoring') {
        if (Object.hasOwn(item, 'date') || Object.hasOwn(item, 'end_date')) throw new Error(`Monitoring listing ${id} exposes a date marker`);
        if (item.temporal?.type !== 'undated' || item.temporal?.start || item.temporal?.end) throw new Error(`Monitoring listing ${id} exposes a dated temporal value`);
      } else {
        if (!validCalendarDay(item.date)) throw new Error(`Listing ${id} has an invalid chronology date`);
        if (item.end_date && !validCalendarDay(item.end_date)) throw new Error(`Listing ${id} has an invalid chronology end date`);
      }
    }
    return collection;
  }

  function validateResearchPayload(candidate, discovery) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Research payload is not an object');
    if (candidate._schema !== 'polymythcal-research-v1') throw new Error(`Unexpected Research schema: ${String(candidate._schema || 'missing')}`);
    if (!Array.isArray(candidate.records) || !Number.isInteger(candidate.count) || candidate.count !== candidate.records.length) throw new Error('Research payload count does not match its public records');
    const chronology = new Map((discovery?.events || []).map(item => [String(item.id), item]));
    if (candidate.records.length !== chronology.size) throw new Error('Research payload does not cover the chronology projection');
    const seen = new Set();
    for (const record of candidate.records) {
      const id = String(record?.id || '').trim();
      if (!id || seen.has(id) || !chronology.has(id)) throw new Error('Research payload has an empty, duplicate, or unknown listing id');
      seen.add(id);
      const canonical = chronology.get(id);
      if (record.title && String(record.title) !== String(canonical.title)) throw new Error(`Research title drift for ${id}`);
      if (record.route && canonical.route && String(record.route) !== String(canonical.route)) throw new Error(`Research route drift for ${id}`);
      for (const [key, values] of Object.entries(record.facets || {})) {
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value.trim())) throw new Error(`Research listing ${id} has an invalid ${key} facet array`);
      }
      for (const [key, values] of Object.entries(record.search || {})) {
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value.trim())) throw new Error(`Research listing ${id} has an invalid ${key} search array`);
      }
      for (const source of asArray(record.sources)) {
        if (!source || typeof source !== 'object' || !safeUrl(source.url)) throw new Error(`Research listing ${id} has an unsafe source`);
      }
    }
    return candidate.records;
  }

  function urlNeedsResearchProjection() {
    if (surface === 'research') return true;
    if (surface !== 'main') return false;
    const params = new URLSearchParams(window.location.search);
    return RESEARCH_ONLY_AXES.some(key => String(params.get(key) || '').split(',').some(Boolean));
  }

  async function fetchPayload(url, generation) {
    let finalError = null;
    for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
      if (generation !== loadGeneration || pageIsHiding) throw new DOMException('Discovery load superseded', 'AbortError');
      const controller = new AbortController();
      activeFetchController = controller;
      const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          credentials: 'same-origin',
          cache: 'default',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        if (generation !== loadGeneration || pageIsHiding) throw error;
        finalError = error;
      } finally {
        window.clearTimeout(timeout);
        if (activeFetchController === controller) activeFetchController = null;
      }
    }
    throw finalError || new Error('Discovery payload could not be loaded');
  }

  async function loadData() {
    const results = $('#pmdResults');
    const generation = ++loadGeneration;
    activeFetchController?.abort();
    results?.setAttribute('aria-busy', 'true');
    try {
      let candidate = await fetchPayload(dataUrl, generation);
      if (generation !== loadGeneration) return;
      validatePayload(candidate);
      if (urlNeedsResearchProjection()) {
        const researchCandidate = await fetchPayload(researchDataUrl, generation);
        if (generation !== loadGeneration) return;
        validateResearchPayload(researchCandidate, candidate);
        candidate = CORE.mergeResearchProjection(candidate, researchCandidate);
      }
      payload = candidate;
      const collection = validatePayload(payload);
      events = collection.map(item => normalizeEvent(item, surface === 'monitoring'));
      axes = taxonomyFromPayload(payload);
      registerFacetSearchAliases();
      readStateFromUrl();
      dataReady = true;
      loadFailed = false;
      renderAll();
      results?.setAttribute('aria-busy', 'false');
      const mobileBar = $('#pmdMobileBar');
      if (mobileBar) {
        mobileBar.hidden = false;
        if (surface === 'research') {
          $('#pmdMobileFilters')?.setAttribute('aria-controls', 'pmdResearchCommonDrawer pmdResearchFilters');
          $('#pmdMobileFilters')?.removeAttribute('aria-expanded');
        }
      }
    } catch (error) {
      if (generation !== loadGeneration || pageIsHiding) return;
      dataReady = false;
      loadFailed = true;
      payload = null;
      events = [];
      filteredEvents = [];
      resultGroups = [];
      axes = new Map();
      if (results) {
        const list = $('#pmdList');
        const calendar = $('#pmdCalendar');
        if (list) list.hidden = false;
        if (calendar) calendar.hidden = true;
        results.setAttribute('aria-busy', 'false');
        $('#pmdResultsTitle').textContent = COPY.unavailable;
        $('#pmdResultsCount').textContent = COPY.unavailableHelp;
        if (list) list.innerHTML = `<div class="pmd-empty"><h3>${COPY.unavailable}</h3><p>${COPY.unavailableHelp}</p><button type="button" id="pmdRetry">${COPY.retry}</button></div>`;
        $('#pmdRetry')?.addEventListener('click', loadData, { once: true });
      }
      console.error('Polymythcal discovery data failed to load.', error);
    }
  }

  bindEvents();
  window.addEventListener('pagehide', () => {
    pageIsHiding = true;
    activeFetchController?.abort();
  });
  window.addEventListener('pageshow', event => {
    const shouldResume = pageIsHiding;
    pageIsHiding = false;
    if (shouldResume && (!dataReady || event.persisted)) loadData();
  });
  loadData();
})();
