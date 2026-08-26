(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PolymythcalDiscoveryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SEARCH_FIELDS = Object.freeze([
    'title', 'aliases', 'description', 'people', 'organizer', 'place', 'topics', 'format'
  ]);

  const FIELD_ALIASES = Object.freeze({
    titre: 'title', person: 'people', people: 'people', personne: 'people', personnes: 'people',
    organizer: 'organizer', organisateur: 'organizer', organisme: 'organizer', org: 'organizer',
    lieu: 'place', topic: 'topics', topics: 'topics', sujet: 'topics', sujets: 'topics', forme: 'format'
  });

  function asArray(value) {
    if (Array.isArray(value)) return value.filter(item => item !== null && item !== undefined && String(item).trim());
    if (value === null || value === undefined || value === '') return [];
    return [value];
  }

  function flattenStrings(value, output = []) {
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) output.push(text);
    } else if (Array.isArray(value)) {
      for (const item of value) flattenStrings(item, output);
    } else if (value && typeof value === 'object') {
      for (const item of Object.values(value)) flattenStrings(item, output);
    }
    return output;
  }

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .toLocaleLowerCase('und')
      .replace(/\p{M}+/gu, '')
      .replace(/[’'`]/gu, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/gu, ' ');
  }

  function normalizedArray(value) {
    return [...new Set(flattenStrings(value).map(normalizeText).filter(Boolean))];
  }

  function uniqueStrings(...values) {
    return [...new Set(values.flatMap(value => flattenStrings(value)).filter(Boolean))];
  }

  function buildSearchFields(record) {
    const display = record && record.display && typeof record.display === 'object' ? record.display : (record || {});
    const persisted = record && record.search && typeof record.search === 'object' ? record.search : {};
    const facets = record && record.facets && typeof record.facets === 'object' ? record.facets : {};
    const source = {
      title: [display.title || record?.title, persisted.title],
      aliases: [persisted.aliases],
      description: [display.description || record?.description, persisted.description],
      people: [display.speaker_or_director || record?.speaker_or_director, persisted.people],
      organizer: [display.organizer || record?.organizer, persisted.organizer],
      place: [display.venue || record?.venue, display.city || record?.city, display.country || record?.country, persisted.place],
      topics: [persisted.topics, facets.topics, facets.what, facets.celestialKinds],
      format: [persisted.format, facets.formats, facets.academicForms, facets.artsFormats, facets.participationFormats, facets.civicFormats, facets.communityFormats, facets.digitalFormats, facets.programFormats]
    };
    const normalized = {};
    const visible = {};
    for (const field of SEARCH_FIELDS) {
      visible[field] = [...new Set(flattenStrings(source[field]).filter(Boolean))];
      normalized[field] = [...new Set([
        ...normalizedArray(source[field]),
        ...normalizedArray(persisted[field])
      ])];
    }
    return { search: normalized, display: visible };
  }

  function queryTerms(query) {
    const terms = [];
    const expression = /(?:(title|titre|description|people?|person|personnes?|organizer|organisateur|organisme|org|place|lieu|topics?|sujets?|format|forme):)?(?:"([^"\n]+)"|(\S+))/giu;
    let match;
    while ((match = expression.exec(String(query || '')))) {
      const value = normalizeText(match[2] || match[3]);
      const rawField = normalizeText(match[1]);
      const field = FIELD_ALIASES[rawField] || rawField || '';
      if (value) terms.push({ value, phrase: Boolean(match[2]), field });
    }
    return terms;
  }

  function queryIsInvalid(query, terms = queryTerms(query)) {
    return Boolean(String(query || '').trim()) && terms.length === 0;
  }

  function termMatchNormalized(normalized, term, labels) {
    if (!normalized || !term?.value) return null;
    if (term.phrase) {
      return ` ${normalized} `.includes(` ${term.value} `)
        ? { kind: labels?.phrase || 'phrase', value: term.value, score: 9 }
        : null;
    }
    const words = normalized.split(' ');
    if (words.includes(term.value)) return { kind: labels?.exact || 'exact wording', value: term.value, score: 8 };
    // Short forward prefixes were the source of Mars→Marshall collisions.
    // Four characters and fewer therefore require an exact word.
    if ([...term.value].length >= 5 && words.some(word => word.startsWith(term.value))) {
      return { kind: labels?.prefix || 'word prefix', value: term.value, score: 4 };
    }
    return null;
  }

  function termMatch(text, term, labels) {
    return termMatchNormalized(normalizeText(text), term, labels);
  }

  function searchMatch(eventOrSearch, queryOrTerms, options = {}) {
    const terms = Array.isArray(queryOrTerms) ? queryOrTerms : queryTerms(queryOrTerms);
    if (!terms.length) {
      return String(Array.isArray(queryOrTerms) ? '' : (queryOrTerms || '')).trim()
        ? { matched: false, score: 0, reason: null }
        : { matched: true, score: 0, reason: null };
    }
    const built = eventOrSearch?.search && eventOrSearch?._searchDisplay
      ? { search: eventOrSearch.search, display: eventOrSearch._searchDisplay }
      : buildSearchFields(eventOrSearch);
    const termMatches = [];
    for (const term of terms) {
      let best = null;
      for (const field of SEARCH_FIELDS) {
        if (term.field && term.field !== field) continue;
        const values = asArray(built.search[field]);
        for (let index = 0; index < values.length; index += 1) {
          // `buildSearchFields()` guarantees that every value in `search` is
          // normalized. Avoid repeating Unicode normalization for every
          // record, field, and keystroke in the production query loop.
          const found = termMatchNormalized(values[index], term, options.matchLabels);
          if (!found) continue;
          const fieldBoost = field === 'title' ? 4 : field === 'aliases' ? 3 : (field === 'people' || field === 'organizer' ? 2 : 0);
          const publicValue = asArray(built.display[field])[index] || asArray(built.display[field])[0] || values[index];
          const candidate = {
            ...found,
            field,
            source: publicValue.length > 120 ? `${publicValue.slice(0, 117).trim()}…` : publicValue,
            score: found.score + fieldBoost
          };
          if (!best || candidate.score > best.score) best = candidate;
        }
      }
      if (!best) return { matched: false, score: 0, reason: null };
      termMatches.push(best);
    }
    termMatches.sort((left, right) => right.score - left.score);
    const winner = termMatches[0];
    return {
      matched: true,
      score: termMatches.reduce((sum, item) => sum + item.score, 0),
      reason: {
        field: options.fieldLabels?.[winner.field] || winner.field,
        source: winner.source,
        kind: winner.kind
      }
    };
  }

  function editDistance(left, right) {
    const a = normalizeText(left);
    const b = normalizeText(right);
    if (!a || !b) return Math.max(a.length, b.length);
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const old = previous[j];
        previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = old;
      }
    }
    return previous[b.length];
  }

  function facetValues(record, axis) {
    const value = record?.facets?.[axis];
    return asArray(value).map(String);
  }

  function selectedValues(value) {
    return value instanceof Set ? [...value] : asArray(value).map(String);
  }

  function matchesFacets(record, selections, omittedAxis = '') {
    for (const [axis, selectedRaw] of Object.entries(selections || {})) {
      if (axis === omittedAxis) continue;
      const selected = selectedValues(selectedRaw);
      if (!selected.length) continue;
      const actual = facetValues(record, axis);
      if (!selected.some(value => actual.includes(value))) return false;
    }
    return true;
  }

  function facetCounts(records, selections, axis) {
    const counts = new Map();
    for (const record of records || []) {
      if (!matchesFacets(record, selections, axis)) continue;
      for (const value of new Set(facetValues(record, axis))) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return counts;
  }

  function dateNumber(record) {
    const raw = record?._start || record?.temporal?.start || record?.date;
    const value = raw instanceof Date ? raw.getTime() : Date.parse(raw || '');
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  }

  function compareRecords(left, right, sort = 'soonest', locale = 'en-CA') {
    if (sort === 'title') return String(left.title || '').localeCompare(String(right.title || ''), locale, { sensitivity: 'base' });
    if (sort === 'relevance') return Number(right._matchScore || 0) - Number(left._matchScore || 0) || dateNumber(left) - dateNumber(right) || String(left.title || '').localeCompare(String(right.title || ''), locale);
    if (sort === 'latest') return dateNumber(right) - dateNumber(left) || String(left.title || '').localeCompare(String(right.title || ''), locale);
    if (sort === 'checked') return String(right.checked_on || right.last_checked_at || right.freshness?.checked_at || '').localeCompare(String(left.checked_on || left.last_checked_at || left.freshness?.checked_at || '')) || String(left.title || '').localeCompare(String(right.title || ''), locale);
    return dateNumber(left) - dateNumber(right) || String(left.title || '').localeCompare(String(right.title || ''), locale);
  }

  function sortRecords(records, sort = 'soonest', locale = 'en-CA') {
    return [...(records || [])].sort((left, right) => compareRecords(left, right, sort, locale));
  }

  function normalizedRelation(record) {
    const relation = record?.relations || record?.series || {};
    const id = relation.series_id || relation.id || record?.series_id || record?.parent_id || '';
    const role = relation.role === 'occurrence' || relation.role === 'parent'
      ? relation.role
      : (record?.parent_id ? 'occurrence' : '');
    return { id: String(id || ''), role, title: String(relation.title || record?.series_title || ''), occurrence_count: Number(relation.occurrence_count || 0) };
  }

  function groupSeries(records, sort = 'soonest', locale = 'en-CA') {
    const groups = [];
    const bySeries = new Map();
    for (const record of records || []) {
      const relation = normalizedRelation(record);
      if (!relation.id) {
        groups.push({ type: 'event', key: `event:${record.id}`, event: record, events: [record] });
        continue;
      }
      if (!bySeries.has(relation.id)) {
        const group = { type: 'series', key: `series:${relation.id}`, seriesId: relation.id, parent: null, occurrences: [], events: [] };
        bySeries.set(relation.id, group);
        groups.push(group);
      }
      const group = bySeries.get(relation.id);
      const item = record.series ? record : { ...record, series: relation };
      group.events.push(item);
      if (relation.role === 'parent') group.parent = item;
      else group.occurrences.push(item);
    }
    for (const group of bySeries.values()) group.occurrences = sortRecords(group.occurrences, 'soonest', locale);
    return groups.sort((left, right) => compareRecords(
      left.event || left.occurrences[0] || left.parent,
      right.event || right.occurrences[0] || right.parent,
      sort,
      locale
    ));
  }

  function paginate(records, page = 1, pageSize = 24) {
    const total = (records || []).length;
    const size = Math.max(1, Number(pageSize) || 24);
    const pages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(pages, Math.max(1, Number(page) || 1));
    const start = (current - 1) * size;
    return { items: (records || []).slice(start, start + size), page: current, pages, total, start, end: Math.min(total, start + size) };
  }

  function mergeFieldMaps(primary, supplement) {
    const merged = {};
    for (const key of new Set([
      ...Object.keys(primary && typeof primary === 'object' ? primary : {}),
      ...Object.keys(supplement && typeof supplement === 'object' ? supplement : {})
    ])) {
      merged[key] = uniqueStrings(primary?.[key], supplement?.[key]);
    }
    return merged;
  }

  /**
   * Join the on-demand specialist projection to the chronology projection.
   * Only explicitly public Research fields are merged; title/route copies are
   * identity checks, not an alternate record source.
   */
  function mergeResearchProjection(discovery, research) {
    const additions = new Map((research?.records || []).map(record => [String(record?.id || ''), record]));
    const events = (discovery?.events || []).map(event => {
      const addition = additions.get(String(event?.id || ''));
      if (!addition) return event;
      return {
        ...event,
        facets: mergeFieldMaps(event.facets, addition.facets),
        search: mergeFieldMaps(event.search, addition.search),
        sources: [
          ...(Array.isArray(event.sources) ? event.sources : []),
          ...(Array.isArray(addition.sources) ? addition.sources : [])
        ]
      };
    });
    return {
      ...discovery,
      taxonomy: {
        ...(discovery?.taxonomy || {}),
        axes: {
          ...(discovery?.taxonomy?.axes || {}),
          ...(research?.taxonomy?.axes || {})
        }
      },
      events
    };
  }

  function validTimeZone(value) {
    const zone = String(value || '').trim();
    if (!zone) return false;
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(0));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function zonedCalendarDay(value, temporal = {}) {
    const raw = String(value || '').trim();
    const rawDay = /^(\d{4})-(\d{2})-(\d{2})(?=$|T)/.exec(raw);
    if (!rawDay) return '';
    const type = String(temporal?.type || '');
    const zone = String(temporal?.timezone || '').trim();
    const zonedType = ['global-instant', 'local-date-time', 'deadline'].includes(type);
    if (!raw.includes('T') || !zonedType || !validTimeZone(zone)) return `${rawDay[1]}-${rawDay[2]}-${rawDay[3]}`;
    const instant = new Date(raw);
    if (Number.isNaN(instant.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function temporalClock(value, temporal = {}, locale = 'en-CA') {
    const raw = String(value || '').trim();
    if (!raw.includes('T')) return null;
    const instant = new Date(raw);
    if (Number.isNaN(instant.getTime())) return null;
    const zone = String(temporal?.timezone || '').trim();
    if (validTimeZone(zone)) {
      return {
        text: new Intl.DateTimeFormat(locale, {
          hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short'
        }).format(instant),
        timeZone: zone
      };
    }
    const match = /T(\d{2}):(\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})$/.exec(raw);
    if (!match) return null;
    const clock = new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2])));
    const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(clock);
    const offset = match[3].toUpperCase();
    return {
      text: `${time} ${offset === 'Z' || offset === '+00:00' ? 'UTC' : `UTC${offset.replace('-', '−')}`}`,
      timeZone: offset
    };
  }

  function safeHttpUrl(value, base = 'https://seminarschools.com') {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim(), base);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (_error) {
      return '';
    }
  }

  return Object.freeze({
    SEARCH_FIELDS,
    normalizeText,
    buildSearchFields,
    queryTerms,
    queryIsInvalid,
    termMatch,
    searchMatch,
    editDistance,
    facetValues,
    matchesFacets,
    facetCounts,
    compareRecords,
    sortRecords,
    normalizedRelation,
    groupSeries,
    paginate,
    mergeResearchProjection,
    validTimeZone,
    zonedCalendarDay,
    temporalClock,
    safeHttpUrl
  });
});
