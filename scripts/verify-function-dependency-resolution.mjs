#!/usr/bin/env node

try {
  const common = await import('../netlify/functions/_leizu-payment-common.mjs');
  const required = ['getLeizuStore', 'claimReference', 'writeReference', 'writeSession'];
  const missing = required.filter(name => typeof common[name] !== 'function');
  if (missing.length) throw new Error(`missing exports: ${missing.join(', ')}`);
  console.log('FUNCTION DEPENDENCY RESOLUTION PASSED — @netlify/blobs and Leizu shared exports resolve from the locked install.');
} catch (error) {
  console.error(`FUNCTION DEPENDENCY RESOLUTION FAILED — ${error.message}`);
  process.exit(1);
}
