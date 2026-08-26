#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

/**
 * Polymythcal public discovery model.
 *
 * This module is deliberately build-side. It converts the editorial calendar
 * master into a small, auditable public projection so the browser never needs
 * to classify records from prose or receive research-only fields.
 */

const EXPECTED_MONITORING_MARKER_COUNT = 134;
const CLOCK_PRECISIONS = new Set(['exact', 'estimated', 'approximate']);
const SEARCH_GROUPS = Object.freeze([
  'title',
  'description',
  'aliases',
  'people',
  'organizer',
  'place',
  'topics',
  'format'
]);
const PERSISTED_SEARCH_GROUPS = Object.freeze(['aliases', 'topics', 'format']);
const TEMPORAL_TYPES = Object.freeze([
  'global-instant',
  'local-date-time',
  'all-day-local-date',
  'deadline',
  'date-range',
  'estimated',
  'undated'
]);
const COMMON_FACET_AXES = Object.freeze([
  'kind', 'what', 'places', 'topics', 'formats',
  'audiences', 'statuses'
]);
const RESEARCH_FACET_AXES = Object.freeze([
  'celestialKinds', 'presence', 'academicForms', 'artsFormats', 'participationFormats',
  'civicFormats', 'communityFormats', 'digitalFormats', 'programFormats',
  'grades'
]);
const PUBLIC_ACTION_CANDIDATE_FIELDS = Object.freeze([
  ['registration_url', 'registration'],
  ['application_url', 'application'],
  ['submission_url', 'submission'],
  ['rules_url', 'rules'],
  ['ticket_url', 'tickets'],
  ['tickets_url', 'tickets'],
  ['stream_url', 'stream'],
  ['livestream_url', 'stream'],
  ['watch_url', 'stream']
]);

const PUBLIC_EVENT_KEYS = Object.freeze([
  'id',
  'title',
  'description',
  'speaker_or_director',
  'organizer',
  'venue',
  'city',
  'country',
  'date',
  'end_date',
  'date_precision',
  'time_precision',
  'type',
  'record_kind',
  'confirmation_status',
  'lifecycle_status',
  'writing_bands',
  'academic_bands',
  'checked_on',
  'content_language',
  'route',
  'temporal',
  'actions',
  'relations',
  'facets',
  'search'
]);

const PUBLIC_WATCHLIST_KEYS = Object.freeze([
  ...PUBLIC_EVENT_KEYS.filter(key => ![
    'date', 'end_date', 'date_precision', 'time_precision'
  ].includes(key)),
  'date_status'
]);

const PUBLIC_RESEARCH_KEYS = Object.freeze([
  'id',
  'title',
  'route',
  'facets',
  'relations',
  'sources',
  'actions',
  'search'
]);

function entries(rows) {
  return Object.fromEntries(rows.map(([id, en, fr, group]) => [
    id,
    group ? { en, fr, group } : { en, fr }
  ]));
}

function axis(en, fr, rows) {
  return { label: { en, fr }, values: entries(rows) };
}

