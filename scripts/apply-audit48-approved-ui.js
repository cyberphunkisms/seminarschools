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
