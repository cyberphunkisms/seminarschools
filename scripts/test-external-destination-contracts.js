#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  assertDestination,
  destinationLabel,
  polymythcalDestination,
  polymythCommonsDestination,
  resolvePolymythcalDestination,
  teacherResourceDestination,
} = require('./lib/external-destination-contracts');

const invalid = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'futureproofing', 'external-destinations', 'invalid-destinations.json'), 'utf8'));

const exact = resolvePolymythcalDestination({title:'Exact Lecture',source_url:'https://organizer.example/events/exact-lecture-2026',source_quality:'official'}, {groupEvents:[{title:'Exact Lecture'}]});
assert.equal(exact.status, 'official-event-page');
assert.equal(resolvePolymythcalDestination({title:'A Lecture',source_url:'https://organizer.example/events/',source_quality:'official'}, {groupEvents:[{title:'A Lecture'}]}).status, 'unavailable-specific-page');
assert.equal(resolvePolymythcalDestination({title:'A Lecture',source_url:'http://organizer.example/events/a-lecture',source_quality:'official'}, {groupEvents:[{title:'A Lecture'}]}).status, 'unavailable-specific-page');
assert.equal(resolvePolymythcalDestination({title:'Alpha Lecture',source_url:'https://organizer.example/events/alpha',source_quality:'official'}, {groupEvents:[{title:'Alpha Lecture'}]}).status, 'unavailable-specific-page');
assert.throws(() => resolvePolymythcalDestination({title:'Homepage Event',source_quality:'official'}, {override:{event_id:'homepage-event',destination_url:'https://organizer.example/',destination_scope:'event',destination_kind:'detail'}}), /dedicated event site/);
assert.equal(polymythcalDestination({id:'OK',destination_url:'https://organizer.example/events/exact-lecture-2026',destination_status:'official-event-page',destination_scope:'event',destination_kind:'detail',destination_evidence:'specific-source-url'}).status, 'official-event-page');
assert.equal(polymythCommonsDestination({ verified: 'yes', currentCanonicalUrl: 'https://current.example/', currentStatusGroup: 'ACTIVE', bookPrintedUrls: ['https://old.example/'] }).href, 'https://current.example/');
assert.equal(polymythCommonsDestination({ verified: '', currentCanonicalUrl: '', bookPrintedUrls: ['https://old.example/'] }).status, 'book-listed-site');
assert.equal(teacherResourceDestination({ url: '/unknown/' }, ['/approved/']).status, 'unavailable');
assert.equal(teacherResourceDestination({ url: '/approved/' }, ['/approved/']).status, 'seminar-schools-original');
assert.equal(resolvePolymythcalDestination(invalid.polymythcal, {groupEvents:[invalid.polymythcal]}).status, 'unavailable-specific-page');
assert.equal(teacherResourceDestination(invalid.teacher, []).status, 'unavailable');
assert.throws(() => assertDestination({ status: 'unavailable', href: 'https://bad.example/' }, 'fixture'), /must not have/);

// Structural route actions must outrank incidental words in an event title or
// slug. A publication named “Review” is not itself a peer-review action.
const submissionForReview = {
  id: 'blue-marble-review-contest',
  title: 'Blue Marble Review Emerging Writers Contest',
  source_url: 'https://bluemarblereview.example/opportunities/',
  submission_url: 'https://bluemarblereview.example/submit/blue-marble-review-emerging-writers-contest/',
  source_quality: 'official',
};
const submissionDestination = resolvePolymythcalDestination(submissionForReview, {groupEvents:[submissionForReview]});
assert.equal(
  submissionDestination.kind,
  'submission',
  'an explicit submission route must not be relabelled as review',
);
assert.equal(
  submissionDestination.evidence,
  'specific-action-url',
  'an explicit action URL must remain distinguishable from a reused raw source URL',
);
const reviewNamedContest = {
  id: 'harvard-international-review-contest',
  title: 'Harvard International Review Academic Writing Contest',
  source_url: 'https://hir.example/contest/harvard-international-review/',
  source_quality: 'official',
};
assert.equal(
  resolvePolymythcalDestination(reviewNamedContest, {groupEvents:[reviewNamedContest]}).kind,
  'detail',
  'a contest detail route must not become a review action from the publication name',
);
const reviewNamedSchedule = {
  id: 'toronto-design-review-panel-schedule',
  title: 'Toronto Design Review Panel — meeting schedule',
  source_url: 'https://planning.example/design-review-panel/meeting-schedule/',
  source_quality: 'official',
  recurrence_note: 'Monthly meetings',
};
assert.equal(
  resolvePolymythcalDestination(reviewNamedSchedule, {groupEvents:[reviewNamedSchedule]}).kind,
  'schedule',
  'a meeting-schedule route must not become a review action from the panel name',
);

