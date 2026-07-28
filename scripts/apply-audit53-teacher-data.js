#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'teacherresources', 'resources-data.json');
const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const categoryTitles = {
  'ela-pd-canadian': 'Canadian Literature',
  'ela-pd-american': 'American Literature Classics'
};

const categoryBlurbs = {
  'ela-tb-holt': 'Holt anthologies, adapted readers, interactive worktexts, and story-level classroom texts for Grades 6 to 12.',
  'ela-tb-pearson': 'Pearson reader notebooks, adapted editions, and classroom text packets for middle and secondary English.',
  'ela-ss-american': 'Stories, poems, author records, and classroom-ready American literature sources.',
  'ela-inst-guides': 'Lesson plans, activity sequences, media pairings, and reading supports.',
  'ela-inst-writing': 'Writing prompts, response tasks, assessment supports, and composition practice.',
  'ela-pd-canadian': 'Open Canadian novels, poetry, drama, and public-domain texts for classroom reading and teacher background.',
  'ela-pd-british': 'Open British drama, novels, poetry, and other public-domain texts for classroom reading.',
  'ela-pd-american': 'Open American novels, stories, poetry, and other public-domain texts for classroom reading.',
  'ela-inst-esl': 'Vocabulary and language-learning games for multilingual and English-language learners.',
  'sci-textbooks': 'Biology, chemistry, physics, astronomy, environmental science, and general science books and readers.',
  'sci-sims': 'Interactive science simulations and activities covering forces, matter, energy, biology, chemistry, and Earth systems.',
  'sci-interactive': 'Khan Academy courses and CK-12 FlexBooks for biology, chemistry, physics, computing, and related study.',
  'math-cemc': 'University of Waterloo CEMC contest papers for Pascal, Cayley, Fermat, Euclid, and other competitions.',
  'math-other': 'Reasoning problems, teacher notes, practice sets, released questions, and additional mathematics activities.',
  'math-textbooks': 'Open textbooks for algebra, calculus, statistics, quantitative reasoning, and other secondary or college mathematics.',
  'fsl-literature': 'French-language novels, plays, poetry, and translated classics from open text archives.',
  'fsl-curriculum': 'French-language lessons and study supports for vocabulary, grammar, reading, and problem solving.',
  'hist-us-primary': 'Document-based lessons, primary sources, and historical-thinking activities for United States history.',
  'hist-world': 'Document-based lessons and source sets spanning ancient, medieval, early modern, and global history.',
  'hist-canada': 'Lesson packages and primary-source activities for Canadian social, political, labour, and wartime history.',
  'hist-textbooks': 'Open history, government, political science, economics, and social-science textbooks.',
  'hist-canada-war': 'Canadian War Museum lesson plans, artifact studies, primary sources, and visual-analysis activities.',
  'hist-civics': 'Canadian civics, economics, census, financial literacy, and student-voting resources.',
  'ind-resources': 'First Peoples curriculum guides, Indigenous literature kits, teaching frameworks, and classroom media guides.',
  'ib-specimen': 'Official IB Diploma and Middle Years specimen papers and assessment guidance across core subjects.'
};

function currentRouteKey(group, category, entry, index) {
  return crypto.createHash('sha1')
    .update(`${group.id}|${category.id}|${entry.title}|${entry.url}|${index}`)
    .digest('hex')
    .slice(0, 8);
}

const additions = {
  formats: {
    'museum-lesson': 'Museum Lesson',
    'indigenous-pdf': 'Indigenous Education PDF',
    'french-lesson': 'French Lesson'
  },
  subjects: {
    sciences: 'Sciences',
    french: 'French/FSL',
    cs: 'Computer Science'
  },
  curricula: {
    atlantic: 'Atlantic Canada'
  }
};

for (const [taxonomy, values] of Object.entries(additions)) {
  data[taxonomy] = { ...(data[taxonomy] || {}), ...values };
}

let index = 0;
const ids = new Set();
const routeKeys = new Set();
for (const group of data.groups || []) {
  for (const category of group.categories || []) {
    if (!(category.id in categoryBlurbs)) {
      throw new Error(`Missing Audit 53 collection description for ${category.id}`);
    }
    if (categoryTitles[category.id]) category.title = categoryTitles[category.id];
    category.blurb = categoryBlurbs[category.id];
    for (const entry of category.entries || []) {
      entry.id = entry.id || `TR-${String(index + 1).padStart(4, '0')}`;
      entry.route_key = entry.route_key || currentRouteKey(group, category, entry, index);
      if (ids.has(entry.id)) throw new Error(`Duplicate Teacher Resources ID ${entry.id}`);
      if (routeKeys.has(entry.route_key)) throw new Error(`Duplicate Teacher Resources route key ${entry.route_key}`);
      ids.add(entry.id);
      routeKeys.add(entry.route_key);
      index += 1;
    }
  }
}

if (index !== 644) throw new Error(`Expected 644 Teacher Resources records, found ${index}`);
fs.writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Teacher Resources data upgraded: ${index} stable IDs, 25 collection descriptions, normalized live taxonomy.`);
