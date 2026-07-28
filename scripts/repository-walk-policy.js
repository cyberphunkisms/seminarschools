'use strict';

const FIXED_GENERATED_DIRECTORIES = new Set([
  'node_modules',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  '.nox',
  'htmlcov',
  'pip-wheel-metadata',
  '.public-build-staging',
  '.public-build-previous',
  '.public-build-lock',
  '.rsync-tmp',
  '.rsync-partial',
]);

function isGeneratedDependencyDirectory(name) {
  const value = String(name || '').toLowerCase();
  return (
    FIXED_GENERATED_DIRECTORIES.has(value)
    || /^\.?venv(?:[-_].+)?$/.test(value)
    || value === 'env'
    || value === '.env'
  );
}

module.exports = {
  isGeneratedDependencyDirectory,
};
