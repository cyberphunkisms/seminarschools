#!/usr/bin/env node
'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const {resourceAccess,resourceDescription}=require('./build-search-pages');
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'teacherresources/resources-data.json')));
const entries=data.groups.flatMap(g=>g.categories.flatMap(c=>c.entries));
assert.equal(entries.length,646);
const counts={};
for(const entry of entries){const a=resourceAccess(entry);counts[a.value]=(counts[a.value]||0)+1;assert.ok(a.label);if(a.source_url){assert.ok(a.note);assert.ok(a.value.startsWith('publisher-'));}}
assert.equal(resourceAccess({url:'https://www.gutenberg.org/ebooks/45',format:'gutenberg-text'}).value,'publisher-free');
assert.equal(resourceAccess({url:'https://www.gutenberg.org.evil.example/ebooks/45',host:'gutenberg.org',format:'gutenberg-text'}).value,'unknown');
assert.equal(resourceAccess({url:'https://www.gutenberg.org/unrelated',format:'gutenberg-text'}).value,'unknown');
assert.equal(resourceAccess({url:'https://openstax.org/books/biology-2e/pages/preface',format:'openstax-book'}).value,'publisher-free');
assert.equal(resourceAccess({url:'https://www.inquirygroup.org/history-lessons/example',format:'lesson-page'}).value,'publisher-account');
assert.equal(resourceAccess({url:'https://archive.org/details/example',format:'full-book'}).value,'publisher-variable');
assert.equal(resourceAccess({url:'https://www.gutenberg.org/ebooks/45',format:'gutenberg-text',access:'unavailable'}).value,'unavailable');
assert.equal(resourceAccess({url:'/teacherresources/nonexistent-file.pdf'}).value,'unknown');
assert.ok(!resourceDescription({grade:'all',format:'lesson-page'}, {},{},data).includes('Multi-grade'));
assert.equal(counts.direct,15);assert.equal(counts.unavailable,4);
const report={schema:'teacher-resource-metadata-coverage-v1',status:'passed',resources:entries.length,access_counts:counts,publisher_policy_records:Object.entries(counts).filter(([k])=>k.startsWith('publisher-')).reduce((n,[k,v])=>n+v,0),curriculum_unrecorded:entries.filter(e=>!e.curriculum).length,grade_unspecified:entries.filter(e=>!e.grade||e.grade==='all').length,item_level_external_review_completed:false};
fs.writeFileSync(path.join(ROOT,'scripts/reports/teacher-resource-metadata-coverage-20260928.json'),JSON.stringify(report,null,2)+'\n');
console.log('TEACHER METADATA CHECK PASSED '+JSON.stringify(report));
