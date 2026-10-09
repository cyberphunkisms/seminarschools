#!/usr/bin/env node
'use strict';

/**
 * Run the frozen Audit 43 UI applicator through the current repository-walk
 * policy. The frozen program remains byte-identical historical evidence; this
 * wrapper prevents active builds from entering transient or generated trees.
 */
const fs = require('fs');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const originalReadDir = fs.readdirSync;
fs.readdirSync = function filteredReadDir(directory, options) {
  const entries = originalReadDir.call(fs, directory, options);
  if (!options || typeof options !== 'object' || !options.withFileTypes) {
    return entries;
  }
  return entries.filter(entry => (
    !entry.isDirectory() || !isGeneratedDependencyDirectory(entry.name)
  ));
};

try {
  require('./apply-audit43-approved-ui');
} finally {
  fs.readdirSync = originalReadDir;
}

// Keep the finder aligned with its detail pages after the shared UI sheet is
// reinserted. The opt-out must follow that sheet in the CSS cascade.
const teacherFile = require('path').resolve(__dirname, '../teacherresources/index.html');
const teacherBefore = fs.readFileSync(teacherFile, 'utf8');
const teacherTransition = '<style data-teacherresources-transition="none">@view-transition{navigation:none}</style>';
const uiSheet = '<link rel="stylesheet" href="/css/audit43-approved.css?v=20260725-audit43">';
const teacherAfter = teacherBefore
  .replace(/<style(?: data-teacherresources-transition="none")?>@view-transition\{navigation:none\}<\/style>[ \t]*(?:\r?\n)?/g, '')
  .replace(uiSheet, uiSheet + '\n' + teacherTransition);
if (teacherAfter !== teacherBefore) fs.writeFileSync(teacherFile, teacherAfter);
