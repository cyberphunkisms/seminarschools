'use strict';

// Shared cache identity for the reader-wide type/reflow contract. Generators
// and the final all-page link normalizer must never ship different tokens.
const SITEWIDE_TYPE_ZOOM_VERSION = '20260814-reader-word-integrity';

module.exports = { SITEWIDE_TYPE_ZOOM_VERSION };