// Compound directory labels remain broad organizer navigation, even when
// their words overlap an event title.
const compoundDirectory = {
  id: 'summer-event-programs',
  title: 'Summer Event Programs',
  source_url: 'https://city.example/parks-recreation-culture/summer-event-programs/',
  source_quality: 'official',
};
assert.equal(
  resolvePolymythcalDestination(compoundDirectory, {groupEvents:[compoundDirectory]}).status,
  'unavailable-specific-page',
  'a compound event/program directory must fail closed',
);

// Reviewed legacy, dead, redirected, and broad routes stay denied even when
// their path text overlaps the record title. Exact replacements are attached
// only through event-bound reviewed overrides.
for (const [title, source_url] of [
  ['ACCUTE Creative Writing Collective Graduate Student Contest 2027 watch', 'https://accute.ca/category/contest/'],
  ['Archaeological Institute of America grants and awards 2027 watch', 'https://www.archaeological.org/programs/professionals/grants-awards/'],
  ['APA 2028 Eastern Division submissions', 'https://www.apaonline.org/events/event_list.asp?DGPCrPg=1&DGPCrSrt=&group=110424&show='],
  ['Associated Collegiate Press Spring National College Media Conference 2027', 'https://studentpress.org/acp/conventions/'],
  ['NSPA/JEA Spring National High School Journalism Convention 2027', 'https://studentpress.org/nspa/conventions/'],
  ['Doors Open Toronto', 'https://www.toronto.ca/explore-enjoy/festivals-events/doorsopen/'],
  ['SSHRC Storytellers Challenge 2027 watch', 'https://www.sshrc-crsh.gc.ca/society-societe/storytellers-jai_une_histoire_a_raconter/index-eng.aspx'],
  ['NIAS fellowships, projected', 'https://nias.knaw.nl/fellowships/'],
  ['Folger Shakespeare Library fellowships, projected', 'https://www.folger.edu/research/fellowships/'],
  ['HASTAC opportunities', 'https://www.hastac.org/opportunities'],
  ['IWM fellowships', 'https://www.iwm.at/program/fellowships'],
  ['Society for Applied Philosophy annual conference CFP, projected', 'https://www.appliedphil.org/conference'],
  ['Warburg Institute fellowships, projected', 'https://warburg.sas.ac.uk/research/fellowships'],
]) {
  const record = {title, source_url, source_quality:'official'};
  assert.equal(
    resolvePolymythcalDestination(record, {groupEvents:[record]}).status,
    'unavailable-specific-page',
    `${source_url} must remain fail-closed without an event-bound exact override`,
  );
}

// A shared, specific family page is a series destination for both its parent
// and children. An unrelated shared URL is ambiguous and must be suppressed.
const seriesParent = {
  id: 'winter-light-festival',
  title: 'Winter Light Festival 2026',
  source_url: 'https://arts.example/festivals/winter-light-festival-2026/',
  source_quality: 'official',
  series_role: 'parent',
};
const seriesChild = {
  id: 'winter-light-festival-opening',
  title: 'Winter Light Festival — Opening Night',
  source_url: seriesParent.source_url,
  source_quality: 'official',
  series_role: 'child',
  parent_id: seriesParent.id,
};
const seriesFamily = [seriesParent, seriesChild];
assert.equal(resolvePolymythcalDestination(seriesParent, {groupEvents:seriesFamily}).scope, 'series');
assert.equal(resolvePolymythcalDestination(seriesChild, {groupEvents:seriesFamily}).scope, 'series');
const ambiguousSharedUrl = 'https://organizer.example/events/special-program/';
const ambiguousShared = [
  {id:'alpha-lecture',title:'Alpha Lecture',source_url:ambiguousSharedUrl,source_quality:'official'},
  {id:'beta-workshop',title:'Beta Workshop',source_url:ambiguousSharedUrl,source_quality:'official'},
];
for (const event of ambiguousShared) {
  assert.equal(
    resolvePolymythcalDestination(event, {groupEvents:ambiguousShared}).status,
    'unavailable-specific-page',
    'an unrelated shared URL must fail closed',
  );
}

