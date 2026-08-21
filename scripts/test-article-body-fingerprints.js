#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { fingerprintArticle } = require('./lib/article-body-fingerprint');

const base = '<header>Old title</header><article class="layout-a"><div><h1>Authored title</h1><p>Exact prose <a href="https://example.org/source">with evidence</a>.</p></div><nav>Next</nav></article><footer>Old footer</footer>';
const chromeChanged = '<header>New navigation</header><article class="layout-b" data-view="wide"><section><h1 id="new-id">Authored title</h1><p class="lede">Exact prose <a class="source" href="https://example.org/source">with evidence</a>.</p></section><nav>Different next link</nav></article><footer>New footer</footer>';
const proseChanged = base.replace('Exact prose', 'Shortened prose');
const sourceChanged = base.replace('https://example.org/source', 'https://example.org/other');
const failureFixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'futureproofing', 'article-body', 'changed-prose.html'), 'utf8');

assert.equal(fingerprintArticle(base).sha256, fingerprintArticle(chromeChanged).sha256, 'chrome/layout changes must be allowed');
assert.notEqual(fingerprintArticle(base).sha256, fingerprintArticle(proseChanged).sha256, 'authored prose changes must fail');
assert.notEqual(fingerprintArticle(base).sha256, fingerprintArticle(sourceChanged).sha256, 'authored destination changes must fail');
assert.notEqual(fingerprintArticle(base).sha256, fingerprintArticle(failureFixture).sha256, 'changed-prose fixture must fail the baseline fingerprint');
assert.throws(() => fingerprintArticle('<main>No article</main>'), /Expected exactly one/);
console.log('ARTICLE BODY FINGERPRINT TESTS PASS — chrome/layout allowed; prose and source mutations detected.');
