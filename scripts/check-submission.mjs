#!/usr/bin/env node
// Submission readiness check. Node built-ins only. Run from anywhere:
//   node scripts/check-submission.mjs
// Prints PASS / FAIL / MANUAL per item. Exit code 1 if any FAIL. Reads files only.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const add = (id, status, text, detail = '') => results.push({ id, status, text, detail });

function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : null);
const isIgnored = (p) => git(['check-ignore', '-q', p]) !== null; // exit 0 -> ignored
const tracked = (git(['ls-files']) ?? '').split('\n').filter(Boolean);

// 1. LICENSE
const license = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find((f) => existsSync(join(root, f)));
const licenseText = license ? read(license) : null;
const licenseName = licenseText
  ? /MIT License/i.test(licenseText) ? 'MIT'
    : /Apache License/i.test(licenseText) ? 'Apache-2.0'
    : /GNU GENERAL PUBLIC/i.test(licenseText) ? 'GPL'
    : /BSD/i.test(licenseText) ? 'BSD' : 'unknown'
  : null;
add('1', license ? 'PASS' : 'FAIL', 'LICENSE file at repo root', license ? `${license} (${licenseName})` : 'not found');

// 2. .kiro present and not ignored
const kiroExists = existsSync(join(root, '.kiro'));
const kiroIgnored = kiroExists && (isIgnored('.kiro') || isIgnored('.kiro/specs') || isIgnored('.kiro/steering') || isIgnored('.kiro/hooks'));
const kiroTracked = tracked.filter((f) => f.startsWith('.kiro/')).length;
add('2', kiroExists && !kiroIgnored && kiroTracked > 0 ? 'PASS' : 'FAIL', '.kiro/ at repo root, not ignored, tracked by git', `exists=${kiroExists} ignored=${kiroIgnored} trackedFiles=${kiroTracked}`);

// 3. specs, steering, hooks have files
const counts = {};
for (const d of ['specs', 'steering', 'hooks']) {
  const dir = join(root, '.kiro', d);
  counts[d] = existsSync(dir) ? readdirSync(dir).length : 0;
}
add('3', Object.values(counts).every((n) => n > 0) ? 'PASS' : 'FAIL', '.kiro/specs, steering and hooks contain files', JSON.stringify(counts));

