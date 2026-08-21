#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const START = '<!-- POLYMYTHCAL-SET13-15-FACETS:START -->';
const END = '<!-- POLYMYTHCAL-SET13-15-FACETS:END -->';

const groups = [
  {
    key: 'communityFormats',
    id: 'pmCommunityFormatsTitle',
    title: ['Community, charity, heritage, and place format', 'Format communautaire, caritatif, patrimonial et territorial'],
    help: ['Filter forms of collective care, fundraising, volunteering, neighbourhood life, heritage, and land-based learning.', 'Filtrez les formes d’entraide, de collecte de fonds, de bénévolat, de vie de quartier, de patrimoine et d’apprentissage sur le territoire.'],
    values: [
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
      ['block-party', 'Block party', 'Fête de rue'],
      ['bazaar-night-market', 'Bazaar or night market', 'Bazar ou marché de nuit'],
      ['newcomer-diaspora', 'Newcomer or diaspora event', 'Événement pour nouveaux arrivants ou diaspora'],
      ['historical-walk', 'Historical walk', 'Promenade historique'],
      ['architecture-tour', 'Architecture tour', 'Visite architecturale'],
      ['cemetery-tour', 'Cemetery tour', 'Visite de cimetière'],
      ['public-dig', 'Public archaeological dig', 'Fouille archéologique publique'],
      ['reenactment', 'Reenactment', 'Reconstitution historique'],
      ['open-archive', 'Open archive', 'Archives ouvertes'],
      ['doors-open', 'Doors Open event', 'Portes ouvertes patrimoniales'],
      ['land-based-learning', 'Land-based learning', 'Apprentissage sur le territoire'],
    ],
  },
  {
    key: 'digitalFormats',
    id: 'pmDigitalFormatsTitle',
    title: ['Live media and digital format', 'Format médiatique en direct et numérique'],
    help: ['Filter genuinely scheduled live, interactive, premiere, immersive, and platform-native events.', 'Filtrez les événements réellement programmés en direct, interactifs, en première, immersifs et propres aux plateformes.'],
    values: [
      ['live-podcast', 'Live podcast', 'Balado en direct'],
      ['public-radio-recording', 'Public radio recording', 'Enregistrement public de radio'],
      ['media-taping', 'Media taping', 'Enregistrement médiatique'],
      ['livestreamed-discussion', 'Livestreamed discussion', 'Discussion webdiffusée'],
      ['ama', 'AMA', 'Séance de questions AMA'],
      ['virtual-conference', 'Virtual conference', 'Conférence virtuelle'],
      ['virtual-exhibition', 'Virtual exhibition', 'Exposition virtuelle'],
      ['virtual-festival', 'Virtual festival', 'Festival virtuel'],
      ['creator-livestream', 'Creator livestream', 'Diffusion en direct avec créateur'],
      ['creator-watch-party', 'Creator watch party', 'Visionnement collectif avec créateur'],
      ['game-stream', 'Game-stream event', 'Événement de diffusion de jeu'],
      ['vr-ar-event', 'VR or AR event', 'Événement en RV ou RA'],
      ['online-premiere', 'Online premiere', 'Première en ligne'],
      ['platform-native-cultural-event', 'Platform-native cultural event', 'Événement culturel propre à une plateforme'],
    ],
  },
  {
    key: 'programFormats',
    id: 'pmProgramFormatsTitle',
    title: ['Course and multi-session program format', 'Format de cours et de programme à plusieurs séances'],
    help: ['Filter bounded courses, cohorts, institutes, academic stages, and public learning programs.', 'Filtrez les cours délimités, les cohortes, les instituts, les étapes universitaires et les programmes publics d’apprentissage.'],
    values: [
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
      ['study-tour', 'Study tour', 'Voyage d’étude'],
      ['teacher-professional-development', 'Teacher professional development', 'Perfectionnement professionnel des enseignants'],
      ['admissions-registration', 'Admissions or registration date', 'Date d’admission ou d’inscription'],
      ['open-house', 'Educational open house', 'Portes ouvertes éducatives'],
      ['orientation', 'Orientation', 'Séance d’orientation'],
      ['convocation', 'Convocation', 'Collation des grades'],
      ['academic-showcase', 'Academic showcase', 'Vitrine universitaire'],
    ],
  },
];

function renderSection(group, language) {
  const i = language === 'fr' ? 1 : 0;
  const clear = language === 'fr' ? 'Effacer' : 'Clear';
  const labels = group.values.map(([value, en, fr]) => {
    const label = language === 'fr' ? fr : en;
    return `<label class="pm-chip" data-label="${label}" data-label-key="${group.key}:${value}"><input data-state-set="${group.key}" type="checkbox" value="${value}"/>${label} <span class="pm-count" data-count-for="${group.key}:${value}"></span></label>`;
  }).join('\n');
  return `<section aria-labelledby="${group.id}" class="pm-panel pm-filter-section"><div class="pm-section-head"><h2 id="${group.id}">${group.title[i]}</h2><button class="pm-section-clear" data-clear-section="${group.key}" hidden="" type="button">${clear}</button></div>\n<p class="pm-help">${group.help[i]}</p>\n<fieldset class="pm-fieldset"><legend class="pm-legend">${group.title[i]}</legend><div class="pm-chip-list">\n${labels}\n</div></fieldset></section>`;
}

function apply(relativePath, language) {
  const target = path.join(ROOT, relativePath);
  const original = fs.readFileSync(target, 'utf8');
  const withoutOwned = original.replace(new RegExp(`\\n?${START}[\\s\\S]*?${END}\\n?`, 'g'), '\n');
  const boundary = /\n<\/div><\/div>\n<\/details><section aria-label="(?:Current filter choices|Choix de filtres actuels)"/;
  if (!boundary.test(withoutOwned)) throw new Error(`${relativePath}: advanced-filter insertion boundary missing`);
  const owned = `${START}\n${groups.map(group => renderSection(group, language)).join('\n')}\n${END}`;
  const next = withoutOwned.replace(boundary, `\n${owned}$&`);
  if (next === original) return false;
  if (CHECK) throw new Error(`${relativePath}: Set 13-15 facets are stale`);
  fs.writeFileSync(target, next);
  return true;
}

try {
  const changed = [
    apply('polymythseminars/index.html', 'en'),
    apply('polymythseminars/fr/index.html', 'fr'),
  ].filter(Boolean).length;
  console.log(`POLYMYTHCAL SET 13-15 FACETS ${CHECK ? 'CHECK' : 'APPLY'} — ${changed} file(s) changed.`);
} catch (error) {
  console.error(`POLYMYTHCAL SET 13-15 FACETS FAILED — ${error.message}`);
  process.exit(1);
}
