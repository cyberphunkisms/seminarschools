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

function polymythcalDestination(event) {
  const href = httpUrl(event && event.source_url);
  if (!href) return { status: 'unavailable', href: '', label: 'Source unavailable' };
  const official = new Set(['official', 'official-or-institutional', 'institutional']);
  return official.has(event.source_quality)
    ? { status: 'official-organizer', href, label: 'Open organizer website' }
    : { status: 'source-page', href, label: 'Open source website' };
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
  if (result.status === 'unavailable' && result.href) throw new Error(`${context}: unavailable destination must not have an href`);
  if (result.status !== 'unavailable' && !result.href) throw new Error(`${context}: available destination must have an href`);
  return result;
}

module.exports = {
  assertDestination,
  httpUrl,
  polymythcalDestination,
  polymythCommonsDestination,
  teacherResourceDestination,
};
