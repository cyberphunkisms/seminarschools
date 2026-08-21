#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const {loadInventoryContract}=require('./lib/polymythcal-inventory-contract');const ROOT=path.resolve(__dirname,'..');const inventory=loadInventoryContract(ROOT);const errors=[];
const main=fs.readFileSync(path.join(ROOT,'polymythseminars/index.html'),'utf8');const french=fs.readFileSync(path.join(ROOT,'polymythseminars/fr/index.html'),'utf8');const app=fs.readFileSync(path.join(ROOT,'js/polymythcal-revamp.js'),'utf8');const features=fs.readFileSync(path.join(ROOT,'js/polymythcal-features.js'),'utf8');const css=fs.readFileSync(path.join(ROOT,'css/polymythcal-revamp.css'),'utf8');const sharedType=fs.readFileSync(path.join(ROOT,'css/site-wide-type-zoom.css'),'utf8');
for(const [name,needle,where] of [
 ['live-search guidance','Results update as you type.',main],['collapsed filter drawer','id="pmFilterDrawer"',main],['active filter panel','id="pmActivePanel"',main],['paginated list control','id="pmLoadMore"',main],['calendar view mount','id="pmCalendar"',main],['focused calendar disclosure','id="pmFocusedCalendars"',main],['secondary calendar tools','id="pmCalendarTools"',main],['geometry mandala','/js/mandala.js',main],['geometry indra','/js/indra.js',main],['alive surface','/css/alive.css',main],['dynamic event descriptions','event.description',app],['24-item initial pagination','const PAGE_SIZE = 24',app],['calendar month navigation','data-calendar-nav',app],['mobile agenda rendering','pm-agenda-day',app],['URL-backed state','history.replaceState',app],['bounded HTTP cache reuse','cache: "default"',app],['route restriction','function routeMatches(event)',app],['route-aware facets','allEvents.filter(routeMatches)',app],['content visibility for event cards','content-visibility: auto',css],['route context design','.pm-route-context',css],
 ['prepaint hydration marker','classList.add("pm-ui-ready")',app],['source-first card action','class="pm-action pm-source-action"',app],['source action hostname','pm-source-domain',app],['technical hostname wrap opt-in','data-allow-word-break="true"',app],['organizer source wording','openOrganizer:',app],['source fallback wording','openSource:',app],['compact listing kind','class="pm-chip-list"',main],['data summary','id="pmDataUpdated"',main],['related Commons paths','class="pm-related-paths"',main],['payload-driven summary','renderDataSummary(loaded.payload, loaded.raw.length)',app],['visible deadline labels','class="pm-date-box deadline"',app],['confirmed event precedence','if (confirmedDatedEvent) return "attend";',app]
]) if(!where.includes(needle)) errors.push(`shared Polymythcal missing ${name}`);
if(!/@media screen and \(max-width:820px\)\{[\s\S]*?\.ss-fz\{[\s\S]*?right:auto!important;[\s\S]*?left:calc\(\.75rem \+ env\(safe-area-inset-left,0px\)\)!important;[\s\S]*?\.theme-toggle\{[\s\S]*?right:calc\(\.75rem \+ env\(safe-area-inset-right,0px\)\)!important;[\s\S]*?bottom:calc\(\.75rem \+ env\(safe-area-inset-bottom,0px\)\)!important;/.test(sharedType)) errors.push('shared Polymythcal missing split-corner mobile theme/type controls');
if(css.includes('right: calc(4rem + env(safe-area-inset-right, 0px))')) errors.push('shared Polymythcal reintroduced obsolete fixed mobile control clearance');
for(const [name,needle,where] of [
 ['versioned saved-event IDs','const SAVED_KEY = "polymythcal.savedEvents.v2"',app],
 ['saved-event migration','const LEGACY_SAVED_KEY = "polymythcal.savedEvents.v1"',app],
 ['versioned saved searches','const SEARCHES_KEY = "polymythcal.savedSearches.v2"',app],
 ['focused-route saved-event IDs',"var EVENT_KEY='polymythcal.savedEvents.v2'",features],
 ['focused-route metadata separation',"var EVENT_META_KEY='polymythcal.savedEventMeta.v1'",features],
 ['explicit English route authority','return "en";',app],
 ['French data-summary label','aria-label="Aperçu des données du calendrier"',french],
 ['French related-project label','aria-label="Projets connexes de Polymyth Commons"',french],
]) if(!where.includes(needle)) errors.push(`shared Polymythcal missing ${name}`);
if(/pm-lang-pending|visibility\s*:\s*hidden/.test(french)) errors.push('French Polymythcal retains a startup visibility gate');
if(
  main.indexOf('id="pmNear"') < main.indexOf('id="pmPlaceTitle"') ||
  main.indexOf('id="pmNear"') > main.indexOf('id="pmTopicTitle"')
) errors.push('nearby ranking must remain within the Where section');
if(/id="pmFilterDrawer"\s+open=""/.test(main)) errors.push('filter drawer must begin collapsed');
for(const [name,needle,where] of [
 ['quick-start preset layer','id="pmQuickStarts"',main],
 ['preset controls','data-preset=',main],
 ['duplicate show-results button','id="pmJumpResults"',main],
 ['duplicate mobile action bar','id="pmMobileBar"',main],
 ['preset controller','function applyPreset',app],
 ['mobile jump controller','pmMobileResults',app],
]) if(where.includes(needle)) errors.push(`shared Polymythcal retains ${name}`);
if(app.includes('searchWriteTimer')) errors.push('Polymythcal retains a duplicate delayed URL write after its debounced render');
if(Buffer.byteLength(main,'utf8')>=100000) errors.push('main Polymythcal client shell exceeds 100 KB');
if(main.includes('id="eventsContainer"')||main.includes('id="events-fallback"')) errors.push('main Polymythcal regressed to embedded full-corpus markup');
const eventPayload=JSON.parse(fs.readFileSync(path.join(ROOT,'polymythseminars/events.json'),'utf8'));const canonicalEvents=eventPayload.events||[];
let unknownTimeClaims=0,opportunitySchemas=0,languageRouteMismatches=0,relatedMismatches=0;
function relatedIds(html,prefix){const section=(html.match(/<nav class="pm-event-related"[\s\S]*?<\/nav>/)||[])[0]||'';return [...section.matchAll(new RegExp(prefix+'([^/]+)/','g'))].map(match=>match[1]);}
for(const event of canonicalEvents){
 const id=String(event.id||event.identity_key||'');const enPath=path.join(ROOT,'polymythseminars/events',id,'index.html');const frPath=path.join(ROOT,'polymythseminars/fr/events',id,'index.html');
 if(!fs.existsSync(enPath)||!fs.existsSync(frPath)){languageRouteMismatches++;continue;}
 const en=fs.readFileSync(enPath,'utf8'),fr=fs.readFileSync(frPath,'utf8');
 if(event.time_precision!=='exact'&&(/<time datetime="[^"]*T00:00/.test(en)||/<time datetime="[^"]*T00:00/.test(fr))) unknownTimeClaims++;
 if(event.record_kind==='opportunity'&&(/application\/ld\+json/.test(en)||/application\/ld\+json/.test(fr))) opportunitySchemas++;
 if(!en.includes(`/polymythseminars/fr/events/${id}/`)||!fr.includes(`/polymythseminars/events/${id}/`)) languageRouteMismatches++;
 if(JSON.stringify(relatedIds(en,'/polymythseminars/events/'))!==JSON.stringify(relatedIds(fr,'/polymythseminars/fr/events/'))) relatedMismatches++;
}
if(canonicalEvents.length<inventory.minimum_canonical_events) errors.push(`canonical event inventory fell below ${inventory.minimum_canonical_events}: ${canonicalEvents.length}`);
if(unknownTimeClaims) errors.push(`${unknownTimeClaims} date-only listings still imply midnight`);
if(opportunitySchemas) errors.push(`${opportunitySchemas} application-only records still emit Event schema`);
if(languageRouteMismatches) errors.push(`${languageRouteMismatches} event language route pairs are incomplete`);
if(relatedMismatches) errors.push(`${relatedMismatches} event language pairs disagree on related listings`);
const routes={writingclub:'apply',writingkids:'apply',writingjuniors:'apply',writingteens:'apply',writinggrads:'apply',university:'both',philosophy:'both',humanities:'both',cfps:'apply',lectures:'attend',fellowships:'apply'};
for(const [route,mode] of Object.entries(routes)){
 const rel=`${route}/index.html`;const html=fs.readFileSync(path.join(ROOT,rel),'utf8');
 if(Buffer.byteLength(html,'utf8')>=100000) errors.push(`${rel} exceeds 100 KB`);
 for(const [name,needle] of [['route identity',`data-pm-route="${route}"`],['route default',`data-pm-default-content="${mode}"`],['shared result mount','id="pmEventList"'],['shared app','/js/polymythcal-revamp.js'],['shared CSS','/css/polymythcal-revamp.css'],['route context','class="pm-route-context'],['route navigation label','aria-label="Calendar navigation"'],['filter escape path','Browse all Polymythcal listings'],['no-script current results','class="pm-noscript pm-panel"'],['calendar view mount','id="pmCalendar"'],['saved-state dialog','class="pm-saved-dialog" id="pmSavedPanel"'],['collapsed filter drawer','id="pmFilterDrawer"'],['focused calendar disclosure','id="pmFocusedCalendars"'],['calendar tools disclosure','id="pmCalendarTools"']]) if(!html.includes(needle)) errors.push(`${rel} missing ${name}`);
 if(/id="pmFilterDrawer"\s+open=""/.test(html)) errors.push(`${rel} filter drawer must begin collapsed`);
 if(/pmQuickStarts|data-preset=|pmJumpResults|pmMobileBar/.test(html)) errors.push(`${rel} retains redundant discovery controls`);
 if(/eventsContainer|quickFocusNav|watchlistPanel|calendarSearch|data-focus="deadlines"/.test(html)) errors.push(`${rel} retains legacy controls`);
}
const pkg=fs.readFileSync(path.join(ROOT,'package.json'),'utf8');if(!pkg.includes('verify-polymythcalendar-ux-efficiency.js')) errors.push('package verify:all does not include UX efficiency guard');
const focusedLinks=[...main.matchAll(/<a href="\/(writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)\/"/g)].map(match=>match[1]);
if(new Set(focusedLinks).size!==11) errors.push(`focused calendar inventory changed: ${new Set(focusedLinks).size}`);
if(errors.length){console.error('POLYMYTHCALENDAR UX/EFFICIENCY CHECK FAILED');errors.forEach(e=>console.error(' - '+e));process.exit(1);}
console.log(`POLYMYTHCALENDAR UX/EFFICIENCY CHECK PASSED — one lightweight shared application powers the main calendar and ${Object.keys(routes).length} route-restricted entry pages.`);
