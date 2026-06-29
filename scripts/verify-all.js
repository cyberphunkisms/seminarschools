#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const steps = [
  ['node',['scripts/verify-critical.js']],
  ['node',['scripts/verify-public-artifact-blocks.js']],
  ['node',['scripts/verify-search-surface.js']],
  ['node',['scripts/verify-calendar-aliases.js']],
  ['node',['scripts/verify-calendar-data-parity.js']],
  ['node',['scripts/verify-polymythcalendar-today-scroll.js']],
  ['node',['scripts/verify-polymythcalendar-kid-guide.js']],
  ['node',['scripts/verify-polymythcalendar-ux-efficiency.js']],
  ['node',['scripts/verify-site-interactivity.js']],
  ['node',['scripts/verify-human-facing-copy.js']],
  ['node',['scripts/verify-coreplus-release-filter.js']],
  ['node',['scripts/verify-anti-yap.js']],
  ['node',['scripts/verify-responsive-layout.js']],
  ['node',['scripts/build-writing-shortcuts.js','--check']],
  ['node',['scripts/verify-writing-shortcuts.js']],
  ['node',['scripts/build-academic-shortcuts.js','--check']],
  ['node',['scripts/verify-academic-shortcuts.js']],
  ['node',['scripts/verify-festival-parent-taxonomy.js']],
  ['node',['scripts/verify-harvest-pipeline.js']],
  ['node',['scripts/verify-polymythcalendar-name.js']],
  ['node',['scripts/verify-visible-geometry.js']],
  ['node',['scripts/verify-register.js']],
  ['node',['scripts/verify-payments.js']],
  ['node',['scripts/verify-leizu-pipeline.js']],
  ['node',['scripts/verify-leizu-experience.js']],
  ['node',['scripts/verify-leizu-course-picker.js']],
  ['node',['scripts/verify-leizu-simplified-chinese.js']],
  ['node',['scripts/verify-leizu-persian.js']],
  ['node',['scripts/verify-leizu-localization-funnel.js']],
  ['node',['scripts/verify-home-map.js']],
  ['node',['scripts/verify-bb-why.js']],
  ['node',['scripts/verify-main-page.js']],
  ['node',['scripts/verify-main-leizu-funnel.js']],
  ['node',['scripts/verify-site-integrity-light.js']],
  ['node',['scripts/verify-professional-readiness.js']],
  ['node',['scripts/verify-seo.js']],
  ['node',['scripts/verify-typography-controls.js']],
  ['node',['scripts/verify-bookwormcard-gate.js']],
  ['node',['scripts/verify-saul-page.js']]
];
for (const [cmd,args] of steps) {
  const label = `${cmd} ${args.join(' ')}`;
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error(`VERIFY STEP FAILED TO START: ${label}`);
    console.error(result.error.message || result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`VERIFY STEP FAILED (${result.status}): ${label}`);
    process.exit(result.status || 1);
  }
}
console.log('\nVERIFY ALL PASSED — all deployment guards completed.');
