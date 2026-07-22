#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const ROUTES = {
  writingclub: 'club',
  writingkids: 'kids',
  writingjuniors: 'juniors',
  writingteens: 'teens',
  writinggrads: 'grads'
};
const TYPE_TO_CATEGORY = {
  lecture:'lecture', talk:'lecture', 'book-talk':'lecture', 'scholar-talk':'lecture', 'artist-talk':'lecture',
  conference:'conference', symposium:'conference', colloquium:'conference', forum:'conference',
  workshop:'workshop', webinar:'workshop', meeting:'workshop', retreat:'workshop',
  reading:'reading', 'book-launch':'reading', residency:'reading', festival:'festival', 'festival-of-form':'festival', 'cultural-reproduction':'festival',
  exhibition:'exhibition', 'site-specific-art':'exhibition', performance:'performance', screening:'screening', cfp:'cfp', contest:'contest',
  defence:'lecture', gathering:'gathering', memorial:'gathering', celebration:'gathering', networking:'gathering', panel:'lecture', community:'gathering', 'podcast-live':'lecture',
  protest:'protest', demonstration:'protest', march:'protest', rally:'protest', picket:'protest', vigil:'protest', 'sit-in':'protest', walkout:'protest'
};
const failures = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function fail(msg){ failures.push(msg); }
function categories(e){ return [e.type].concat(e.secondary_types || []).map(t => TYPE_TO_CATEGORY[t] || 'other').filter((c,i,a)=>a.indexOf(c)===i); }
function writingText(e){ return [e.title, e.type, (e.secondary_types || []).filter(t => String(t).toLowerCase().trim() !== 'grades 1-12 pathway').join(' '), e.speaker_or_director, e.venue, e.description, e.age_band, e.source_id].filter(Boolean).join(' ').toLowerCase(); }
function isYouthWritingContest(e){
  if (Array.isArray(e.writing_bands) && e.writing_bands.length) return true;
  const text = writingText(e);
  const cats = categories(e);
  const contestish = cats.includes('contest') || e.type === 'contest';
  const writingish = /writing|writer|essay|poetry|poem|story|stories|fiction|nonfiction|non-fiction|journalism|screenwriting|play|novel|humorous|literary|braille|authors|first page|creative/.test(text);
  const youthish = /youth|teen|student|students|child|kid|junior|minor|under ?1[0-9]|18 and under|grade|grades|k-?12|jk|kindergarten|secondary|high ?school|middle ?school|elementary|ages? ?\d{1,2}\s*(to|-|–)\s*1[0-9]/.test(text);
  const clearlyIneligible = /not eligible|must have reached the age of majority|adult,? 18 and over|18 and over only/.test(text);
  return contestish && writingish && youthish && !clearlyIneligible;
}
function writingBandMatches(e, band){
  if (band === 'club') return true;
  const explicit = Array.isArray(e.writing_bands) ? e.writing_bands.map(x => String(x).toLowerCase()) : [];
  if (explicit.length) return explicit.includes(band);
  return false;
}
function eventEligible(e){
  const start = new Date(e.date || '');
  const end = new Date(e.end_date || e.date || '');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < Date.now()) return false;
  const horizon = new Date(); horizon.setFullYear(horizon.getFullYear()+1);
  return start.getTime() <= horizon.getTime();
}
function staticCount(html){ return (html.match(/<article class="event"/g) || []).length; }
function main(){
  const events = JSON.parse(read('polymythseminars/events.json')).events || [];
  const youthWriting = events.filter(isYouthWritingContest);
  const current = youthWriting.filter(eventEligible);
  const sitemap = read('sitemap.xml');
  const redirects = read('_redirects');
  const root = read('polymythseminars/index.html');
  if (!root.includes('id="writingNav"') && !/data-preset=["']writing["']/.test(root)) fail('calendar root: missing visible Writing entry point');
  for (const [slug, band] of Object.entries(ROUTES)){
    const rel = `${slug}/index.html`;
    const html = read(rel);
    const expected = current.filter(e => writingBandMatches(e, band)).length;
    const actual = staticCount((html.match(/<!-- SS_STATIC_EVENTS_START -->([\s\S]*?)<!-- SS_STATIC_EVENTS_END -->/) || [,''])[1]);
    if (actual !== expected) fail(`${slug}: expected ${expected} static writing cards, found ${actual}`);
    if (!html.includes(`https://seminarschools.com/${slug}/`)) fail(`${slug}: missing route-specific canonical/schema URL`);
    if (!html.includes('id="writingNav"')) fail(`${slug}: missing visible Writing shortcut nav`);
    if (!html.includes(`data-writing="${band}"`)) fail(`${slug}: missing own writing band button`);
    if (!sitemap.includes(`${SITE}/${slug}/`)) fail(`${slug}: missing from sitemap`);
    if (!redirects.includes(`/${slug}`)) fail(`${slug}: missing slashless redirect`);
    if (/\d+ upcoming calendar entries/.test(html)) fail(`${slug}: unfiltered calendar SSR language leaked into writing shortcut page`);
  }
  const genericBandLeak = youthWriting.filter(e => (e.secondary_types || []).some(t => String(t).toLowerCase().trim() === 'grades 1-12 pathway'));
  if (genericBandLeak.length) fail(`generic grade-band phrase still present on ${genericBandLeak.length} writing entries`);
  const missingExplicit = youthWriting.filter(e => !Array.isArray(e.writing_bands) || !e.writing_bands.length);
  if (missingExplicit.length) fail(`youth writing entries without explicit writing_bands: ${missingExplicit.map(e=>e.title).join('; ')}`);
  if (failures.length){
    console.error('WRITING SHORTCUT CHECK FAILED');
    failures.forEach(x => console.error(' - ' + x));
    process.exit(1);
  }
  const counts = Object.fromEntries(Object.entries(ROUTES).map(([slug, band]) => [slug, current.filter(e => writingBandMatches(e, band)).length]));
  console.log(`WRITING SHORTCUT CHECK PASSED — ${current.length} current youth writing competitions; counts ${JSON.stringify(counts)}.`);
}
main();
