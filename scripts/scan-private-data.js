#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'hf_export');
const REPORT = path.join(TARGET, 'reports/privacy_scan_report.md');
const failures = [];
const warnings = [];

const failPatterns = [
  { name: 'email address', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { name: 'Hugging Face token', re: /hf_[A-Za-z0-9]{20,}/g },
  { name: 'OpenAI key', re: /(?:sk-(?:proj|svcacct|admin)-[A-Za-z0-9_\-]{20,}|sk-[A-Za-z0-9]{32,})/g },
  { name: 'GitHub token', re: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'explicit token assignment', re: /(?:HF_TOKEN|OPENAI_API_KEY|GITHUB_TOKEN|STRIPE_SECRET_KEY)\s*=\s*[^\s]+/g }
];
const warnPatterns = [
  { name: 'North American phone-like string', re: /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g },
  { name: 'Google calendar/Gmail marker', re: /\b(?:X-GM-THRID|X-Google-Calendar|gmail\.com|calendar\.google\.com)\b/gi }
];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }
function textForPatternScan(text) {
  return String(text || '')
    .replace(/\"source_hash\"\s*:\s*\"[a-f0-9]{64}\"/gi, '\"source_hash\":\"[SHA256]\"');
}

function main() {
  if (!fs.existsSync(TARGET)) {
    console.error('hf_export does not exist. Run npm run export:meaninglib-dataset first.');
    process.exit(1);
  }
  const files = walk(TARGET);
  for (const file of files) {
    const r = rel(file);
    if (path.basename(file).toLowerCase() === '.env' || r.endsWith('/.env')) {
      failures.push(`${r}: .env file must never be uploaded`);
      continue;
    }
    const stat = fs.statSync(file);
    if (stat.size > 10 * 1024 * 1024) continue;
    let text = '';
    try { text = textForPatternScan(fs.readFileSync(file, 'utf8')); } catch { continue; }
    for (const p of failPatterns) {
      if (p.re.test(text)) failures.push(`${r}: ${p.name} pattern found`);
      p.re.lastIndex = 0;
    }
    for (const p of warnPatterns) {
      const matches = text.match(p.re);
      if (matches && matches.length) warnings.push(`${r}: ${p.name} pattern found (${matches.length})`);
      p.re.lastIndex = 0;
    }
  }
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  const report = `# Meaninglib privacy scan report

Generated: ${new Date().toISOString()}

Failures: ${failures.length}
Warnings: ${warnings.length}

## Failures

${failures.length ? failures.map(x => `- ${x}`).join('\n') : '- None'}

## Warnings

${warnings.length ? warnings.slice(0, 200).map(x => `- ${x}`).join('\n') : '- None'}
${warnings.length > 200 ? `\n- ${warnings.length - 200} additional warnings omitted from report.\n` : ''}
## Scan notes

- Email addresses are upload-blocking failures.
- Hugging Face tokens, OpenAI keys, GitHub tokens, AWS keys, and explicit token assignments are upload-blocking failures.
- Phone-like warnings are conservative and commonly catch ISBNs, DOIs, archive IDs, and library/catalogue numbers.
- source_hash checksum values are ignored during pattern scanning because they can resemble phone numbers.`;
  fs.writeFileSync(REPORT, report, 'utf8');
  if (failures.length) {
    console.error(`Privacy scan failed with ${failures.length} failure(s). See ${rel(REPORT)}`);
    process.exit(1);
  }
  console.log(`Privacy scan passed with ${warnings.length} warning(s). See ${rel(REPORT)}`);
}

main();