// A child with its own specific page is an event destination, not a series
// page merely because the event title still names its parent festival.
const distinctChild = {
  id: 'winter-light-festival-opening-exact',
  title: 'Winter Light Festival — Opening Night',
  source_url: 'https://arts.example/events/winter-light-festival-opening-night-2026/',
  source_quality: 'official',
  series_role: 'child',
  parent_id: seriesParent.id,
};
const distinctChildDestination = resolvePolymythcalDestination(distinctChild, {groupEvents:[distinctChild]});
assert.equal(distinctChildDestination.status, 'official-event-page');
assert.equal(distinctChildDestination.scope, 'event');

// Calendar dates and years are not opaque event identifiers.
for (const datedUrl of [
  'https://organizer.example/events/2026/',
  'https://organizer.example/events/2026-08-15/',
  'https://organizer.example/events/?date=20260815',
]) {
  const datedArchive = {
    id: `date-only-${datedUrl}`,
    title: 'Annual Public Lecture',
    source_url: datedUrl,
    source_quality: 'official',
  };
  assert.equal(
    resolvePolymythcalDestination(datedArchive, {groupEvents:[datedArchive]}).status,
    'unavailable-specific-page',
    'a year/date archive route must not be treated as an opaque event ID',
  );
}
const routedOpaqueId = {
  id: 'routed-opaque-id',
  title: 'Philosophy of Achievement Graduate Conference',
  source_url: 'https://events.example/event/show/142433',
  source_quality: 'official',
};
assert.equal(
  resolvePolymythcalDestination(routedOpaqueId, {groupEvents:[routedOpaqueId]}).status,
  'official-event-page',
  'a recognized event route ending in a non-date opaque ID is an exact event page',
);

// A reviewed root URL is allowed only when explicitly attested as a dedicated
// event site; otherwise a generic homepage can never be promoted by override.
const homepageEvent = {id:'homepage-event',title:'Homepage Event',source_quality:'official'};
assert.throws(
  () => resolvePolymythcalDestination(homepageEvent, {override:{
    event_id: homepageEvent.id,
    destination_url: 'https://organizer.example/',
    destination_scope: 'event',
    destination_kind: 'detail',
  }}),
  /dedicated event site/,
);
const dedicatedRoot = resolvePolymythcalDestination(homepageEvent, {override:{
  event_id: homepageEvent.id,
  destination_url: 'https://dedicated-event.example/',
  destination_scope: 'event',
  destination_kind: 'detail',
  dedicated_event_site: true,
}});
assert.equal(dedicatedRoot.status, 'official-event-page');
assert.equal(dedicatedRoot.evidence, 'reviewed-dedicated-event-site');

// Materialized contracts must agree across status, scope, kind, and URL.
assert.throws(() => polymythcalDestination({
  id: 'scope-mismatch',
  destination_url: 'https://organizer.example/events/exact/',
  destination_status: 'official-event-page',
  destination_scope: 'series',
  destination_kind: 'detail',
  destination_evidence: 'specific-source-url',
}), /inconsistent available destination contract/);
assert.throws(() => polymythcalDestination({
  id: 'unavailable-with-url',
  destination_url: 'https://organizer.example/events/exact/',
  destination_status: 'unavailable-specific-page',
  destination_scope: 'unavailable',
  destination_kind: 'unavailable',
  destination_evidence: 'fail-closed',
}), /inconsistent unavailable destination contract/);

// Labels must tell teachers whether the action is official or merely the best
// exact source page, in both shipped languages.
const officialEvent = {status:'official-event-page',scope:'event',kind:'detail'};
const sourceEvent = {status:'source-event-page',scope:'event',kind:'detail'};
const officialSeries = {status:'official-series-page',scope:'series',kind:'detail'};
const sourceSeries = {status:'source-series-page',scope:'series',kind:'detail'};
assert.equal(destinationLabel(officialEvent, 'en'), 'Open official event page');
assert.equal(destinationLabel(officialEvent, 'fr'), 'Ouvrir la page officielle de l’événement');
assert.equal(destinationLabel(sourceEvent, 'en'), 'Open event source page');
assert.equal(destinationLabel(sourceEvent, 'fr'), 'Ouvrir la page source de l’événement');
assert.equal(destinationLabel(officialSeries, 'en'), 'Open official series page');
assert.equal(destinationLabel(officialSeries, 'fr'), 'Ouvrir la page officielle de la série');
assert.equal(destinationLabel(sourceSeries, 'en'), 'Open series source page');
assert.equal(destinationLabel(sourceSeries, 'fr'), 'Ouvrir la page source de la série');
console.log('EXTERNAL DESTINATION CONTRACT TESTS PASS — precedence, route semantics, shared-family scope, fail-closed materialization, and bilingual labels covered.');
