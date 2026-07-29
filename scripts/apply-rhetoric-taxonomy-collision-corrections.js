#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'polymyth/methodologylist/index.html');
let source = fs.readFileSync(target, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  const second = first === -1 ? -1 : source.indexOf(before, first + before.length);
  if (first === -1) throw new Error(label + ': source text is missing');
  if (second !== -1) throw new Error(label + ': source text occurs more than once');
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceCount(label, before, after, expected) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== expected) {
    throw new Error(label + ': expected ' + expected + ' occurrences, found ' + occurrences);
  }
  source = source.split(before).join(after);
}

replaceOnce(
  'Trump Jester collision',
  'Trump is the pop-culture instantiation running the operation without a framework around it: \\"I’m the best, believe me\\" never fully resolves into claim-or-bit, and the unresolved ambiguity is the power.',
  'An earlier surface comparison placed Trump inside this operation because \\"I’m the best, believe me\\" does not resolve into claim or bit. The later Jester-versus-kayfabe-sovereign ruling controls: Trump occupies the throne while performing the margin and therefore belongs under kayfabe-sovereign rather than Jester.'
);

replaceOnce(
  'Jester and Trickster family collision',
  'cross-cultural trickster-theory anchor connecting jester-mode to trickster-mode without collapsing them.',
  'cross-cultural trickster-theory anchor placing trickster-mode inside the Jester/Fool family while preserving distinct story and register variants.'
);

replaceCount(
  'Baselinemorality section route',
  'Baselinemorality (idiomary section, the currency unit',
  'Baselinemorality (sabachtan section, the currency unit',
  2
);

replaceOnce(
  'N85 stale Siren pending item',
  '[MISSING] N85. Medusa-Medea-Siren three-sensory-channel reading — sight/hearing/voice channel distinction. | origin: c627d4f9. | blocker: content (Claude-draftable once the operator confirms scope).',
  '[RESOLVED/DUPLICATE] N85. Medusa-Medea-Siren three-sensory-channel reading — sight, word, and sound distinction. | origin: c627d4f9. | resolution: already present in Medusa-Medea-Siren convergence (research findings); no new entry required.'
);

fs.writeFileSync(target, source, 'utf8');
console.log('Rhetoric taxonomy collision corrections applied to ' + path.relative(root, target));
