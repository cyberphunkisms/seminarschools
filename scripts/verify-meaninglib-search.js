#!/usr/bin/env node
/* Verify local Meaninglib search retrieves the correct star-file ontology anchors. */
const fs = require('fs');
const path = require('path');
const { search } = require('./query-meaninglib.js');
const {generatedAt} = require('./lib/deterministic-timestamp');

const root = process.cwd();
const reportTimestamp = generatedAt();
const indexPath = path.join(root, 'hf_export', 'search', 'meaninglib_search_index.json');
const reportsDir = path.join(root, 'hf_export', 'reports');
const reportPath = path.join(reportsDir, 'meaninglib_search_verify_report.md');

function fail(msg, lines) {
  console.error(`FAIL: ${msg}`);
  if (lines) {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
    console.error(`Report: ${path.relative(root, reportPath).replace(/\\/g, '/')}`);
  }
  process.exit(1);
}

function pass(msg) { console.log(`PASS: ${msg}`); }
function resultText(r) {
  const d = r.doc;
  return `${d.id} ${d.title} ${d.star_file} ${d.section || ''} ${d.source_path} ${d.preview || ''}`.toLowerCase();
}
function hasResult(results, predicate) { return results.some(predicate); }
function topResult(results, predicate) { return results.length > 0 && predicate(results[0]); }
function topThree(results, predicate) { return results.slice(0, 3).some(predicate); }
function isIdentityMap(r, star, name) {
  return r.doc.star_file === star && String(r.doc.source_path || '').includes('star_file_map') && resultText(r).includes(name);
}