const TAXONOMY = Object.freeze({
  version: '2',
  axes: {
    kind: axis('Attend or apply', 'Assister ou postuler', [
      ['attend', 'Events to attend', 'Événements auxquels assister'],
      ['apply', 'Opportunities to apply for', 'Possibilités auxquelles postuler']
    ]),
    what: axis('What', 'Quoi', [
      ['event:talks', 'Talks, panels, and lectures', 'Causeries, panels et conférences', 'Events'],
      ['event:workshops', 'Workshops', 'Ateliers', 'Events'],
      ['event:conferences', 'Conferences and academic events', 'Congrès et activités universitaires', 'Events'],
      ['event:performances', 'Performances', 'Spectacles', 'Events'],
      ['event:exhibitions', 'Exhibitions', 'Expositions', 'Events'],
      ['event:screenings', 'Screenings', 'Projections', 'Events'],
      ['event:festivals', 'Festivals', 'Festivals', 'Events'],
      ['event:community-civic', 'Community and civic events', 'Activités communautaires et civiques', 'Events'],
      ['event:celestial-occurrence', 'Celestial occurrences', 'Phénomènes célestes', 'Events'],
      ['event:seasonal-observance', 'Seasonal observances', 'Observances saisonnières', 'Events'],
      ['event:ritual-observance', 'Ritual observances and holidays', 'Observances rituelles et fêtes', 'Events'],
      ['event:other', 'Other events', 'Autres événements', 'Events'],
      ['opportunity:cfp', 'Calls for papers and proposals', 'Appels de communications et de propositions', 'Opportunities'],
      ['opportunity:competitions', 'Competitions, prizes, and awards', 'Concours, prix et distinctions', 'Opportunities'],
      ['opportunity:funding', 'Fellowships, grants, and residencies', 'Bourses, subventions et résidences', 'Opportunities'],
      ['opportunity:applications', 'Applications and submissions', 'Candidatures et soumissions', 'Opportunities'],
      ['opportunity:other', 'Other opportunities', 'Autres possibilités', 'Opportunities']
    ]),
    places: axis('Where', 'Où', [
      ['toronto-gta', 'Toronto and GTA', 'Toronto et le Grand Toronto'],
      ['hamilton', 'Hamilton and Burlington', 'Hamilton et Burlington'],
      ['guelph-waterloo', 'Guelph and Waterloo Region', 'Guelph et la région de Waterloo'],
      ['kingston', 'Kingston', 'Kingston'],
      ['gananoque', 'Gananoque', 'Gananoque'],
      ['brockville', 'Brockville and Prescott', 'Brockville et Prescott'],
      ['cornwall-sdg', 'Cornwall and SDG', 'Cornwall et SDG'],
      ['montreal', 'Montréal and West Island', 'Montréal et l’Ouest-de-l’Île'],
      ['online', 'Online and global', 'En ligne et mondial'],
      ['other', 'Other or location pending', 'Autre lieu ou lieu à confirmer']
    ]),
    topics: axis('Topics', 'Sujets', [
      ['philosophy', 'Philosophy and ethics', 'Philosophie et éthique'],
      ['learning', 'Learning and scholarship', 'Apprentissage et recherche'],
      ['arts', 'Arts and performance', 'Arts et spectacle'],
      ['writing', 'Writing and literature', 'Écriture et littérature'],
      ['history', 'History and heritage', 'Histoire et patrimoine'],
      ['film', 'Film and media', 'Cinéma et médias'],
      ['media-literacy', 'Media literacy', 'Éducation aux médias'],
      ['interdisciplinary', 'Interdisciplinary', 'Interdisciplinaire'],
      ['academic-events', 'Public intellectual and academic', 'Vie intellectuelle et universitaire publique'],
      ['civic', 'Civic and community', 'Vie civique et communautaire'],
      ['social-studies', 'Social studies', 'Sciences sociales'],
      ['science', 'Science and technology', 'Sciences et technologies'],
      ['astronomy', 'Astronomy', 'Astronomie'],
      ['astrology', 'Astrology', 'Astrologie'],
      ['seasonal-observances', 'Seasonal observances', 'Observances saisonnières'],
      ['ritual-observances', 'Ritual observances and holidays', 'Observances rituelles et fêtes'],
      ['other', 'Other topics', 'Autres sujets']
    ]),
    celestialKinds: axis('Celestial occurrence', 'Phénomène céleste', [
      ['moon-phase', 'Moon phases', 'Phases de la Lune'],
      ['eclipse', 'Eclipses', 'Éclipses'],
      ['meteor-shower', 'Meteor showers', 'Pluies de météores'],
      ['solstice-equinox', 'Solstices and equinoxes', 'Solstices et équinoxes'],
      ['planetary-event', 'Planetary dates', 'Dates planétaires']
    ]),
    formats: axis('Participation format', 'Mode de participation', [
      ['in-person', 'In person', 'En personne'],
      ['online', 'Online', 'En ligne'],
      ['hybrid', 'Hybrid', 'Hybride'],
      ['pending', 'Format pending', 'Mode à confirmer']
    ]),
    audiences: axis('Audience', 'Public', [
      ['public', 'General public', 'Grand public'],
      ['youth', 'Students and youth', 'Jeunes et élèves'],
      ['university', 'University and graduate', 'Université et cycles supérieurs'],
      ['educators', 'Educators', 'Personnel enseignant'],
      ['families', 'Families and all ages', 'Familles et tous âges']
    ]),
    statuses: axis('Details', 'Renseignements', [
      ['confirmed', 'Confirmed details', 'Renseignements confirmés'],
      ['pending', 'Some details pending', 'Certains renseignements à confirmer']
    ]),
    presence: axis('Who is present', 'Qui est présent', [
      ['director-filmmaker', 'Director or filmmaker', 'Réalisateur ou cinéaste'],
      ['cast-crew', 'Cast or crew', 'Distribution ou équipe'],
      ['film-subject', 'Film subject', 'Sujet du film'],
      ['author-writer', 'Author or writer', 'Auteur ou autrice'],
      ['artist-curator', 'Artist or curator', 'Artiste ou commissaire'],
      ['scholar-expert', 'Scholar or expert', 'Chercheur ou spécialiste'],
      ['performer-storyteller', 'Performer or storyteller', 'Interprète ou conteur'],
      ['production-participants', 'Production participants', 'Participants à la production'],
      ['community-witness-elder', 'Community leader, witness, survivor, or elder', 'Responsable communautaire, témoin, survivant ou aîné'],
      ['host-moderator', 'Host or moderator', 'Hôte ou modérateur'],
      ['identity-pending', 'Participant identity pending', 'Identité du participant à confirmer']
    ]),
    academicForms: axis('Academic format', 'Format universitaire', [
      ['public-lecture', 'Public lecture or scholar talk', 'Conférence publique ou causerie savante'],
      ['panel-debate-forum', 'Panel, debate, or forum', 'Panel, débat ou forum'],
      ['conference-symposium', 'Conference or symposium', 'Congrès ou symposium'],
      ['colloquium-seminar', 'Colloquium or seminar', 'Colloque ou séminaire'],
      ['workshop-webinar', 'Workshop or webinar', 'Atelier ou webinaire'],
      ['thesis-defence', 'Thesis defence', 'Soutenance de thèse'],
      ['research-showcase-poster', 'Research showcase or poster session', 'Vitrine de recherche ou séance d’affiches'],
      ['reading-group-philosophy-cafe', 'Reading group or philosophy café', 'Groupe de lecture ou café philosophique'],
      ['book-talk-launch', 'Book talk or launch', 'Causerie ou lancement de livre']
    ]),
    artsFormats: axis('Arts format', 'Format artistique', [
      ['theatre-performance', 'Theatre performance', 'Spectacle de théâtre'],
      ['dance-performance', 'Dance performance', 'Spectacle de danse'],
      ['music-performance', 'Music performance', 'Prestation musicale'],
      ['opera-orchestral', 'Opera or orchestral', 'Opéra ou musique orchestrale'],
      ['exhibition', 'Exhibition', 'Exposition'],
      ['festival', 'Festival', 'Festival'],
      ['public-art-site-specific', 'Public or site-specific art', 'Art public ou in situ'],
      ['artist-curator-program', 'Artist or curator program', 'Programme d’artiste ou de commissaire'],
      ['screening-film-festival', 'Screening or film festival', 'Projection ou festival de cinéma'],
      ['talkback-discussion', 'Talkback or post-show discussion', 'Discussion après spectacle'],
      ['multidisciplinary-performance', 'Multidisciplinary performance', 'Spectacle multidisciplinaire']
    ]),
    participationFormats: axis('Participation format', 'Format participatif', [
      ['open-mic-stage', 'Open mic or open stage', 'Micro ouvert ou scène ouverte'],
      ['writing-poetry-circle', 'Writing or poetry circle', 'Cercle d’écriture ou de poésie'],
      ['book-reading-group', 'Book club or reading group', 'Club de lecture'],
      ['conversation-language', 'Language conversation', 'Conversation linguistique'],
      ['storytelling', 'Storytelling', 'Conte'],
      ['zine-comics', 'Zines or comics', 'Zines ou bandes dessinées'],
      ['board-tabletop-games', 'Board or tabletop games', 'Jeux de société'],
      ['game-jam-hackathon', 'Game jam or hackathon', 'Game jam ou hackathon'],
      ['maker-repair-craft', 'Maker, repair, or craft', 'Fabrication, réparation ou artisanat'],
      ['public-art-making', 'Public art-making', 'Création artistique publique'],
      ['social-dance', 'Social dance', 'Danse sociale'],
      ['music-jam', 'Music jam', 'Bœuf musical'],
      ['improv-theatre', 'Improv or participatory theatre', 'Improvisation ou théâtre participatif']
    ]),
    civicFormats: axis('Civic, legal, and labour format', 'Format civique, juridique et syndical', [
      ['election-voting', 'Election or voting', 'Élection ou vote'],
      ['candidate-campaign', 'Candidate or campaign event', 'Activité de candidat ou de campagne'],
      ['council-board-committee', 'Council, board, or committee', 'Conseil, commission ou comité'],
      ['public-hearing-deputation', 'Public hearing or deputation', 'Audience publique ou députation'],
      ['public-consultation', 'Public consultation', 'Consultation publique'],
      ['legislature-parliamentary-sitting', 'Legislature or parliamentary sitting', 'Séance législative ou parlementaire'],
      ['court-tribunal-hearing', 'Court or tribunal hearing', 'Audience judiciaire ou administrative'],
      ['inquest-public-inquiry', 'Inquest or public inquiry', 'Enquête ou commission publique'],
      ['union-conference', 'Union meeting or conference', 'Réunion ou congrès syndical'],
      ['rally-march-counterprotest', 'Rally, march, or counter-protest', 'Rassemblement, marche ou contre-manifestation'],
      ['picket-strike-labour-action', 'Picket, strike, or labour action', 'Piquetage, grève ou action syndicale'],
      ['civic-deadline-compliance', 'Civic deadline or compliance stage', 'Échéance civique ou étape de conformité']
    ]),
    communityFormats: axis('Community, charity, and heritage format', 'Format communautaire, caritatif et patrimonial', [
      ['charity-walk-run-ride', 'Charity walk, run, or ride', 'Marche, course ou randonnée caritative'],
      ['fundraiser', 'Fundraiser', 'Collecte de fonds'],
      ['benefit-performance', 'Benefit performance', 'Spectacle-bénéfice'],
      ['food-clothing-drive', 'Food or clothing drive', 'Collecte de nourriture ou de vêtements'],
      ['mutual-aid-action', 'Mutual-aid action', 'Action d’entraide'],
      ['volunteer-day', 'Volunteer day', 'Journée de bénévolat'],
      ['community-cleanup', 'Community cleanup', 'Nettoyage communautaire'],
      ['repair-cafe', 'Repair café', 'Café de réparation'],
      ['community-garden', 'Community garden', 'Jardin communautaire'],
      ['neighbourhood-assembly', 'Neighbourhood assembly', 'Assemblée de quartier'],
      ['community-meal', 'Community meal', 'Repas communautaire'],
      ['block-party', 'Block party', 'Fête de quartier'],
      ['bazaar-night-market', 'Bazaar or night market', 'Bazar ou marché nocturne'],
      ['newcomer-diaspora', 'Newcomer or diaspora event', 'Activité pour nouveaux arrivants ou diaspora'],
      ['historical-walk', 'Historical walk', 'Promenade historique'],
      ['architecture-tour', 'Architecture tour', 'Visite architecturale'],
      ['cemetery-tour', 'Cemetery tour', 'Visite de cimetière'],
      ['public-dig', 'Public archaeological dig', 'Fouille archéologique publique'],
      ['reenactment', 'Reenactment', 'Reconstitution historique'],
      ['open-archive', 'Open archive', 'Archives ouvertes'],
      ['doors-open', 'Doors Open event', 'Portes ouvertes'],
      ['land-based-learning', 'Land-based learning', 'Apprentissage ancré dans le territoire']
    ]),
    digitalFormats: axis('Live media and digital format', 'Format médiatique et numérique en direct', [
      ['live-podcast', 'Live podcast', 'Balado en direct'],
      ['public-radio-recording', 'Public radio recording', 'Enregistrement radiophonique public'],
      ['media-taping', 'Media taping', 'Enregistrement médiatique'],
      ['livestreamed-discussion', 'Livestreamed discussion', 'Discussion diffusée en direct'],
      ['ama', 'AMA', 'AMA'],
      ['virtual-conference', 'Virtual conference', 'Conférence virtuelle'],
      ['virtual-exhibition', 'Virtual exhibition', 'Exposition virtuelle'],
      ['virtual-festival', 'Virtual festival', 'Festival virtuel'],
      ['creator-livestream', 'Creator livestream', 'Diffusion en direct d’un créateur'],
      ['creator-watch-party', 'Creator watch party', 'Visionnement collectif avec un créateur'],
      ['game-stream', 'Game-stream event', 'Diffusion de jeu'],
      ['vr-ar-event', 'VR or AR event', 'Activité de RV ou de RA'],
      ['online-premiere', 'Online premiere', 'Première en ligne'],
      ['platform-native-cultural-event', 'Platform-native cultural event', 'Activité culturelle propre à une plateforme']
    ]),
    programFormats: axis('Course and multi-session program', 'Cours et programme multiséance', [
      ['public-short-course', 'Public short course', 'Cours public de courte durée'],
      ['summer-school', 'Summer school', 'École d’été'],
      ['camp', 'Camp', 'Camp'],
      ['academy', 'Academy', 'Académie'],
      ['institute', 'Institute', 'Institut'],
      ['intensive', 'Intensive', 'Programme intensif'],
      ['masterclass-series', 'Masterclass series', 'Série de classes de maître'],
      ['cohort-program', 'Cohort program', 'Programme de cohorte'],
      ['mentorship-program', 'Mentorship program', 'Programme de mentorat'],
      ['film-theatre-lab', 'Film or theatre lab', 'Laboratoire de cinéma ou de théâtre'],
      ['research-school', 'Research school', 'École de recherche'],
      ['field-school', 'Field school', 'École de terrain'],
      ['study-tour', 'Study tour', 'Voyage d’études'],
      ['teacher-professional-development', 'Teacher professional development', 'Perfectionnement professionnel du personnel enseignant'],
      ['admissions-registration', 'Admissions or registration date', 'Date d’admission ou d’inscription'],
      ['open-house', 'Educational open house', 'Portes ouvertes en éducation'],
      ['orientation', 'Orientation', 'Orientation'],
      ['convocation', 'Convocation', 'Collation des grades'],
      ['academic-showcase', 'Academic showcase', 'Vitrine universitaire']
    ]),
    grades: axis('Grade or education level', 'Année ou niveau d’études', [
      ['k', 'Kindergarten', 'Maternelle'],
      ...Array.from({ length: 12 }, (_, index) => {
        const grade = index + 1;
        return [`g${grade}`, `Grade ${grade}`, `${grade}e année`];
      }),
      ['cegep', 'CEGEP', 'CÉGEP'],
      ['undergraduate', 'Undergraduate', 'Premier cycle'],
      ['graduate', 'Graduate', 'Cycles supérieurs'],
      ['educator', 'Educator', 'Personnel enseignant']
    ])
  }
});

