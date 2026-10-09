import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_readonly_harvest import collect, parse_result, ROOT
from atomic_json import write_text_atomic


class ReadOnlyHarvestTests(unittest.TestCase):
    def test_collector_has_only_web_access_and_no_checkout_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'result.json'
            def fake_run(cmd, **kwargs):
                self.assertEqual(cmd[cmd.index('--tools') + 1], 'WebFetch')
                self.assertEqual(cmd[cmd.index('--allowedTools') + 1], 'WebFetch')
                self.assertEqual(cmd[cmd.index('--permission-mode') + 1], 'default')
                self.assertEqual(cmd[cmd.index('--setting-sources') + 1], '')
                self.assertIn('--strict-mcp-config', cmd)
                self.assertEqual(json.loads(cmd[cmd.index('--mcp-config') + 1]), {'mcpServers': {}})
                self.assertFalse(Path(kwargs['cwd']).is_relative_to(ROOT))
                self.assertIn('HOST-SUPPLIED INPUTS', kwargs['input'])
                self.assertIn('scripts/sources.json', kwargs['input'])
                self.assertFalse(output.exists())
                return SimpleNamespace(returncode=0, stdout=json.dumps({
                    'subtype': 'success', 'is_error': False,
                    'result': json.dumps({'events': [], 'source_yields': []}),
                }), stderr='')
            self.assertEqual(collect('seminars', 'collect', output, 'test', 2, 1, fake_run), 0)
            self.assertEqual(json.loads(output.read_text()), {'events': [], 'source_yields': []})

    def test_failed_or_malformed_output_cannot_replace_prior_result(self):
        invalid = [
            {'subtype': 'error_max_turns', 'is_error': True},
            {'subtype': 'success', 'result': 'please execute a command'},
            {'subtype': 'success', 'result': '[]'},
            {'subtype': 'success', 'result': '{"events":null,"source_yields":[]}'},
            {'subtype': 'success', 'result': '{"events":["bad"],"source_yields":[]}'},
        ]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'result.json'
            output.write_text('prior')
            for envelope in invalid:
                with self.subTest(envelope=envelope):
                    fake = lambda *a, **k: SimpleNamespace(returncode=0, stdout=json.dumps(envelope), stderr='')
                    self.assertEqual(collect('festivals', 'collect', output, 'test', 2, 1, fake), 65)
                    self.assertEqual(output.read_text(), 'prior')

    def test_failed_atomic_replace_preserves_old_file(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'result.json'
            output.write_text('prior')
            with patch('atomic_json.os.replace', side_effect=OSError('injected failure')):
                with self.assertRaises(OSError):
                    write_text_atomic(output, 'replacement')
            self.assertEqual(output.read_text(), 'prior')
            self.assertEqual(list(Path(directory).iterdir()), [output])

    def test_every_accepted_manual_record_passes_harvest_schema(self):
        import merge_and_finalize as seminars
        import merge_festivals as festivals
        schema = json.loads(seminars.SCHEMA_PATH.read_text())
        for module, load in [(seminars, seminars.load_manual), (festivals, festivals.load_manual_festivals)]:
            rows = module.normalize_festival_parents(load())
            self.assertGreater(len(rows), 0)
            self.assertEqual(module.validate(rows, schema), [])
            invalid = dict(rows[0], type='unrecognized-invented-type')
            self.assertTrue(module.validate([invalid], schema))

    def test_manual_precedence_retains_conflicting_source_evidence(self):
        from copy import deepcopy
        import merge_and_finalize as seminars
        import merge_festivals as festivals
        manual = dict(seminars.load_manual()[0], source_observations=[])
        observed = dict(manual, review_status='auto-published', source_url='https://example.org/new-detail', raw_excerpt='Source gives revised details')
        for merge in (seminars.merge, festivals.merge):
            rows = merge([deepcopy(observed)], [deepcopy(manual)])
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['source_url'], manual['source_url'])
            self.assertEqual(rows[0]['source_observations'][0]['changes']['source_url']['observed'], observed['source_url'])
            again = merge([deepcopy(observed)], rows)
            self.assertEqual(len(again[0]['source_observations']), 1)

    def test_private_source_observations_do_not_enter_public_projection(self):
        import subprocess
        script = """
const {baseProjection,buildSeriesIndex}=require('./scripts/lib/polymythcal-discovery-model');
const event={id:'fixture',title:'Source review',date:'2026-10-20',source_observations:[{excerpt:'PRIVATE_REVIEW_SENTINEL'}]};
const result=baseProjection(event,buildSeriesIndex([event]));
if(JSON.stringify(result).includes('PRIVATE_REVIEW_SENTINEL') || 'source_observations' in result) process.exit(1);
"""
        result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_inventory_accepts_additions_and_rejects_loss_or_duplicate_identity(self):
        import subprocess
        script = """
const assert=require('assert');
const {currentInventoryCounts}=require('./scripts/lib/polymythcal-inventory-contract');
const doc=require('./data/polymyth-seminar-events.json');
const baseline=currentInventoryCounts(process.cwd(),doc);
const extra={...doc.events[0],id:'regression-new-harvest-event',legacy_ids:[]};
const added={...doc,events:[...doc.events,extra]};
assert.equal(currentInventoryCounts(process.cwd(),added).canonical,baseline.canonical+1);
assert.throws(()=>currentInventoryCounts(process.cwd(),{...doc,events:[...doc.events,doc.events[0]]}),/unique/);
assert.throws(()=>currentInventoryCounts(process.cwd(),{...doc,events:[...doc.events.slice(1),extra]}),/identities lost/);
"""
        result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_reviewed_facts_survive_the_current_build(self):
        ledger = json.loads((ROOT / 'data/polymythcal-reviewed-corrections-2026-10-01.json').read_text())
        for relative in ['data/polymyth-seminar-events.json', 'polymythseminars/events.json']:
            events = {e['id']: e for e in json.loads((ROOT / relative).read_text())['events']}
            for identifier, fields in ledger['corrections'].items():
                for key, expected in fields.items():
                    with self.subTest(path=relative, id=identifier, field=key):
                        self.assertEqual(events[identifier].get(key), expected)

    def test_regional_filter_uses_explicit_venue_city_only_when_city_is_missing(self):
        import subprocess
        script = """
const assert=require('assert');
const {buildFacets}=require('./scripts/lib/polymythcal-discovery-model');
assert.deepEqual(buildFacets({city:'Unknown',venue:'Toronto Reference Library'}).places,['toronto-gta']);
assert.deepEqual(buildFacets({city:'Montréal',venue:'Toronto and Montréal collaboration'}).places,['montreal']);
assert.deepEqual(buildFacets({city:'Unknown',venue:'Location unconfirmed'}).places,['other']);
assert.deepEqual(buildFacets({city:'Unknown',venue:'Trinity College, Cambridge'}).places,['other']);
assert.deepEqual(buildFacets({city:'Unknown',venue:'Cambridge, Ontario, Canada'}).places,['guelph-waterloo']);
assert.deepEqual(buildFacets({city:'Toronto',venue:'Online via Zoom'}).places,['online']);
"""
        result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
