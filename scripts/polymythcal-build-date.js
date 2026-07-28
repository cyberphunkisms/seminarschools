#!/usr/bin/env node
'use strict';

const path = require('path');

const TORONTO_TIME_ZONE = 'America/Toronto';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value, label = 'site build date') {
  const text = String(value || '');
  if (!ISO_DATE_RE.test(text)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error(`${label} is not a real calendar date`);
  }
  return text;
}

function torontoDateFromTimestamp(value) {
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) {
    throw new Error('timestamp must be valid');
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment);
}

function currentTorontoDate(now = new Date()) {
  return torontoDateFromTimestamp(now);
}

function resolveSiteBuildDate({
  root = path.resolve(__dirname, '..'),
  override = process.env.SITE_BUILD_DATE,
} = {}) {
  // Keep `root` in the public API for callers written before Audit 46.
  void root;
  if (override) return assertIsoDate(override, 'SITE_BUILD_DATE');
  return currentTorontoDate();
}

function dateOneYearAfter(value) {
  const text = assertIsoDate(value);
  const [year, month, day] = text.split('-').map(Number);
  return new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10);
}

module.exports = {
  TORONTO_TIME_ZONE,
  assertIsoDate,
  currentTorontoDate,
  dateOneYearAfter,
  resolveSiteBuildDate,
  torontoDateFromTimestamp,
};