function hasPublicValue(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function list(value) {
  if (Array.isArray(value)) return value.filter(hasPublicValue);
  return hasPublicValue(value) ? [value] : [];
}

function unique(values) {
  return [...new Set(values.filter(hasPublicValue))];
}

function latestTimestamp(values) {
  const valid = values
    .filter(hasPublicValue)
    .map(value => ({ value: String(value), time: Date.parse(String(value)) }))
    .filter(item => Number.isFinite(item.time))
    .sort((left, right) => left.time - right.time);
  return valid.length ? new Date(valid.at(-1).time).toISOString() : null;
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildFreshness(canonical, schemaVersion, content, builtAt) {
  const sourceChecks = canonical.events.map(event => event.last_checked_at);
  const contentTimes = canonical.events.flatMap(event => [
    event.last_checked_at,
    event.scraped_at,
    event.first_seen_at
  ]);
  const newestSourceCheck = latestTimestamp(sourceChecks);
  const contentUpdated = latestTimestamp(contentTimes);
  const resolvedBuiltAt = latestTimestamp([
    builtAt,
    canonical._generated_at,
    contentUpdated
  ]);
  return {
    built_at: resolvedBuiltAt,
    content_updated_at: contentUpdated,
    newest_source_check_at: newestSourceCheck,
    schema_version: schemaVersion,
    content_hash: sha256Json(content)
  };
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('und')
    .replace(/[\u2018\u2019']/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function slug(value) {
  return normalizeSearchText(value).replaceAll(' ', '-');
}

function safePublicUrl(value) {
  return typeof value === 'string' && value.startsWith('https://');
}

function contentLanguage(event) {
  const value = String(event.source_language || '').trim();
  if (!value || value === 'und') return undefined;
  return /^(?:mul|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/.test(value) ? value : undefined;
}

function publicDescription(event) {
  let value = String(event.description || '').trim();
  value = value.replace(
    /The entry treats lunar phase as a physical event while allowing documented calendars and rituals to link to it without collapsing those traditions into one meaning\./g,
    'Calendars and ritual traditions may refer to the same lunar phase while preserving their distinct meanings.'
  );
  value = value.replace(
    /; this corrects the earlier mistaken September 7 total-eclipse entry\./g,
    '.'
  );
  value = value.replace(
    /Eclipse entries distinguish physical visibility from the political, ritual, and mythic interpretations historically attached to eclipses\./g,
    'Historical political, ritual, and mythic interpretations remain distinct from the physical eclipse and its visibility.'
  );
  value = value.replace(
    /This is an ephemeris-defined astrology entry, not an astronomical claim about social causation; Polymythcal tracks how astrology narrativizes and coordinates uncertainty\./g,
    'This is an ephemeris-defined astrology date. It does not claim that the transit causes social events.'
  );
  value = value.replace(
    /Actual tropical geocentric station, replacing the earlier inaccurate fixed four-month recurrence\./g,
    'Actual tropical geocentric station.'
  );
  value = value.replace(
    /\s*The displayed date is a monitoring marker, not a confirmed deadline or event date\./g,
    ' The event or deadline date remains unconfirmed.'
  );
  value = value.replace(
    /\s*The displayed date is a monitoring marker, not a confirmed deadline\./g,
    ' The deadline remains unconfirmed.'
  );
  value = value.replace(
    /\s*Polymythcal separates the tradition's date rule and practices from its own socio-structural analysis\./g,
    ''
  );
  value = value.replace(
    /The astronomical solstice and the ritual complex remain linked but analytically distinct\./g,
    'The astronomical solstice and the ritual observances are related but not identical.'
  );
  value = value.replace(
    /^Projected source watch(?: and proposal deadline window)? for (?:the )?(.+?)\./,
    '$1 is a provisional listing; its date is not confirmed.'
  );
  value = value.replace(/\bConfirm (.+?) on the official (?:site|opportunities page)\./g, 'Check the official source for $1.');
  value = value.replace(
    /^Qualified monitoring (?:record|marker) for (.+?)\.$/,
    (_match, detail) => `${detail.charAt(0).toUpperCase()}${detail.slice(1)}. The date remains unconfirmed.`
  );
  return value.replace(/\s+/g, ' ').trim();
}

function normalizedList(values) {
  return unique(list(values).map(normalizeSearchText).filter(Boolean));
}

function isMonitoringMarker(event) {
  if (!event || event.date_precision !== 'estimated') return false;
  const evidence = `${event.description || ''} ${event.raw_excerpt || ''}`;
  return /\bmonitoring marker\b/i.test(evidence);
}

function publicationSurface(event) {
  return isMonitoringMarker(event)
    ? { surface: 'watchlist', reason: 'explicit-monitoring-marker' }
    : { surface: 'chronology', reason: 'dated-chronology-record' };
}

function sanitizeDate(value, timePrecision) {
  if (!hasPublicValue(value)) return undefined;
  const text = String(value).trim();
  if (CLOCK_PRECISIONS.has(String(timePrecision || ''))) return text;
  const date = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return date ? date[1] : text;
}

function temporalType(event, monitoring = false) {
  if (monitoring) return 'undated';
  const datePrecision = String(event.date_precision || '');
  const timePrecision = String(event.time_precision || '');
  if (event.record_kind === 'opportunity') return 'deadline';
  if (timePrecision === 'exact') {
    return ['celestial', 'astrology'].includes(slug(event.entry_family))
      ? 'global-instant'
      : 'local-date-time';
  }
  if (datePrecision === 'estimated' || datePrecision === 'month' || ['estimated', 'approximate'].includes(timePrecision)) {
    return 'estimated';
  }
  if (datePrecision === 'range' || (event.end_date && String(event.end_date).slice(0, 10) !== String(event.date).slice(0, 10))) {
    return 'date-range';
  }
  return 'all-day-local-date';
}

function projectTemporal(event, monitoring = false) {
  const type = temporalType(event, monitoring);
  if (type === 'undated') {
    return { type };
  }
  return compactObject({
    type,
    timezone: ['global-instant', 'local-date-time', 'deadline'].includes(type)
      || (type === 'date-range' && event.time_precision === 'exact')
      ? event.timezone
      : undefined
  });
}

function publicRoute(event) {
  return `/polymythseminars/events/${encodeURIComponent(event.id)}/`;
}

function sourceProjection(event) {
  const sources = [];
  if (safePublicUrl(event.source_url)) {
    sources.push(compactObject({
      kind: 'source',
      name: event.source_name || event.organizer,
      url: event.source_url,
      scope: 'listing',
      quality: event.source_quality
    }));
  }
  return sources;
}

function actionProjection(event) {
  const actions = [{
    kind: 'details',
    url: publicRoute(event),
    scope: 'listing'
  }];
  const emittedUrls = new Set([publicRoute(event)]);
  const destinationAvailable = safePublicUrl(event.destination_url)
    && event.destination_status !== 'unavailable-specific-page';
  const candidateScope = parentId(event) || event.series_role === 'parent' || event.destination_scope === 'series'
    ? 'series'
    : 'listing';
  for (const [field, kind] of PUBLIC_ACTION_CANDIDATE_FIELDS) {
    const url = event[field];
    if (!safePublicUrl(url) || emittedUrls.has(url)) continue;
    actions.push({ kind, url, scope: candidateScope });
    emittedUrls.add(url);
  }
  if (destinationAvailable && !emittedUrls.has(event.destination_url)) {
    actions.push(compactObject({
      kind: event.destination_kind || 'official-details',
      url: event.destination_url,
      scope: event.destination_scope || 'listing'
    }));
    emittedUrls.add(event.destination_url);
  }
  if (safePublicUrl(event.source_url) && !emittedUrls.has(event.source_url)) {
    actions.push({
      kind: 'source',
      url: event.source_url,
      scope: 'source'
    });
  }
  return actions;
}

function classifyKind(event) {
  return event.record_kind === 'opportunity' ? 'apply' : 'attend';
}

function opportunityWhat(event) {
  const structured = normalizeSearchText([
    event.opportunity_kind,
    event.prize_form,
    event.access_route,
    event.entry_family
  ].filter(Boolean).join(' '));
  if (/\b(fellowship|grant|scholarship|residency|bursary|funding)\b/.test(structured)) {
    return 'opportunity:funding';
  }
  if (/\b(call for papers|call for proposals|conference submission|conference proposal|abstract submission|paper proposal|cfp)\b/.test(structured)) {
    return 'opportunity:cfp';
  }
  if (/\b(contest|competition|prize|award)\b/.test(structured)) {
    return 'opportunity:competitions';
  }
  if (/\b(application|admission|registration|submission|program)\b/.test(structured)) {
    return 'opportunity:applications';
  }
  if (event.type === 'cfp') return 'opportunity:cfp';
  if (event.type === 'contest') return 'opportunity:competitions';
  if (['workshop', 'program'].includes(event.type)) return 'opportunity:applications';
  return 'opportunity:other';
}

function celestialKind(event) {
  const family = slug(event.entry_family);
  if (family === 'astrology') return 'planetary-event';
  if (family !== 'celestial') return '';
  const system = normalizeSearchText(`${event.celestial_system || ''} ${event.title || ''}`);
  if (/lunar phase|new moon|full moon/.test(system)) return 'moon-phase';
  if (/eclipse/.test(system)) return 'eclipse';
  if (/meteor shower/.test(system)) return 'meteor-shower';
  if (/seasonal solar cycle|solstice|equinox/.test(system)) return 'solstice-equinox';
  return '';
}

function eventWhat(event) {
  const family = slug(event.entry_family);
  const type = slug(event.type);
  if (['celestial', 'astrology'].includes(family)) return 'event:celestial-occurrence';
  if (family === 'ritual') {
    const declared = normalizeSearchText(list(event.topics).join(' '));
    return /\bseasonal\b/.test(declared)
      ? 'event:seasonal-observance'
      : 'event:ritual-observance';
  }
  if (event.record_kind === 'festival' || [
    'festival', 'festival-of-form', 'cultural-reproduction', 'virtual-festival',
    'platform-native-festival'
  ].includes(type)) return 'event:festivals';
  if (event.record_kind === 'exhibition' || [
    'exhibition', 'site-specific-art', 'virtual-exhibition'
  ].includes(type)) return 'event:exhibitions';
  if (family === 'civic-political-legal-labour' || event.record_kind === 'civic-action' || [
    'community', 'meeting', 'gathering'
  ].includes(type)) return 'event:community-civic';
  if ([
    'lecture', 'talk', 'panel', 'artist-talk', 'book-talk', 'book-launch',
    'scholar-talk', 'colloquium', 'symposium', 'forum', 'seminar', 'reading',
    'reading-group', 'discussion-group', 'online-discussion', 'virtual-discussion',
    'hybrid-discussion', 'virtual-artist-talk'
  ].includes(type)) return 'event:talks';
  if (['workshop', 'retreat'].includes(type)) return 'event:workshops';
  if ([
    'conference', 'defence', 'thesis-defence', 'webinar', 'virtual-conference',
    'virtual-conference-session'
  ].includes(type)) return 'event:conferences';
  if (['performance', 'concert', 'ceremony', 'celebration'].includes(type)) return 'event:performances';
  if (['screening', 'film-festival', 'online-premiere', 'watch-party'].includes(type)) return 'event:screenings';
  return 'event:other';
}

function classifyWhat(event) {
  return classifyKind(event) === 'apply' ? opportunityWhat(event) : eventWhat(event);
}

function classifyPlace(event) {
  const city = normalizeSearchText(event.city);
  const venue = normalizeSearchText(event.venue);
  const combined = `${city} ${venue}`;
  if (/\b(online|virtual|zoom|global)\b/.test(combined) || event.corridor_zone === 'online-global') return 'online';
  if (['toronto', 'mississauga', 'brampton', 'markham', 'vaughan', 'oakville', 'richmond hill'].some(value => city.includes(value))) return 'toronto-gta';
  if (['hamilton', 'burlington'].some(value => city.includes(value))) return 'hamilton';
  if (['guelph', 'waterloo', 'kitchener', 'cambridge'].some(value => city.includes(value))) return 'guelph-waterloo';
  if (city.includes('kingston')) return 'kingston';
  if (city.includes('gananoque')) return 'gananoque';
  if (['brockville', 'prescott'].some(value => city.includes(value))) return 'brockville';
  if (['cornwall', 'south stormont', 'south dundas'].some(value => city.includes(value))) return 'cornwall-sdg';
  if (['montreal', 'vaudreuil', 'dollard', 'pointe claire'].some(value => city.includes(value))) return 'montreal';
  return 'other';
}

function classifyFormat(event) {
  const declared = slug(event.event_format);
  if (['in-person', 'online', 'hybrid', 'pending'].includes(declared)) return declared;
  const participation = slug(event.participation_mode);
  if (['in-person', 'online', 'hybrid'].includes(participation)) return participation;
  const place = classifyPlace(event);
  const city = normalizeSearchText(event.city);
  const venue = normalizeSearchText(event.venue);
  const online = place === 'online' || /\b(online|virtual|zoom|webinar|livestream)\b/.test(`${city} ${venue}`);
  const inPerson = Boolean(city && !['unknown', 'online'].includes(city) && venue && !/\b(online|virtual|zoom)\b/.test(venue));
  if (online && inPerson) return 'hybrid';
  if (online) return 'online';
  if (inPerson) return 'in-person';
  return 'pending';
}

function classifyTopics(event) {
  const declared = normalizeSearchText([
    ...list(event.topics),
    ...list(event.subjects),
    ...list(event.academic_bands),
    event.entry_family
  ].filter(Boolean).join(' '));
  const values = [];
  const add = value => { if (!values.includes(value)) values.push(value); };
  if (/philosoph|ethic|metaphys|epistem|phenomenolog/.test(declared)) add('philosophy');
  if (/\b(?:write|writer|writers|writing|writings|written|literature|literary|poetry|poetic|poem|poems|author|authors|authorship|authorial|authored|authoring|book|books|playwright|playwrights|playwriting)\b/.test(declared)) add('writing');
  if (/histor|heritage|archaeolog|archive|museum|remembrance/.test(declared)) add('history');
  if (/\bfilm\b|cinema|screening|documentary/.test(declared)) add('film');
  if (/media literacy|journalism|news literacy|media studies|communication studies|student media/.test(declared)) add('media-literacy');
  if (/interdisciplin|multidisciplin|cross disciplin/.test(declared)) add('interdisciplinary');
  if (/academic event|public intellectual|thesis defence|colloquium|symposium|research showcase|public lecture/.test(declared)) add('academic-events');
  if (/\barts?\b|performance|music|theatre|theater|dance|exhibition/.test(declared) || list(event.arts_event_forms).length) add('arts');
  if (/civic|community|politic|government|council|legal|labour|public participation/.test(declared)) add('civic');
  if (/social studies|sociolog|anthropolog|economics|geography|international relations|law|indigenous studies/.test(declared)) add('social-studies');
  if (/science|technology|engineering|stem|physics|biology|environment|climate|health|coding/.test(declared)) add('science');
  const family = slug(event.entry_family);
  if (family === 'celestial' || /\bastronomy\b/.test(declared)) add('astronomy');
  if (family === 'astrology' || /\bastrology\b/.test(declared)) add('astrology');
  if (family === 'ritual' && /\bseasonal\b/.test(declared)) add('seasonal-observances');
  if (family === 'ritual' || /\britual\b|\bholiday\b/.test(declared)) add('ritual-observances');
  if (/education|learning|teaching|scholarship|student|university|graduate/.test(declared)) add('learning');
  if (!values.length) add('other');
  return values;
}

function classifyPresence(event) {
  const allowed = new Set(Object.keys(TAXONOMY.axes.presence.values));
  const values = [];
  for (const value of list(event.presence_categories)) {
    const normalized = slug(value);
    if (allowed.has(normalized)) values.push(normalized);
  }
  for (const claim of list(event.presence_claims)) {
    if (!claim || typeof claim !== 'object') continue;
    const status = slug(claim.status);
    const scope = slug(claim.scope);
    if (!['confirmed', 'confirmed-remote', 'identity-unannounced', 'programme-confirmed'].includes(status) || scope === 'production-credit') continue;
    const category = slug(claim.category);
    if (allowed.has(category)) values.push(category);
    if (status === 'identity-unannounced') values.push('identity-pending');
  }
  if ((event.talkback_confirmed === true || event.talkback_status === 'confirmed') && values.length === 0) values.push('identity-pending');
  return unique(values);
}

function classifyAcademicForms(event) {
  const declared = normalizeSearchText([
    ...list(event.academic_event_forms),
    ...list(event.public_intellectual_academic_formats)
  ].join(' '));
  const values = [];
  const add = value => { if (!values.includes(value)) values.push(value); };
  if (/lecture|scholar talk|public talk|keynote|online talk|lifelong learning lecture/.test(declared)) add('public-lecture');
  if (/panel|debate|forum|conversation|fireside chat|salon/.test(declared)) add('panel-debate-forum');
  if (/conference|symposium|academic intensive/.test(declared)) add('conference-symposium');
  if (/colloquium|seminar|graduate research talk/.test(declared)) add('colloquium-seminar');
  if (/workshop|webinar|information session/.test(declared)) add('workshop-webinar');
  if (/thesis defence|oral examination|doctoral defence|masters defence/.test(declared)) add('thesis-defence');
  if (/research showcase|poster session|research day|presentation/.test(declared)) add('research-showcase-poster');
  if (/reading group|philosophy cafe|discussion group/.test(declared)) add('reading-group-philosophy-cafe');
  if (/book talk|book launch|author talk/.test(declared)) add('book-talk-launch');
  return values;
}

function allowedDeclared(event, field, axisName, aliases = {}) {
  const allowed = new Set(Object.keys(TAXONOMY.axes[axisName].values));
  return unique(list(event[field]).map(value => aliases[slug(value)] || slug(value)).filter(value => allowed.has(value)));
}

function classifyGrades(event) {
  const values = [];
  for (const value of list(event.exact_grades)) {
    const normalized = normalizeSearchText(value);
    if (normalized === 'kindergarten') values.push('k');
    const match = normalized.match(/^grade (\d{1,2})$/);
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) values.push(`g${Number(match[1])}`);
  }
  const levels = normalizeSearchText(list(event.education_levels).join(' '));
  if (/\bcegep\b/.test(levels)) values.push('cegep');
  if (/\bundergraduate\b/.test(levels)) values.push('undergraduate');
  if (/\bgraduate\b|\bmasters\b|\bdoctoral\b|\bphd\b/.test(levels)) values.push('graduate');
  if (/\beducator\b|\bteacher\b/.test(levels)) values.push('educator');
  return unique(values);
}

function classifyAudiences(event) {
  const structured = normalizeSearchText([
    event.age_band,
    event.audience_scope,
    ...list(event.eligibility_audience),
    ...list(event.education_levels)
  ].filter(Boolean).join(' '));
  const values = [];
  if (/youth|child|children|kid|teen|grade|high school|secondary school/.test(structured)) values.push('youth');
  if (/university|graduate|undergraduate|postdoc|doctoral|phd|masters|cegep/.test(structured)) values.push('university');
  if (/teacher|educator|school staff/.test(structured)) values.push('educators');
  if (/family|families|all ages/.test(structured)) values.push('families');
  if (!values.length || /public|open to all|adult/.test(structured)) values.push('public');
  return unique(values);
}

function buildFacets(event) {
  const celestial = celestialKind(event);
  const facets = {
    kind: [classifyKind(event)],
    what: [classifyWhat(event)],
    places: [classifyPlace(event)],
    topics: classifyTopics(event),
    formats: [classifyFormat(event)],
    audiences: classifyAudiences(event),
    statuses: [event.confirmation_status === 'confirmed' ? 'confirmed' : 'pending'],
    presence: classifyPresence(event),
    academicForms: classifyAcademicForms(event),
    artsFormats: allowedDeclared(event, 'arts_event_forms', 'artsFormats'),
    participationFormats: allowedDeclared(event, 'participatory_formats', 'participationFormats'),
    civicFormats: allowedDeclared(event, 'civic_legal_labour_formats', 'civicFormats', {
      'union-education': 'union-conference'
    }),
    communityFormats: allowedDeclared(event, 'community_heritage_formats', 'communityFormats'),
    digitalFormats: allowedDeclared(event, 'live_digital_formats', 'digitalFormats'),
    programFormats: allowedDeclared(event, 'course_program_formats', 'programFormats'),
    grades: classifyGrades(event)
  };
  if (celestial) facets.celestialKinds = [celestial];
  for (const key of Object.keys(facets)) {
    facets[key] = unique(facets[key]);
    if (facets[key].length === 0) delete facets[key];
  }
  return facets;
}

function parentId(event) {
  return event.parent_id || event.set15_parent_id || '';
}

function buildSeriesIndex(events) {
  const byId = new Map(events.map(event => [event.id, event]));
  const children = new Map();
  for (const event of events) {
    const id = parentId(event);
    if (!id) continue;
    if (!byId.has(id)) throw new Error(`Series child ${event.id} references missing parent ${id}.`);
    if (!children.has(id)) children.set(id, []);
    children.get(id).push(event.id);
  }
  return { byId, children };
}

function projectSeries(event, seriesIndex) {
  const id = parentId(event);
  if (id) {
    const parent = seriesIndex.byId.get(id);
    return {
      id,
      role: 'occurrence',
      title: parent.series_title || parent.title,
      occurrence_count: (seriesIndex.children.get(id) || []).length
    };
  }
  const childIds = seriesIndex.children.get(event.id) || [];
  if (childIds.length || event.series_role === 'parent') {
    return {
      id: event.id,
      role: 'parent',
      title: event.series_title || event.title,
      occurrence_count: childIds.length
    };
  }
  return undefined;
}

function projectRelations(event, seriesIndex) {
  const parent = parentId(event);
  if (parent) {
    return {
      series_id: parent,
      role: 'occurrence',
      parent_id: parent,
      occurrence_count: (seriesIndex.children.get(parent) || []).length
    };
  }
  const childIds = seriesIndex.children.get(event.id) || [];
  if (childIds.length || event.series_role === 'parent') {
    return {
      series_id: event.id,
      role: 'parent',
      child_ids: childIds,
      occurrence_count: childIds.length
    };
  }
  return undefined;
}

function taxonomyLabels(axisName, values) {
  const axisDefinition = TAXONOMY.axes[axisName];
  if (!axisDefinition) return [];
  const labels = [];
  for (const value of values) {
    const definition = axisDefinition.values[value];
    if (!definition) continue;
    labels.push(definition.en, definition.fr);
  }
  return normalizedList(labels);
}

function curatedSearchAliases(event, facets) {
  const aliases = [];
  for (const axisName of ['kind', 'places', 'audiences', 'statuses']) {
    aliases.push(...taxonomyLabels(axisName, facets[axisName] || []));
  }
  if ((facets.what || []).includes('event:celestial-occurrence')) {
    aliases.push(
      'celestial event', 'celestial events',
      'événement céleste', 'événements célestes'
    );
  }
  if (celestialKind(event) !== 'moon-phase') return aliases;
  const title = normalizeSearchText(event.title);
  if (title.startsWith('full moon ')) aliases.push('pleine lune');
  if (title.startsWith('new moon ')) aliases.push('nouvelle lune');
  return aliases;
}

function buildSearchGroups(event, facets) {
  const topicLabels = taxonomyLabels('topics', facets.topics || []);
  const formatLabels = [];
  for (const axisName of [
    'what', 'celestialKinds', 'formats', 'academicForms', 'artsFormats',
    'participationFormats', 'civicFormats', 'communityFormats',
    'digitalFormats', 'programFormats'
  ]) {
    formatLabels.push(...taxonomyLabels(axisName, facets[axisName] || []));
  }
  return {
    title: normalizedList([event.title]),
    description: normalizedList([event.description]),
    aliases: normalizedList(curatedSearchAliases(event, facets)),
    people: normalizedList([event.speaker_or_director]),
    organizer: normalizedList([event.organizer, event.source_name]),
    place: normalizedList([event.venue, event.city, event.country]),
    topics: unique(topicLabels),
    format: unique(formatLabels)
  };
}

function persistedSearchGroups(search) {
  return Object.fromEntries(PERSISTED_SEARCH_GROUPS.map(group => [
    group,
    normalizedList(search?.[group])
  ]));
}

function deriveSearchGroups(eventOrSearch) {
  const event = eventOrSearch && eventOrSearch.search ? eventOrSearch : {};
  const stored = eventOrSearch && eventOrSearch.search ? eventOrSearch.search : eventOrSearch;
  return {
    title: normalizedList(list(stored?.title).length ? stored.title : [event.title]),
    description: normalizedList(list(stored?.description).length ? stored.description : [event.description]),
    aliases: normalizedList(stored?.aliases),
    people: normalizedList(list(stored?.people).length ? stored.people : [event.speaker_or_director]),
    organizer: normalizedList(list(stored?.organizer).length ? stored.organizer : [event.organizer, event.source_name]),
    place: normalizedList(list(stored?.place).length ? stored.place : [event.venue, event.city, event.country]),
    topics: normalizedList(stored?.topics),
    format: normalizedList(stored?.format)
  };
}

function compactObject(object) {
  const compact = {};
  for (const [key, value] of Object.entries(object)) {
    if (!hasPublicValue(value)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = compactObject(value);
      if (Object.keys(nested).length) compact[key] = nested;
    } else {
      compact[key] = value;
    }
  }
  return compact;
}

function taxonomyForAxes(axisNames) {
  return {
    version: TAXONOMY.version,
    axes: Object.fromEntries(axisNames
      .filter(axisName => TAXONOMY.axes[axisName])
      .map(axisName => [axisName, TAXONOMY.axes[axisName]]))
  };
}

function facetsForAxes(facets, axisNames) {
  return Object.fromEntries(axisNames
    .filter(axisName => Array.isArray(facets?.[axisName]) && facets[axisName].length)
    .map(axisName => [axisName, facets[axisName]]));
}

function baseProjection(event, seriesIndex) {
  const facets = facetsForAxes(buildFacets(event), COMMON_FACET_AXES);
  const projected = compactObject({
    id: event.id,
    title: event.title,
    description: publicDescription(event),
    speaker_or_director: event.speaker_or_director,
    organizer: event.organizer,
    venue: event.venue,
    city: event.city,
    country: event.country,
    type: event.type,
    record_kind: event.record_kind,
    confirmation_status: event.confirmation_status,
    lifecycle_status: event.lifecycle_status || 'active',
    writing_bands: event.writing_bands,
    academic_bands: event.academic_bands,
    checked_on: String(event.last_checked_at || '').slice(0, 10),
    content_language: contentLanguage(event),
    route: publicRoute(event),
    actions: actionProjection(event),
    relations: projectRelations(event, seriesIndex),
    facets
  });
  // Search groups are a stable public interface. Preserve empty arrays so the
  // client never has to infer whether a field was omitted or unavailable.
  projected.search = persistedSearchGroups(buildSearchGroups(event, facets));
  return projected;
}

function projectChronologyEvent(event, seriesIndex) {
  const base = baseProjection(event, seriesIndex);
  const projected = compactObject({
    ...base,
    date: sanitizeDate(event.date, event.time_precision),
    end_date: sanitizeDate(event.end_date, event.time_precision),
    date_precision: event.date_precision,
    time_precision: event.time_precision,
    temporal: projectTemporal(event)
  });
  projected.search = base.search;
  return projected;
}

function projectWatchlistEvent(event, seriesIndex) {
  const base = baseProjection(event, seriesIndex);
  const projected = compactObject({
    ...base,
    date_status: 'awaiting-confirmed-date',
    temporal: projectTemporal(event, true)
  });
  projected.search = base.search;
  return projected;
}

function projectResearchEvent(event, projected) {
  const allFacets = buildFacets(event);
  const researchFacets = facetsForAxes(allFacets, RESEARCH_FACET_AXES);
  const specialistAliases = RESEARCH_FACET_AXES.flatMap(axisName =>
    taxonomyLabels(axisName, researchFacets[axisName] || [])
  );
  const researchSearch = {
    ...projected.search,
    aliases: unique([
      ...normalizedList(projected.search?.aliases),
      ...normalizedList(specialistAliases)
    ])
  };
  const record = compactObject({
    id: event.id,
    title: event.title,
    route: projected.route,
    facets: researchFacets,
    relations: projected.relations,
    sources: sourceProjection(event),
    actions: projected.actions,
    search: researchSearch
  });
  record.search = researchSearch;
  return record;
}

function buildPublicationManifest(canonical, builtAt) {
  const chronologyIds = [];
  const watchlistIds = [];
  const reasons = {};
  for (const event of canonical.events) {
    const publication = publicationSurface(event);
    if (publication.surface === 'watchlist') {
      watchlistIds.push(event.id);
      reasons[event.id] = {
        code: 'monitoring-marker',
        detail: 'Displayed date is a monitoring marker, not a confirmed event or deadline date.'
      };
    } else {
      chronologyIds.push(event.id);
    }
  }
  const content = {
    chronology_ids: chronologyIds,
    watchlist_ids: watchlistIds,
    reasons
  };
  const freshness = buildFreshness(canonical, '2', content, builtAt);
  return {
    _schema: 'polymythcal-publication-surfaces-v2',
    schema: 'polymythcal-publication-surfaces-v2',
    _generated_at: freshness.built_at,
    freshness,
    canonical_count: canonical.events.length,
    chronology_count: chronologyIds.length,
    watchlist_count: watchlistIds.length,
    chronology_ids: chronologyIds,
    watchlist_ids: watchlistIds,
    reasons
  };
}

function validateCanonical(canonical) {
  if (!canonical || !Array.isArray(canonical.events)) {
    throw new Error('Canonical Polymythcal data must contain an events array.');
  }
  const ids = new Set();
  for (const event of canonical.events) {
    if (!event || typeof event.id !== 'string' || !event.id.trim()) {
      throw new Error('Every canonical Polymythcal record needs a non-empty string id.');
    }
    if (ids.has(event.id)) throw new Error(`Duplicate canonical Polymythcal id: ${event.id}`);
    if (typeof event.title !== 'string' || !event.title.trim()) throw new Error(`Polymythcal record ${event.id} has no title.`);
    ids.add(event.id);
  }
  return canonical.events;
}

function buildDiscoveryPayloads(canonical, options = {}) {
  const events = validateCanonical(canonical);
  const seriesIndex = buildSeriesIndex(events);
  const manifest = buildPublicationManifest(canonical, options.builtAt);
  const watchlistIds = new Set(manifest.watchlist_ids);
  const chronology = [];
  const watchlist = [];
  const researchRecords = [];
  for (const event of events) {
    if (watchlistIds.has(event.id)) {
      watchlist.push(projectWatchlistEvent(event, seriesIndex));
    } else {
      const projected = projectChronologyEvent(event, seriesIndex);
      chronology.push(projected);
      researchRecords.push(projectResearchEvent(event, projected));
    }
  }
  const commonTaxonomy = taxonomyForAxes(COMMON_FACET_AXES);
  const browseContent = { taxonomy: commonTaxonomy, events: chronology };
  const browseFreshness = buildFreshness(canonical, '2', browseContent, options.builtAt);
  const browse = {
    _schema: 'polymythcal-discovery-v2',
    _generated_at: browseFreshness.built_at,
    freshness: browseFreshness,
    _canonical_count: events.length,
    _chronology_count: chronology.length,
    count: chronology.length,
    taxonomy: commonTaxonomy,
    events: chronology
  };
  const watchlistContent = { taxonomy: commonTaxonomy, items: watchlist };
  const watchlistFreshness = buildFreshness(canonical, '2', watchlistContent, options.builtAt);
  const watchlistPayload = {
    _schema: 'polymythcal-watchlist-v2',
    _generated_at: watchlistFreshness.built_at,
    freshness: watchlistFreshness,
    _canonical_count: events.length,
    count: watchlist.length,
    taxonomy: commonTaxonomy,
    items: watchlist
  };
  const researchTaxonomy = taxonomyForAxes(RESEARCH_FACET_AXES);
  const researchContent = { taxonomy: researchTaxonomy, records: researchRecords };
  const researchFreshness = buildFreshness(canonical, '1', researchContent, options.builtAt);
  const research = {
    _schema: 'polymythcal-research-v1',
    _generated_at: researchFreshness.built_at,
    freshness: researchFreshness,
    _canonical_count: events.length,
    _chronology_count: chronology.length,
    count: researchRecords.length,
    taxonomy: researchTaxonomy,
    records: researchRecords
  };
  return { browse, watchlist: watchlistPayload, research, manifest };
}

function searchTokens(value) {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(/\s+/u) : [];
}

function fieldTokenMatch(value, token) {
  const words = value.split(/\s+/u).filter(Boolean);
  if (words.includes(token)) return { matched: true, kind: 'exact' };
  // Short astronomical names such as Mars must remain exact: allowing a
  // three-character prefix makes `mars` retrieve Marshall. Prefix discovery
  // begins only at five Unicode code points.
  const allowPrefix = [...token].length >= 5;
  if (allowPrefix && words.some(word => word.startsWith(token))) return { matched: true, kind: 'prefix' };
  return { matched: false, kind: '' };
}

function containsTokenSequence(value, phrase) {
  const words = searchTokens(value);
  const phraseWords = searchTokens(phrase);
  if (!phraseWords.length || phraseWords.length > words.length) return false;
  for (let offset = 0; offset <= words.length - phraseWords.length; offset += 1) {
    if (phraseWords.every((word, index) => words[offset + index] === word)) return true;
  }
  return false;
}

let facetLabelTargetsCache;
function exactFacetTargets(normalized) {
  if (!facetLabelTargetsCache) {
    facetLabelTargetsCache = new Map();
    for (const [axisName, axisDefinition] of Object.entries(TAXONOMY.axes)) {
      for (const [value, definition] of Object.entries(axisDefinition.values)) {
        for (const label of [definition.en, definition.fr]) {
          const key = normalizeSearchText(label);
          if (!facetLabelTargetsCache.has(key)) facetLabelTargetsCache.set(key, []);
          facetLabelTargetsCache.get(key).push({ axis: axisName, value });
        }
      }
    }
  }
  return facetLabelTargetsCache.get(normalized) || [];
}

function matchSearch(eventOrSearch, query) {
  const search = deriveSearchGroups(eventOrSearch);
  const normalized = normalizeSearchText(query);
  if (!normalized) return { matched: false, score: Number.POSITIVE_INFINITY, reasons: [] };
  const facetTargets = exactFacetTargets(normalized);
  if (facetTargets.length && eventOrSearch && ('facets' in eventOrSearch || 'id' in eventOrSearch)) {
    const target = facetTargets.find(({ axis, value }) =>
      list(eventOrSearch.facets?.[axis]).includes(value)
    );
    return target
      ? { matched: true, score: 1, reasons: [{ field: 'facet', kind: 'exact-label', ...target }] }
      : { matched: false, score: Number.POSITIVE_INFINITY, reasons: [] };
  }
  const tokens = searchTokens(normalized);
  const fieldWeights = {
    title: 0,
    aliases: 10,
    topics: 20,
    people: 30,
    organizer: 40,
    place: 50,
    format: 60,
    description: 70
  };
  const groups = SEARCH_GROUPS.map(field => [field, list(search?.[field])]);
  const titleValues = list(search?.title);
  if (titleValues.includes(normalized)) {
    return { matched: true, score: 0, reasons: [{ field: 'title', kind: 'exact', value: normalized }] };
  }
  const phraseFields = groups.filter(([, values]) => values.some(value => containsTokenSequence(value, normalized)));
  if (phraseFields.length) {
    const [field, values] = phraseFields.sort((a, b) => fieldWeights[a[0]] - fieldWeights[b[0]])[0];
    return {
      matched: true,
      score: fieldWeights[field] + 5,
      reasons: [{ field, kind: 'phrase', value: values.find(value => containsTokenSequence(value, normalized)) }]
    };
  }
  const reasons = [];
  let score = 0;
  for (const token of tokens) {
    const candidates = [];
    for (const [field, values] of groups) {
      for (const value of values) {
        const result = fieldTokenMatch(value, token);
        if (result.matched) candidates.push({ field, kind: result.kind, value });
      }
    }
    if (!candidates.length) return { matched: false, score: Number.POSITIVE_INFINITY, reasons: [] };
    candidates.sort((a, b) => fieldWeights[a.field] - fieldWeights[b.field] || (a.kind === 'exact' ? -1 : 1));
    const best = candidates[0];
    reasons.push({ ...best, token });
    score += fieldWeights[best.field] + (best.kind === 'prefix' ? 2 : 0);
  }
  return { matched: true, score: score + 10, reasons };
}

module.exports = {
  CLOCK_PRECISIONS,
  COMMON_FACET_AXES,
  EXPECTED_MONITORING_MARKER_COUNT,
  PERSISTED_SEARCH_GROUPS,
  PUBLIC_EVENT_KEYS,
  PUBLIC_ACTION_CANDIDATE_FIELDS,
  PUBLIC_RESEARCH_KEYS,
  PUBLIC_WATCHLIST_KEYS,
  RESEARCH_FACET_AXES,
  SEARCH_GROUPS,
  TAXONOMY,
  TEMPORAL_TYPES,
  baseProjection,
  buildDiscoveryPayloads,
  buildFacets,
  buildPublicationManifest,
  buildSearchGroups,
  buildSeriesIndex,
  celestialKind,
  classifyKind,
  classifyTopics,
  classifyWhat,
  deriveSearchGroups,
  hasPublicValue,
  isMonitoringMarker,
  matchSearch,
  normalizeSearchText,
  parentId,
  persistedSearchGroups,
  projectChronologyEvent,
  projectRelations,
  projectResearchEvent,
  projectSeries,
  projectTemporal,
  projectWatchlistEvent,
  publicDescription,
  sourceProjection,
  publicationSurface,
  sanitizeDate,
  searchTokens,
  temporalType,
  validateCanonical
};
