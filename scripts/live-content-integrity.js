'use strict';

const crypto = require('crypto');

const DEFAULT_THRESHOLDS = Object.freeze({
  minimumEvents: 800,
  minimumEventTypes: 25,
  minimumRegisteredSources: 400,
  minimumActiveSources: 390,
  minimumEveryRunDeterministicSources: 35,
  minimumRotatingDeterministicSources: 190,
  teacherResources: 644,
  teacherCollections: 25,
  teacherGroups: 7,
});

function list(document, key) {
  if (Array.isArray(document)) return document;
  return Array.isArray(document?.[key]) ? document[key] : [];
}

function countFieldFailures(label, document, actual, fields) {
  const failures = [];
  if (Array.isArray(document)) return failures;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(document || {}, field)) {
      const value = Number(document[field]);
      if (!Number.isInteger(value) || value !== actual) {
        failures.push(`${label}.${field} is ${document[field]}; expected ${actual}`);
      }
    }
  }
  return failures;
}

function activeHttpSource(source) {
  return source
    && source.enabled !== false
    && source.harvest_enabled !== false
    && source.source_mode !== 'manual'
    && String(source.render_mode || '').toLowerCase() !== 'manual'
    && /^https?:\/\//.test(String(source.events_url || ''));
}

function evaluateLiveContent({
  eventsDocument,
  browseDocument,
  sourceDocument,
  teacherDocument,
  thresholds = DEFAULT_THRESHOLDS,
}) {
  const limits = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const failures = [];
  const events = list(eventsDocument, 'events');
  const browse = list(browseDocument, 'events');
  const sources = list(sourceDocument, 'sources');
  const groups = Array.isArray(teacherDocument?.groups) ? teacherDocument.groups : [];
  const collections = groups.flatMap(group =>
    Array.isArray(group?.categories) ? group.categories : []
  );
  const teacherEntries = collections.flatMap(category =>
    Array.isArray(category?.entries) ? category.entries : []
  );

  if (events.length < limits.minimumEvents) {
    failures.push(
      `canonical event count collapsed to ${events.length}; floor is ${limits.minimumEvents}`,
    );
  }
  failures.push(
    ...countFieldFailures('events', eventsDocument, events.length, ['count', '_total_events']),
    ...countFieldFailures('browse', browseDocument, browse.length, ['count', '_canonical_count']),
  );
  if (browse.length !== events.length) {
    failures.push(`browse/canonical parity changed: ${browse.length}/${events.length}`);
  }

  const eventIds = events.map(event => String(event?.id || '').trim());
  const browseIds = browse.map(event => String(event?.id || '').trim());
  if (eventIds.some(id => !id)) failures.push('one or more canonical events have no ID');
  if (browseIds.some(id => !id)) failures.push('one or more browse records have no ID');
  if (new Set(eventIds).size !== eventIds.length) failures.push('canonical event IDs are not unique');
  if (new Set(browseIds).size !== browseIds.length) failures.push('browse event IDs are not unique');
  const canonicalSet = new Set(eventIds);
  const browseSet = new Set(browseIds);
  const missingFromBrowse = eventIds.filter(id => !browseSet.has(id));
  const unknownInBrowse = browseIds.filter(id => !canonicalSet.has(id));
  if (missingFromBrowse.length) {
    failures.push(`browse is missing ${missingFromBrowse.length} canonical event ID(s)`);
  }
  if (unknownInBrowse.length) {
    failures.push(`browse contains ${unknownInBrowse.length} non-canonical event ID(s)`);
  }

  const eventTypes = new Set(
    events.map(event => String(event?.type || '').trim()).filter(Boolean),
  );
  if (eventTypes.size < limits.minimumEventTypes) {
    failures.push(
      `event taxonomy collapsed to ${eventTypes.size} types; floor is ${limits.minimumEventTypes}`,
    );
  }
  if (events.some(event => !String(event?.title || '').trim())) {
    failures.push('one or more canonical events have no title');
  }
  if (events.some(event => !String(event?.date || '').trim())) {
    failures.push('one or more canonical events have no date');
  }

  if (sources.length < limits.minimumRegisteredSources) {
    failures.push(
      `source registry collapsed to ${sources.length}; floor is ${limits.minimumRegisteredSources}`,
    );
  }
  const sourceIds = sources.map(source => String(source?.id || '').trim());
  if (sourceIds.some(id => !id)) failures.push('one or more registered sources have no ID');
  if (new Set(sourceIds).size !== sourceIds.length) failures.push('registered source IDs are not unique');
  const activeSources = sources.filter(source => source?.enabled !== false);
  if (activeSources.length < limits.minimumActiveSources) {
    failures.push(
      `active source set collapsed to ${activeSources.length}; floor is ${limits.minimumActiveSources}`,
    );
  }
  const prioritySources = sources.filter(source =>
    activeHttpSource(source)
      && source.default_type !== 'protest'
      && Number(source.tier_priority || 99) === 1
  );
  if (prioritySources.length < limits.minimumEveryRunDeterministicSources) {
    failures.push(
      `every-run deterministic set collapsed to ${prioritySources.length}; floor is ${limits.minimumEveryRunDeterministicSources}`,
    );
  }
  const compatibleModes = new Set(['static', 'server-rendered', 'wordpress', 'drupal']);
  const rotatingSources = sources.filter(source =>
    activeHttpSource(source)
      && source.default_type !== 'protest'
      && Number(source.tier_priority || 99) !== 1
      && compatibleModes.has(String(source.render_mode || '').toLowerCase())
  );
  if (rotatingSources.length < limits.minimumRotatingDeterministicSources) {
    failures.push(
      `rotating deterministic set collapsed to ${rotatingSources.length}; floor is ${limits.minimumRotatingDeterministicSources}`,
    );
  }
  const shardCounts = [0, 0, 0, 0];
  for (const source of rotatingSources) {
    const digest = crypto.createHash('sha256').update(String(source.id)).digest();
    shardCounts[Number(digest.readBigUInt64BE(0) % 4n)] += 1;
  }
  if (shardCounts.some(count => count === 0)) {
    failures.push(`one or more rotating deterministic shards are empty: ${shardCounts.join(',')}`);
  }

  if (teacherEntries.length !== limits.teacherResources) {
    failures.push(
      `Teacher Resources changed: ${teacherEntries.length}/${limits.teacherResources}`,
    );
  }
  if (collections.length !== limits.teacherCollections) {
    failures.push(
      `Teacher collections changed: ${collections.length}/${limits.teacherCollections}`,
    );
  }
  if (groups.length !== limits.teacherGroups) {
    failures.push(`Teacher groups changed: ${groups.length}/${limits.teacherGroups}`);
  }

  return {
    failures,
    metrics: {
      events: events.length,
      browse: browse.length,
      eventTypes: eventTypes.size,
      registeredSources: sources.length,
      activeSources: activeSources.length,
      everyRunDeterministicSources: prioritySources.length,
      rotatingDeterministicSources: rotatingSources.length,
      rotatingShardCounts: shardCounts,
      teacherResources: teacherEntries.length,
      teacherCollections: collections.length,
      teacherGroups: groups.length,
    },
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  evaluateLiveContent,
};
