#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const crypto=require('crypto');const {execFileSync}=require('child_process');
const {currentTorontoDate,dateOneYearAfter,resolveSiteBuildDate,torontoDateFromTimestamp}=require('./polymythcal-build-date');
const ROOT=path.resolve(__dirname,'..');const failures=[];const warnings=[];
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');const exists=r=>fs.existsSync(path.join(ROOT,r));const fail=m=>failures.push(m);const warn=m=>warnings.push(m);
const bytesEqual=(a,b)=>fs.readFileSync(path.join(ROOT,a)).compare(fs.readFileSync(path.join(ROOT,b)))===0;
const sha=r=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,r))).digest('hex');
const releaseId=read('RELEASE_ID.txt').trim();const release=JSON.parse(read('RELEASE_MANIFEST.json'));const manifest=JSON.parse(read('data/polymythcal-build-manifest.json'));
if(torontoDateFromTimestamp('2026-07-24T03:59:59Z')!=='2026-07-23'||torontoDateFromTimestamp('2026-07-24T04:00:00Z')!=='2026-07-24')fail('shared Toronto build clock fails the UTC-midnight boundary regression');
if(resolveSiteBuildDate({root:ROOT,override:null})!==currentTorontoDate())fail('shared site build date is not current in Toronto');
if(resolveSiteBuildDate({root:ROOT,override:'2026-02-03'})!=='2026-02-03')fail('SITE_BUILD_DATE override is not deterministic');
if(dateOneYearAfter('2024-02-29')!=='2025-03-01')fail('shared one-year horizon no longer matches the established calendar-year rollover');
const buildManifestSource=read('scripts/update-polymythcal-build-manifest.js');if(!buildManifestSource.includes("require('./polymythcal-build-date')")||/\bnew Date\(\)/.test(buildManifestSource))fail('Polymythcal build manifest derives its horizon from wall clock time');
const assetVersion=String(release.polymythcal_asset_version||'');if(!/^[0-9]{8}-[a-z0-9-]+$/.test(assetVersion))fail('release manifest lacks a valid Polymythcal asset version');
if(release.release_id!==releaseId)fail('RELEASE_ID.txt and RELEASE_MANIFEST.json disagree');
if(manifest.release_id!==releaseId||manifest.interface_release!==releaseId||manifest.polymythcal_asset_version!==assetVersion)fail('Polymythcal build manifest release or asset version is stale');
const calendar='polymythseminars/index.html';const html=read(calendar);const calendarBytes=fs.statSync(path.join(ROOT,calendar)).size;
if(!html.includes('id="pmEventList"')||!html.includes('/js/polymythcal-revamp.js'))fail('calendar client-shell mount or application asset is missing');
if(!html.includes(`content="${assetVersion}" name="ss-build"`)&&!html.includes(`name="ss-build" content="${assetVersion}"`))fail('calendar build stamp does not match the release manifest');
if(html.includes('id="eventsContainer"')||html.includes('id="events-fallback"'))fail('main calendar regressed to a legacy embedded corpus');
if(calendarBytes>=100000)fail(`calendar shell exceeds 100 KB: ${calendarBytes}`);
const app=read('js/polymythcal-revamp.js');if(!app.includes('function routeMatches(event)'))fail('dedicated route restriction is missing from the shared calendar application');
if(!/cache:\s*["']default["']/.test(app)||/cache:\s*["']no-cache["']/.test(app))fail('event JSON fetch does not use bounded HTTP-cache reuse');
const routes=['writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
for(const slug of routes){const rel=`${slug}/index.html`;if(!exists(rel)){fail(`${rel} missing`);continue;}const page=read(rel);const canonical=page.match(/<link href="([^"]+)" rel="canonical"/i)?.[1]||page.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];if(canonical!==`https://seminarschools.com/${slug}/`)fail(`${slug} canonical mismatch: ${canonical||'missing'}`);if(!page.includes(`data-pm-route="${slug}"`)||!page.includes('id="pmEventList"'))fail(`${slug} does not use the unified interactive route shell`);if(!page.includes(`content="${assetVersion}"`)||!page.includes(`/css/polymythcal-revamp.css?v=${assetVersion}`)||!page.includes(`/js/polymythcal-revamp.js?v=${assetVersion}`))fail(`${slug} does not use the manifest-owned Polymythcal asset version`);if(page.includes('id="eventsContainer"')||page.includes('id="events-fallback"')||page.includes('quickFocusNav'))fail(`${slug} still contains legacy calendar controls`);if(exists(`public/${rel}`)&&!bytesEqual(rel,`public/${rel}`))fail(`${slug} source/public mirror mismatch`);}
const payload=JSON.parse(read('polymythseminars/events.json'));const events=payload.events||[];
if(!events.length)fail('canonical event corpus is empty');if(payload.count!==events.length||payload._total_events!==events.length)fail('event payload counts do not match events array');
for(const slug of ['polymythseminars',...routes]){const rel=`${slug}/index.html`;if(exists(rel)&&!new RegExp(`<dt\\b[^>]*\\bid=["']pmListingCount["'][^>]*>${events.length}<\\/dt>`,'i').test(read(rel)))fail(`${slug} no-JavaScript listing count is stale`);}
const grade4Manual=(JSON.parse(read('data/manual-events.json')).events||[]).filter(event=>event._src==='manual-grade4-contest-review-2026-08-11');const eventsById=new Map(events.map(event=>[String(event.id||''),event]));for(const source of grade4Manual){const canonical=eventsById.get(String(source.id||''));if(!canonical){fail(`Grade 4 manual record ${source.id||source.title} is missing`);continue;}for(const field of ['city','province','country','timezone','eligibility_region']){if(source[field]!==undefined&&canonical[field]!==source[field])fail(`Grade 4 manual record ${source.id} changed ${field}: ${JSON.stringify(source[field])} became ${JSON.stringify(canonical[field])}`);}}
if(!bytesEqual('polymythseminars/events.json','data/polymyth-seminar-events.json'))fail('canonical/public source event JSON mismatch');
if(!exists('public/polymythseminars/events.json')||!bytesEqual('polymythseminars/events.json','public/polymythseminars/events.json'))fail('generated public event JSON mismatch');
if(manifest.record_count!==events.length)fail(`build manifest count ${manifest.record_count} does not match ${events.length}`);if(manifest.canonical_data_sha256!==sha('data/polymyth-seminar-events.json'))fail('build manifest canonical data hash is stale');
const siteBuildDate=resolveSiteBuildDate({root:ROOT});const siteHorizon=dateOneYearAfter(siteBuildDate);const expectedCurrentCount=events.filter(event=>String(event.end_date||event.date||'').slice(0,10)>=siteBuildDate&&String(event.date||'').slice(0,10)<=siteHorizon).length;if(manifest.current_record_count_next_12_months!==expectedCurrentCount)fail(`build manifest current count ${manifest.current_record_count_next_12_months} is stale (${expectedCurrentCount} expected for ${siteBuildDate})`);
const scrape=JSON.parse(read('data/scrape-log.json'));if(Number(scrape.canonical_event_count)!==events.length||Number(scrape.public_event_count)!==events.length)fail('scrape summary event counts are stale');
const missingPages=events.filter(e=>!exists(`polymythseminars/events/${e.id}/index.html`));if(missingPages.length)fail(`${missingPages.length} stable event pages are missing`);
const staleEventPages=events.filter(e=>{const rel=`polymythseminars/events/${e.id}/index.html`;if(!exists(rel))return false;const page=read(rel);return !page.includes(`content="${assetVersion}"`)||!page.includes(`/css/polymythcal-features.css?v=${assetVersion}`)||!page.includes(`/js/polymythcal-features.js?v=${assetVersion}`);});if(staleEventPages.length)fail(`${staleEventPages.length} event pages do not use the manifest-owned Polymythcal asset version`);
const missingIcs=events.filter(e=>!exists(`polymythseminars/ics/${e.id}.ics`));if(missingIcs.length)fail(`${missingIcs.length} event ICS files are missing`);
const legacySlug=value=>String(value||'event').toLowerCase().replace('&',' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,76)||'event';
const legacyAlias=value=>`${legacySlug(value)}-${crypto.createHash('sha1').update(String(value)).digest('hex').slice(0,8)}`;
const canonicalIds=new Set(events.map(e=>String(e.id||e.identity_key)));const expectedAliases=new Map();
function registerAlias(alias,target){if(alias===target)return;if(canonicalIds.has(alias)){fail(`legacy alias ${alias} collides with a canonical event id`);return;}if(expectedAliases.has(alias)&&expectedAliases.get(alias)!==target){fail(`legacy alias ${alias} maps to multiple canonical events`);return;}expectedAliases.set(alias,target);}
for(const event of events){const target=String(event.id||event.identity_key);registerAlias(legacyAlias(target),target);for(const value of event.legacy_ids||[]){const legacyId=String(value);registerAlias(legacyId,target);registerAlias(legacyAlias(legacyId),target);}}
for(const [alias,target] of expectedAliases){const rel=`polymythseminars/events/${alias}/index.html`;const publicRel=`public/${rel}`;if(!exists(rel)){fail(`legacy event alias ${alias} is missing`);continue;}const aliasHtml=read(rel);if(!/noindex,follow/i.test(aliasHtml)||!aliasHtml.includes(`/polymythseminars/events/${target}/`))fail(`legacy event alias ${alias} does not target ${target}`);if(!exists(publicRel)||!bytesEqual(rel,publicRel))fail(`legacy event alias ${alias} public mirror is missing or stale`);}
const actualAliasDirs=fs.readdirSync(path.join(ROOT,'polymythseminars/events'),{withFileTypes:true}).filter(entry=>entry.isDirectory()&&!canonicalIds.has(entry.name)).map(entry=>entry.name);if(actualAliasDirs.length!==expectedAliases.size)fail(`event alias directory count ${actualAliasDirs.length} does not match expected ${expectedAliases.size}`);
const sync=read('scripts/sync-calendar-data.js');if(!sync.includes('client-shell event mount')||sync.includes("throw new Error('events-fallback injection point is missing')"))fail('calendar sync still assumes legacy fallback markers');
const about=read('about/index.html');if(!about.includes(`/polymythseminars/featured.json?v=${assetVersion}`))fail('About compact feed URL does not use the manifest-owned Polymythcal asset version');const subscribe=read('polymythseminars/subscribe/index.html');if(!subscribe.includes(`/css/polymythcal-features.css?v=${assetVersion}`)||!subscribe.includes(`/js/polymythcal-features.js?v=${assetVersion}`))fail('subscription page does not use the manifest-owned Polymythcal asset version');
for(const rel of ['scripts/build-polymythcal-audit13.py','scripts/build-polymythcal-feeds.py','scripts/verify-critical.js','scripts/verify-steady-ui.js']){const source=read(rel);if(!source.includes('polymythcal_asset_version'))fail(`${rel} does not derive the Polymythcal asset version from the release manifest`);const withoutFrozenAudit43=source.replaceAll('20260725-audit43','');if(/[0-9]{8}-audit[0-9]+/i.test(withoutFrozenAudit43))fail(`${rel} hard-codes a mutable audit asset token`);}
const siteRelease=JSON.parse(read('public/site-release.json'));if(siteRelease.release_id!==releaseId||siteRelease.generated_at!==release.generated_at)fail('generated site release marker is stale or non-deterministic');
const pkg=JSON.parse(read('package.json'));
const requiredBuildSteps=[
  "node scripts/run-python.js scripts/assert-build-lock.py",
  "node scripts/run-python.js scripts/import-polymythcal-comprehensive-2026-08-13.py",
  "node scripts/run-python.js scripts/import-polymythcal-social-studies-set4-2026-08-13.py",
  "node scripts/run-python.js scripts/import-polymythcal-media-literacy-set5-2026-08-13.py",
  "node scripts/run-python.js scripts/import-polymythcal-interdisciplinary-set6-2026-08-13.py",
  "node scripts/run-python.js scripts/import-polymythcal-director-present-set7-2026-08-13.py",
  "node scripts/run-python.js scripts/import-polymythcal-creator-present-set8-2026-08-13.py",
  "node scripts/run-python.js scripts/import-polymythcal-public-intellectual-academic-set9-2026-08-13.py",
  "node scripts/run-python.js scripts/import-polymythcal-participatory-cultural-set11-2026-08-14.py",
  "node scripts/run-python.js scripts/import-polymythcal-civic-political-legal-labour-set12-2026-08-14.py",
  "node scripts/run-python.js scripts/normalize-polymythcal-manual-identities.py",
  "node scripts/run-python.js scripts/normalize-polymythcal-evidence-model.py",
  "node scripts/run-python.js scripts/import-polymythcal-community-charity-mutual-aid-heritage-place-set13-2026-08-15.py",
  "node scripts/run-python.js scripts/import-polymythcal-live-media-digitally-native-set14-2026-08-15.py",
  "node scripts/run-python.js scripts/import-polymythcal-courses-multi-session-programs-set15-2026-08-15.py",
  "node scripts/run-python.js scripts/import-polymythcal-arts-set10-reconstruction-2026-08-14.py",
  "node scripts/upsert-manual-calendar-events.js",
  "node scripts/apply-polymythcal-destination-specificity.js",
  "node scripts/run-python.js scripts/validate-polymythcal.py",
  "node scripts/run-python.js scripts/apply-audit45-language-model.py",
  "node scripts/run-python.js scripts/build-polymythcal-audit13.py",
  "node scripts/update-polymythcal-listing-counts.js",
  "node scripts/build-search-pages.js",
  "node scripts/apply-polymythcal-set13-15-facets.js",
  "node scripts/build-writing-shortcuts.js",
  "node scripts/build-academic-shortcuts.js",
  "node scripts/run-python.js scripts/build-polymythcal-feeds.py",
  "node scripts/apply-visible-geometry.js",
  "node scripts/apply-sitewide-type-zoom-link.js",
  "node scripts/apply-type-floor.js",
  "node scripts/consolidate-google-fonts.js",
  "node scripts/build-polymythcal-browser-payload.js",
  "node scripts/run-python.js scripts/build-polymythcal-candidate-surface.py",
  "node scripts/apply-audit48-approved-ui.js",
  "node scripts/normalize-shared-asset-references.js",
  "node scripts/build-leizu-i18n-source.js",
  "node scripts/build-polymythcal-i18n-source.js",
  "node scripts/apply-audit49-release-stamp.js",
  "node scripts/run-python.js scripts/build-saul-ultimate-web-cv.py",
  "node scripts/verify-saul-ultimate-web-cv.js",
  "node scripts/run-python.js scripts/build-audit45-localized-routes.py",
  "node scripts/apply-audit45-translation-ui.js",
  "node scripts/apply-audit49-metadata-hygiene.js",
  "node scripts/run-python.js scripts/build-saul-ultimate-web-cv.py",
  "node scripts/verify-saul-ultimate-web-cv.js",
  "node scripts/run-python.js scripts/build-audit45-localized-routes.py",
  "node scripts/apply-audit45-translation-ui.js",
  "node scripts/apply-audit49-metadata-hygiene.js",
  "node scripts/update-polymythcal-destination-contract.js",
  "node scripts/apply-sitewide-type-zoom-link.js",
  "node scripts/apply-visible-geometry.js",
  "node scripts/update-release-asset-identity.js",
  "node scripts/update-polymythcal-build-manifest.js",
  "node scripts/build-public-deploy.js",
  "node scripts/verify-public-deploy-parity.js",
  "node scripts/verify-release-asset-identity.js",
  "node scripts/verify-polymythcal-comprehensive-2026-08-13.js",
  "node scripts/verify-polymythcal-social-studies-set4-2026-08-13.js",
  "node scripts/verify-polymythcal-media-literacy-set5-2026-08-13.js",
  "node scripts/verify-polymythcal-interdisciplinary-set6-2026-08-13.js",
  "node scripts/verify-polymythcal-director-present-set7-2026-08-13.js",
  "node scripts/verify-polymythcal-creator-present-set8-2026-08-13.js",
  "node scripts/verify-polymythcal-public-intellectual-academic-set9-2026-08-13.js",
  "node scripts/verify-polymythcal-arts-set10-reconstruction-2026-08-14.js",
  "node scripts/verify-polymythcal-participatory-cultural-set11-2026-08-14.js",
  "node scripts/verify-polymythcal-civic-political-legal-labour-set12-2026-08-14.js",
  "node scripts/verify-polymythcal-community-charity-mutual-aid-heritage-place-set13-2026-08-15.js",
  "node scripts/verify-polymythcal-live-media-digitally-native-set14-2026-08-15.js",
  "node scripts/verify-polymythcal-courses-multi-session-programs-set15-2026-08-15.js",
  "node scripts/verify-polymythcal-set-field-propagation.js",
  "node scripts/verify-polymythcal-sets13-15-browser.js --dom-only",
  "node scripts/verify-front-facing-boundary.js",
  "node scripts/verify-polymyth-entry-points.js --site-only",
  "node scripts/verify-visible-geometry.js",
  "node scripts/verify-meaningful-geometry.js",
  "node scripts/verify-geometry.js",
  "node scripts/build-asset-weight-report.js",
  "node scripts/verify-polymythcal-featured.js",
  "node scripts/verify-polymythcal-browser-payload.js",
  "node scripts/verify-polymythcal-destination-specificity.js",
  "node scripts/verify-polymythcal-build-efficiency.js",
  "node scripts/verify-steady-ui.js",
  "node scripts/run-python.js scripts/verify-audit45-translations.py",
  "node scripts/verify-audit49-metadata-surface.js",
  "node scripts/verify-audit49-runtime-efficiency.js",
  "node scripts/verify-audit49-build-packaging-efficiency.js"
];
const expectedBuildEntrypoint='node scripts/assert-canonical-build-delegation.js "node scripts/run-python.js scripts/build-polymythcal-audit13.py" "node scripts/build-search-pages.js" && node scripts/run-python.js scripts/run-with-build-lock.py -- npm run build:locked';
if(pkg.scripts?.build!==expectedBuildEntrypoint)fail('production build is not routed through the single-writer lock with audited delegation');
if(!exists('scripts/assert-canonical-build-delegation.js'))fail('canonical build delegation assertion is missing');
if(pkg.scripts?.['build:locked']!==requiredBuildSteps.join(' && '))fail('production build command drifted from the audited canonical command');
const netlify=read('netlify.toml');const requiredNetlifyBuild='python3 -m pip install --disable-pip-version-check --no-input --require-hashes --requirement requirements-audit.lock && npm run build';if(!netlify.includes(`command = "${requiredNetlifyBuild}"`)||!/publish\s*=\s*"public"/.test(netlify))fail('Netlify locked-Python build/publish contract is wrong');if(!netlify.includes('node ./scripts/netlify-ignore-build.js'))fail('Netlify ignore logic is not routed through the tested script');
const forbidden=[new RegExp(['Ki','ra spousal-sponsorship'].join(''),'i'),new RegExp(['Ky','ra.?s 75% commission'].join(''),'i'),new RegExp(['Ki','ra UI review'].join(''),'i')];const roots=['polymyth','hf_export','data','js','scripts'];const exts=new Set(['.html','.txt','.md','.json','.jsonl','.js','.css','.csv','.py','.bat']);
function walk(rel){if(!exists(rel))return;for(const ent of fs.readdirSync(path.join(ROOT,rel),{withFileTypes:true})){const child=path.join(rel,ent.name);if(ent.isDirectory())walk(child);else if(ent.isFile()&&exts.has(path.extname(ent.name).toLowerCase())&&child!=='scripts/verify-polymythcal-build-efficiency.js'){const text=read(child);for(const re of forbidden)if(re.test(text))fail(`private reference returned in ${child}`);}}}roots.forEach(walk);
const gitignore=exists('.gitignore')?read('.gitignore'):'';if(!/^\/?public\/$/m.test(gitignore))warn('public/ is absent from .gitignore');try{const tracked=execFileSync('git',['ls-files','public'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(tracked)warn(`public/ remains tracked in this repository (${tracked.split(/\r?\n/).length} paths); run npm run repair:repository-hygiene once`);}catch(_){ }
if(failures.length){console.error('POLYMYTHCAL BUILD/EFFICIENCY CHECK FAILED');failures.forEach(x=>console.error(' - '+x));process.exit(1);}console.log(`POLYMYTHCAL BUILD/EFFICIENCY CHECK PASSED — ${calendarBytes} byte shell, ${events.length} event records, ${routes.length} unified dedicated entry pages, deterministic release build date with a current-Toronto fallback, and clean privacy scan.`);if(warnings.length){console.warn('REPOSITORY HYGIENE WARNINGS (deployment continues):');warnings.forEach(x=>console.warn(' - '+x));}
