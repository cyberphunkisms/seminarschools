#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function findSeedArrayBounds(text) {
  const seedIdx = text.indexOf('const SEED');
  if (seedIdx < 0) throw new Error('const SEED not found');
  const start = text.indexOf('[', seedIdx);
  let depth = 0, inTpl = false, quote = null, esc = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (quote) { if (c === quote) quote = null; continue; }
    if (inTpl) { if (c === '`') inTpl = false; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('SEED array close not found');
  return { start, end };
}

function insertEntries(relPath, entries) {
  const file = path.join(root, relPath);
  let text = fs.readFileSync(file, 'utf8');
  const newEntries = entries.filter(e => !text.includes(`t:${JSON.stringify(e.t)}`) && !text.includes(`"t":${JSON.stringify(e.t)}`));
  if (!newEntries.length) {
    console.log(relPath + ': entries already present');
    return;
  }
  const { end } = findSeedArrayBounds(text);
  const block = newEntries.map(e => '  ' + JSON.stringify(e, null, 2).replace(/\n/g, '\n  ')).join(',\n') + ',\n';
  text = text.slice(0, end) + block + text.slice(end);
  fs.writeFileSync(file, text, 'utf8');
  console.log(relPath + ': inserted ' + newEntries.length + ' entries');
}

function replaceEvery(relPath, from, to) {
  const file = path.join(root, relPath);
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  text = text.split(from).join(to);
  if (before !== text) fs.writeFileSync(file, text, 'utf8');
  console.log(relPath + ': ' + ((before.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length) + ' replacements');
}

const bbEntries = [
  {
    id:'dim-034',
    bb_links:['dim-001','dm-095','dm-110','dm-111','bw-012'],
    s:'dimension',
    r:'both',
    t:'RAINBOW-ANOMALY PORTAL SUBSTRATE: mirrors, reflections, media, books, and any threshold that already behaves like dimensional crossing',
    b:`LAYMAN. A BB dimension can be entered through any threshold the table can make legible as a crossing: mirror, reflected light, page, screen, stage, song, image, book margin, classroom board, game interface, painting, window, puddle, shadow, or other media surface. The Reddit mirror case is the clean public seed: direct bathroom lights and mirror-reflected lights appear as different colours, and ordinary commenters immediately read the difference as shadow-realm or climb-through-the-mirror logic. BB uses that already-running reflex. The portal is not a technical menu. The portal is the moment a surface shows the same world differently enough that the learner can feel another dimension pressing through it.

SCOPE. Text, media, book, film, game, image, song, public meme, classroom object, and historical archive can all become visitable when they have enough internal logic to hold a dimension. This extends dim-001 without flattening it. Every medium remains itself. A film-world is not treated as a novel. A book-world is not treated as a video-game map. A meme is not annexed as BB property. BB discovers the crossing-operation already firing inside the object and then builds a playable educational passage through it.

FRONT-FACING RULE. At table, use in-world words. Say mirror, page, screen, book, picture, song, or door. Do not narrate Layer A, overlay, substrate, portal-class, or engine vocabulary to players. The crossing should feel like magic, rainbow, curiosity, danger, and discovery, not backend architecture.

CURATION GATE. Anywhere can be possible as substrate. Not anywhere is automatically worth a campaign. Rainbowsol or the teacher chooses thresholds that carry teaching value, age fit, internal logic, citation discipline, and quest motive. A cool image can be a seed. A dimension needs enough structure to sustain consequences, NPCs, choices, evidence, and return.

TEST. If the threshold makes learners ask what world is on the other side, if the source has enough logic to hold scenes, if the crossing can motivate reading or research, and if the consequences can be tracked, it can become a BB portal candidate. If it only looks cool and teaches nothing, it remains a visual prompt and does not become a campaign dimension.`,
    x:'Origin 2026-07-09 user screenshot and ruling: the mirror anomaly was good for BB, and BB should allow rainbow magic dimensional travel from one text, media, or book to another wherever the crossing can be made pedagogically live. Filed as a BB dimension entry with ML* backref rather than as a generic metaphor.',
    tg:'dimension, portal, mirror, reflection, rainbow-magic, media-travel, text-as-dimension, always-already, reddit-mirror, shadow-realm, front-facing, curation-gate, 2026-07-09'
  },
  {
    id:'dm-111',
    bb_links:['dm-013','dm-015','dm-017','dm-021','dm-023','dm-024','dim-034','bw-012'],
    s:'methodology',
    r:'dm',
    t:'TIMEBOUND QUEST CONSEQUENCE LAW: assignments, quest windows, work quality, and future consequences persist like Kingdom Come',
    b:`LAYMAN. BB quests are timebound. The world keeps moving. A quest finished well opens better options later. A quest finished badly leaves scars, rumors, lost time, weaker trust, worse tools, closed windows, altered NPC reactions, harder scenes, or repair-quests. A quest ignored or unfinished costs something inside the world. This does not mean punishment for punishment's sake. It means the book-world remembers the learning.

KINGDOM COME MODEL. Kingdom Come Deliverance gives the design image: NPC routines, time windows, closed shops, travel time, degraded resources, and delayed choices all matter. BB translates that into classroom play. A named NPC may be reachable only before work, after school, at a shift, in a library hour, at a rally, or at a scene-specific time. A source, witness, book, artifact, or chance can expire or become harder to access. The player can rest, travel, revise, or delay, but time spent in one direction closes or changes another direction.

ASSIGNMENT-INTEGRATION. The assignment is not beside the game. It is the quest action. A paragraph, note, map, apology, dossier, close-reading, debate prep, research sheet, revision, or oral explanation becomes what the character brings back into the world. The quality of the academic work becomes the quality of the in-world consequence. Strong evidence creates stronger leverage. Weak evidence creates weaker leverage. Missing work creates a hole the world can feel.

FAIRNESS GUARD. Consequences are recoverable traces, not permanent student shaming. Bad work should create playable repair paths, extra evidence hunts, scar records, trust rebuilding, revised maps, or second attempts with costs. The game tracks learning over time, not a fixed identity of failure. The teacher remains the human filter and can soften or redirect consequences for equity, accessibility, absence, neurodivergence, crisis, or classroom safety.

TABLE GATE. Before a quest ships, name its open window, close window, success consequence, weak-success consequence, failure consequence, repair route, and later echo. If the later echo is absent, the quest is only an activity. If the repair route is absent, the consequence risks becoming punitive rather than pedagogical.`,
    x:'Origin 2026-07-09 user ruling while revisiting the BB mirror example: everything should also be timebound so unfinished, badly finished, or well-finished quests and assignments have future consequences like Kingdom Come Deliverance. Extends existing dm-013/no-dice stakes, dm-023 portal log, dm-024 dimension build, and the May 2026 Kingdom Come research already held in bb*/cc*.',
    tg:'method, dm-root, timebound-quests, consequences, assignments-as-quests, work-quality, kingdom-come-deliverance, npc-schedules, quest-windows, repair-route, future-echo, fairness-guard, 2026-07-09'
  },
  {
    id:'bw-012',
    bb_links:['bw-003','bw-004','dim-034','dm-111','dm-023'],
    s:'bookworm',
    r:'both',
    t:'Cross-text continuity: the bookworm travels, the media stays itself, and the portal log remembers consequences',
    b:`LAYMAN. The bookworm can travel from one text, medium, book, image, story, film, game, or archive to another, but the traveler is the continuity, not a homogenizing system. Each world keeps its own rules. The bookworm carries scars, items, questions, promises, unfinished obligations, and learned capacities across crossings through the portal log.

ANTI-FLATTENING. Macbeth does not become Hughes. Hughes does not become a video game. A Reddit mirror joke does not become BB property. The bookworm moves between worlds while each world remains itself. BB names the crossing-operation and tracks the learning-trace. It does not annex the object.

CONSEQUENCE MEMORY. The portal log records where the bookworm went, what quest was completed, what was left unfinished, what was done well or badly, what was learned, what scar or tool was gained, and what future echo now follows the traveler. This makes assignments and choices cumulative without turning them into a simple points economy.

TEST. After any crossing, the DM should be able to answer four questions: what did the world keep of itself; what did the bookworm carry out; what consequence follows later; what repair or development path remains open.`,
    x:'Origin 2026-07-09 second BB integration pass. Companion to dim-034 rainbow-anomaly portal substrate and dm-111 timebound quest consequence law. Protects cross-media travel from becoming capture or flattening.',
    tg:'bookworm, cross-text-continuity, media-stays-itself, portal-log, consequence-memory, anti-annexation, rainbow-travel, cumulative-learning, 2026-07-09'
  }
];

const mlEntries = [
  {
    s:'methodology', r:'both', t:'BB cross-media portal and timebound consequence routing rule (July 9 2026)',
    b:`LAYMAN. When BB material appears inside a polymyth conversation, route game doctrine to bb* and keep ml* as the backref and scanner. The July 9 2026 correction added three game-side rules: dim-034 rainbow-anomaly portal substrate, dm-111 timebound quest consequence law, and bw-012 cross-text continuity. The doctrine is that rainbow magic dimensional travel may pass through mirrors, pages, screens, books, media, images, and other threshold surfaces whenever the source can sustain pedagogical play, while every quest remains timebound and future-facing. Completed, weak, failed, or unfinished assignments echo later through scars, trust, tools, NPC reactions, access windows, repair quests, and the portal log.

BOUNDARY. ml* does not become the BB rules file. ml* records the routing, the anti-annexation logic, and the philosophical consequence. bb* holds the playable rules. cc* instantiates them in campaigns. This preserves interdependence without making ml* the ruler.

CROSS-REFERENCES. BB dim-034; BB dm-111; BB bw-012; Always-already boundary gate; Mirror anomaly as spontaneous BB portal recognition; Operation-not-annexation; CL-47 routing discipline; Star-file interdependence rule.`,
    tg:'methodology, bb-backref, routing, cross-media-portal, timebound-consequence, kingdom-come, mirror-anomaly, star-file-interdependence, cl-47, 2026-07-09'
  },
  {
    s:'analysis', r:'both', t:'Second useful ouroborosanalyses: BB and ML internal audit closeout (July 9 2026)',
    b:`LAYMAN. The second pass corrected the prior external-validation drift by auditing internal operator conflicts. It found no fatal contradiction, but it named the pressure points that should govern future build work. BB pressure points: possible threshold versus curated dimension; magic travel versus academic rigor; time consequences versus classroom fairness; Kingdom Come realism versus teacher workload; canon seal versus player agency; cross-media travel versus flattening; assignment failure versus repair path. ML pressure points: always-already versus annexation; ironmanning versus salvage bias; parseltongue versus spectacle; sabachtan truth versus cruelty-performance; quality versus self-approval; myth vocabulary versus costume.

RESOLUTIONS. One: a threshold can be possible substrate while still requiring teacher curation before it becomes a campaign dimension. Two: assignments become quests only when work quality has a later in-world echo. Three: failure consequences require repair routes. Four: media stay themselves while the bookworm carries continuity. Five: ML names operations without annexing origins. Six: mythic terms earn space only when they reveal operations. Seven: ouroborosanalyses on polymyth begins with internal rule conflict before external reader-effect questions.

OPEN ITEM STATUS. No conceptual blocker remains. The live work is implementation discipline: every new BB dimension needs a portal gate, time window, consequence echo, repair route, citation/canon boundary, and teacher workload tier. Every new ML entry needs operation test, non-annexation discipline, and null verdict where ironmanning yields nothing.`,
    tg:'analysis, ouroborosanalyses, bb, ml, internal-audit, no-fatal-contradiction, threshold-curation, timebound-consequences, repair-route, anti-annexation, 2026-07-09'
  },
  {
    s:'learnings', r:'both', t:'July 9 2026 CV front-facing and BB consequence learnings',
    b:`LAYMAN. Two practical learnings filed after the CV and BB pass. First, front-facing CV language must use hiring-reader terms, not framework-internal poetic terms. Core Signals is expressive but sounds like internal theory language; Key Skills is the cleaner CV heading. The old CV's one-page density, centered identity, strong hierarchy, and compressed sections remain the design reference, while the modular web CV supplies one-page role-facing outputs. Second, the Reddit mirror anomaly belongs in BB as public always-already portal cognition: a reflected difference becomes shadow-realm logic before the game names it. BB should let rainbow magic cross through books, media, screens, mirrors, and other thresholds when the source can sustain learning, and every quest should be timebound with future consequences and repair paths.

ROUTING. CV front-facing audit lives in the site/report layer and Saul CV builder. BB doctrine lives in bb* dim-034, dm-111, and bw-012. ML holds this learning ledger and the routing rule.`,
    tg:'learnings, cv, front-facing, key-skills, core-signals-removed, bb, mirror-anomaly, rainbow-travel, timebound-quests, consequence-memory, repair-routes, 2026-07-09'
  }
];

insertEntries('polymyth/bookwormburrows/index.html', bbEntries);
insertEntries('polymyth/methodologylist/index.html', mlEntries);
replaceEvery('saul/index.html', 'Core Signals', 'Key Skills');
replaceEvery('scripts/build-cv-pdf.js', 'Core Signals', 'Key Skills');

// Make the modular CV verifier explicitly guard the front-facing label.
const verifyRel = 'scripts/verify-saul-modular-cv.js';
const verifyFile = path.join(root, verifyRel);
let verify = fs.readFileSync(verifyFile, 'utf8');
if (!verify.includes('Core Signals front-facing label returned.')) {
  verify = verify.replace("if (has('data-cat=\"seminarschools\">Seminar Schools</button>')) failures.push('Seminar Schools standalone tab label returned.');", "if (has('data-cat=\"seminarschools\">Seminar Schools</button>')) failures.push('Seminar Schools standalone tab label returned.');\nif (has('Core Signals')) failures.push('Core Signals front-facing label returned.');\nif (!has('Key Skills')) failures.push('Key Skills CV sidebar heading missing.');");
  fs.writeFileSync(verifyFile, verify, 'utf8');
  console.log(verifyRel + ': added Key Skills guard');
}