function main() {
  if (!fs.existsSync(indexPath)) fail('Meaninglib search index missing. Run BUILD_MEANINGLIB_SEARCH.bat first.');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if ((index.total_docs || 0) < 1900) fail(`index has too few docs: ${index.total_docs}`);
  pass(`index doc count ${index.total_docs}`);
  if (process.env.MEPHISTODATA_GENERATED_AT || process.env.SOURCE_DATE_EPOCH) {
    const expectedTimestamp = generatedAt();
    if (index.generated_at !== expectedTimestamp) fail(`index timestamp ${index.generated_at} differs from deterministic build timestamp ${expectedTimestamp}`);
    pass(`index timestamp matches deterministic build timestamp ${expectedTimestamp}`);
  }
  if (!String(index.ontology_lock || '').includes('interdependent access routes')) fail('ontology lock missing interdependence language');
  pass('ontology lock states interdependence');
  if (index.docs.some(d => d.star_file === 'report')) fail('generated reports are still in default retrieval index');
  pass('generated reports excluded from default retrieval index');

  const tests = [
    {
      name: 'Meaninglib ontology top result is README or relations',
      query: 'Meaninglib ontology',
      check: results => topResult(results, r => ['readme','relations'].includes(r.doc.star_file) && resultText(r).includes('meaninglib'))
    },
    {
      name: 'Interdependence rule top result is ontology anchor',
      query: 'interdependence rule',
      check: results => topResult(results, r => ['readme','relations'].includes(r.doc.star_file) && resultText(r).includes('interdepend')) || topThree(results, r => resultText(r).includes('interdependent definition'))
    },
    {
      name: 'Rejected ML hierarchy language retrieves ontology guard',
      query: 'ML* hierarchy language governs BB*',
      check: results => hasResult(results, r => ['readme','relations'].includes(r.doc.star_file) && resultText(r).includes('meaninglib'))
    },
    {
      name: 'Stop psychologism rule top result retrieves ml* rule',
      query: 'stop psychologism',
      check: results => topResult(results, r => r.doc.star_file === 'ml' && resultText(r).includes('stop psychologism'))
    },
    {
      name: 'AI prose tells law review top result retrieves ml* rule',
      query: 'AI prose tells',
      check: results => topResult(results, r => r.doc.star_file === 'ml' && resultText(r).includes('ai prose tells'))
    },
    {
      name: 'Degorgonified feminism exact label retrieves stable Gorgonwars owner at top',
      query: 'degorgonified feminism',
      check: results => topResult(results, r => (
        r.doc.id === 'ml:gorgonification:gorgonwars:ddd5443ed9cc'
        && r.doc.title === 'Gorgonwars'
      ))
    },
    {
      name: 'Bookwormburrows identity query retrieves bb* identity at top',
      query: 'bookwormburrows',
      check: results => topResult(results, r => isIdentityMap(r, 'bb', 'bookwormburrows') || (r.doc.star_file === 'bb' && resultText(r).includes('bookwormburrows')))
    },
    {
      name: 'Bookwormburrows query tolerates stray slash/quote',
      query: 'bookwormburrows\\"',
      check: results => topResult(results, r => isIdentityMap(r, 'bb', 'bookwormburrows') || (r.doc.star_file === 'bb' && resultText(r).includes('bookwormburrows')))
    },
    {
      name: 'Modulecanon identity query retrieves mc* identity at top',
      query: 'modulecanon',
      check: results => topResult(results, r => isIdentityMap(r, 'mc', 'modulecanon') || (r.doc.star_file === 'mc' && resultText(r).includes('modulecanon')))
    },
    {
      name: 'Campaigncodex identity query retrieves cc* identity at top',
      query: 'campaigncodex',
      check: results => topResult(results, r => isIdentityMap(r, 'cc', 'campaigncodex') || (r.doc.star_file === 'cc' && resultText(r).includes('campaigncodex')))
    },
    {
      name: 'HTML txt mirror query retrieves dual-write sync rule',
      query: 'HTML txt mirror',
      check: results => topThree(results, r => r.doc.star_file === 'ml' && /dual[-\s]?write/.test(resultText(r)) && resultText(r).includes('html'))
    },
    {
      name: 'Constructor token cannot enter scores through Object prototype inheritance',
      query: 'constructor project',
      check: results => results.length >= 3 && results.every(result => Number.isFinite(result.score))
    },
    {
      name: 'Current non-strawman adjudication query retrieves the current-position substrate',
      query: 'current non-strawman project comparison Polycognate genealogy always-already boundaries',
      check: results => topThree(results, result => /non[-\s]?strawman|strongest actual claim|user ruling|current[-\s]?position/.test(resultText(result)))
    },
    {
      name: 'Polycognate examples query retrieves structural-position explanation',
      query: 'individual Polycognate claims examples structural position same operation',
      check: results => topThree(results, result => resultText(result).includes('polycognate') && /structural position|same operation|complex axiom/.test(resultText(result)))
    },
    {
      name: 'Boundary genealogy query retrieves the historical-scope control',
      query: 'boundaries historical genealogy structural analogy direct transmission',
      check: results => results.slice(0, 5).some(result => resultText(result).includes('boundaries-as-therapeutic-in-group-gating'))
    },
    {
      name: 'Detienne query retrieves the always-already supporting adjudication',
      query: 'Detienne comparison point in favor always-already',
      check: results => topThree(results, result => resultText(result).includes('detienne') && /always[-\s]?already|point in favor/.test(resultText(result)))
    },
    {
      name: 'Clastres source query ranks the cited source rather than a handler',
      query: 'Clastres Society Against the State source project',
      check: results => topResult(results, result => result.doc.section === 'citation' && resultText(result).includes('clastres') && resultText(result).includes('society against the state'))
    }
  ];

  const report = [
    '# Meaninglib search verification report',
    '',
    `Generated: ${reportTimestamp}`,
    '',
    `Index: hf_export/search/meaninglib_search_index.json`,
    `Documents: ${index.total_docs}`,
    '',
    '## Test results',
    ''
  ];

  for (const test of tests) {
    const results = search(test.query, 10);
    const ok = test.check(results);
    report.push(`### ${ok ? 'PASS' : 'FAIL'}: ${test.name}`);
    report.push('');
    report.push(`Query: ${test.query}`);
    report.push('');
    results.slice(0, 5).forEach((r, i) => {
      report.push(`${i + 1}. [${r.doc.star_file}] ${r.doc.title} (${r.score.toFixed(2)})`);
      report.push(`   - ${r.doc.source_path}`);
    });
    report.push('');
    if (!ok) fail(test.name, report);
    pass(test.name);
  }

  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(reportPath, report.join('\n'), 'utf8');
  console.log(`Meaninglib search verification passed.`);
  console.log(`Report: ${path.relative(root, reportPath).replace(/\\/g, '/')}`);
}

main();
