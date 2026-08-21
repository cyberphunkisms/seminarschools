'use strict';

// The keyboard helper has its own cache identity. It must not inherit the
// unrelated type/reflow stylesheet version merely because both are sitewide.
const SITEWIDE_KEYBOARD_VERSION = '20260725-audit45';

module.exports = { SITEWIDE_KEYBOARD_VERSION };