// 4. secrets
const patterns = [
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['OpenAI-style key', /sk-[A-Za-z0-9]{20,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Hard-coded secret', /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_\-/+=]{16,}['"]/i],
];
const skip = /(^|\/)(package-lock\.json|\.playwright-mcp\/|scripts\/check-submission\.mjs$)|\.(png|jpg|jpeg|gif|webp|ico|wasm|onnx|woff2?|pdf)$/i;
const envFiles = tracked.filter((f) => /(^|\/)\.env(\.|$)/.test(f));
const hits = [];
for (const f of tracked) {
  if (skip.test(f) || !existsSync(join(root, f))) continue;
  let text;
  try {
    if (statSync(join(root, f)).size > 2_000_000) continue;
    text = readFileSync(join(root, f), 'utf8');
  } catch { continue; }
  for (const [name, re] of patterns) if (re.test(text)) hits.push(`${f}: ${name}`);
}
add('4', envFiles.length === 0 && hits.length === 0 ? 'PASS' : 'FAIL', 'No .env files or secret patterns in tracked files', [...envFiles.map((f) => `tracked env file: ${f}`), ...hits].join('; ') || `${tracked.length} tracked files scanned`);

// 5. README
const readme = read('README.md') ?? '';
const readmeIssues = [];
const placeholders = readme.match(/<[A-Za-z][^>\n]{0,40}>/g)?.filter((m) => !/^<\/?(br|img|a|details|summary|p|div|code|kbd)\b/i.test(m)) ?? [];
if (!readme) readmeIssues.push('README.md missing');
if (/Live app:\*{0,2}\s*<|\*\*Live app:\*\*\s*<URL>/i.test(readme) || !/https?:\/\/[^\s)]+/.test((readme.match(/Live app:.*$/im) ?? [''])[0])) readmeIssues.push('live app URL is a placeholder');
if (!/https?:\/\/[^\s)]+/.test((readme.match(/Demo video:.*$/im) ?? [''])[0])) readmeIssues.push('demo video URL is a placeholder');
if (!/## (Run locally|Getting started|Install|How to run)/i.test(readme)) readmeIssues.push('no how-to-run section');
if (!/Kiro/i.test(readme) || !/## Kiro/i.test(readme)) readmeIssues.push('no "how Kiro was used" section');
if (!/## Third-party/i.test(readme)) readmeIssues.push('no third-party software list');
if (!/## License/i.test(readme)) readmeIssues.push('no License section');
add('5', readmeIssues.length === 0 ? 'PASS' : 'FAIL', 'README has live URL, demo URL, how to run, how Kiro was used, third-party list, license', readmeIssues.join('; ') || 'ok');
if (placeholders.length) add('5b', 'FAIL', 'README still has placeholders containing "<"', [...new Set(placeholders)].join(' '));

// 6. write-up placeholders
const writeup = read('KIRO_WRITEUP.md');
const wl = (writeup ?? '').split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /<ADD|<Your|<If |<Which|<Name|<How |<What |<Add |<Say /.test(l));
add('6', writeup && wl.length === 0 ? 'PASS' : 'FAIL', 'KIRO_WRITEUP.md has no unfilled placeholders', writeup ? (wl.map(([n]) => `line ${n}`).join(', ') || 'ok') : 'file missing');

// 7. ignored and untracked
const pw = tracked.filter((f) => f.startsWith('.playwright-mcp/')).length;
const nm = tracked.filter((f) => /(^|\/)node_modules\//.test(f)).length;
const ign = { '.playwright-mcp': isIgnored('.playwright-mcp'), 'haunted-notes/node_modules': isIgnored('haunted-notes/node_modules') };
add('7', pw === 0 && nm === 0 && Object.values(ign).every(Boolean) ? 'PASS' : 'FAIL', '.playwright-mcp/ and node_modules/ ignored and not tracked', `ignored=${JSON.stringify(ign)} trackedPlaywright=${pw} trackedNodeModules=${nm}`);

// 8. pinned dependencies
const pkgText = read('haunted-notes/package.json');
const loose = [];
if (pkgText) {
  const pkg = JSON.parse(pkgText);
  for (const sect of ['dependencies', 'devDependencies']) {
    for (const [n, v] of Object.entries(pkg[sect] ?? {})) if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v)) loose.push(`${n}@${v}`);
  }
}
add('8', pkgText && loose.length === 0 ? 'PASS' : 'FAIL', 'package.json dependencies are exact versions', pkgText ? (loose.join(', ') || 'ok') : 'package.json missing');

// Cannot be checked from files
for (const [id, text] of [
  ['M1', 'GitHub repository is public'],
  ['M2', 'Demo video on YouTube is public and under 3 minutes, no copyrighted music'],
  ['M3', 'Live app URL is reachable'],
  ['M4', 'Student prize details (LinkedIn, student email, school, year, degree)'],
  ['M5', 'Devpost form: category, and "Ghost of Kiroween Past" box if it applies'],
  ['M6', 'Blog post published during the submission period; social post starts with #KiroweenHackathon26'],
]) add(id, 'MANUAL', text);

for (const r of results) console.log(`${r.status.padEnd(6)} ${r.id.padEnd(3)} ${r.text}${r.detail ? `\n         ${r.detail}` : ''}`);
const fails = results.filter((r) => r.status === 'FAIL').length;
console.log(`\n${results.filter((r) => r.status === 'PASS').length} PASS, ${fails} FAIL, ${results.filter((r) => r.status === 'MANUAL').length} MANUAL`);
process.exit(fails ? 1 : 0);