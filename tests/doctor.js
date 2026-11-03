#!/usr/bin/env node
'use strict';
// Doctor tests: the pure helpers with synthetic input, then one real run with the
// environment-dependent checks (tray, office) skipped and a temp CLAUDE_CONFIG_DIR.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'promptgate-doctor-test-'));
process.env.CLAUDE_CONFIG_DIR = TMP;
process.env.CLAUDE_PLUGIN_ROOT = ROOT;

const D = require(path.join(ROOT, 'scripts/doctor.js'));
const VERSION = require(path.join(ROOT, 'scripts/lib/product.js')).version;

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); } }

console.log('doctor: pluginStatus');
let s = D.pluginStatus(null, ROOT, VERSION);
check('no registry → fail with install commands', s.level === 'fail' && /plugin install promptgate@promptgate/.test(s.msg));
s = D.pluginStatus({ plugins: { 'ecc@ecc': [{ version: '2.2.2' }] } }, ROOT, VERSION);
check('registry without promptgate → fail', s.level === 'fail' && s.installed === false);
s = D.pluginStatus({ plugins: { 'promptgate@promptgate': [{ version: VERSION, installPath: ROOT }] } }, ROOT, VERSION);
check('same version read from this folder → ok', s.level === 'ok' && /read from this folder/.test(s.msg));
s = D.pluginStatus({ plugins: { 'promptgate@promptgate': [{ version: '1.2.0', installPath: ROOT }] } }, ROOT, VERSION);
check('older registration but read in place → ok, folder version wins', s.level === 'ok' && s.version === VERSION && /registry still says 1\.2\.0/.test(s.msg));
s = D.pluginStatus({ plugins: { 'promptgate@promptgate': [{ version: '1.1.0', installPath: path.join(TMP, 'cache', 'promptgate', '1.1.0') }] } }, ROOT, VERSION, { promptgate: { source: { source: 'directory', path: ROOT }, installLocation: ROOT } });
check('marketplace sourced from this folder → ok even with a stale cache entry', s.level === 'ok' && /read from this folder/.test(s.msg));
s = D.pluginStatus({ plugins: { 'promptgate@promptgate': [{ version: '1.1.0', installPath: path.join(TMP, 'cache', 'promptgate', '1.1.0') }] } }, ROOT, VERSION, { promptgate: { source: { source: 'github', repo: 'huuthanhueh-debug/promptgate' }, installLocation: path.join(TMP, 'mk') } });
check('marketplace from GitHub with old cache → warn: claude plugin update', s.level === 'warn' && /claude plugin update/.test(s.msg));
s = D.pluginStatus({ plugins: { 'promptgate@promptgate': [{ version: '1.2.0', installPath: path.join(TMP, 'cache', 'promptgate') }] } }, ROOT, VERSION);
check('older install from GitHub → warn: claude plugin update', s.level === 'warn' && /claude plugin update promptgate@promptgate/.test(s.msg));
s = D.pluginStatus({ plugins: { 'promptgate@promptgate': { version: VERSION, installPath: '/elsewhere' } } }, ROOT, VERSION);
check('registry entry as object (not array) still parsed', s.level === 'ok' && s.version === VERSION);

console.log('doctor: extensionStale');
check('missing bundle → stale', D.extensionStale([1, 2, 3], 0) === true);
check('bundle newer than every source → fresh', D.extensionStale([100, 200], 300) === false);
check('one source newer than bundle → stale', D.extensionStale([100, 400], 300) === true);
check('no sources → fresh when bundle exists', D.extensionStale([], 1) === false);

console.log('doctor: parseTrayPids');
check('pids parsed from PowerShell lines', JSON.stringify(D.parseTrayPids('\r\n107232\r\n  2048 \r\n')) === '[107232,2048]');
check('empty or junk output → []', D.parseTrayPids('').length === 0 && D.parseTrayPids('Get-CimInstance : error').length === 0);

console.log('doctor: summarize');
let sum = D.summarize([{ name: 'plugin', level: 'ok', msg: 'a' }, { name: 'tray', level: 'warn', msg: 'b' }]);
check('warn only → exit 0, worst warn', sum.exitCode === 0 && sum.worst === 'warn' && sum.lines.length === 2);
sum = D.summarize([{ name: 'plugin', level: 'fail', msg: 'x' }, { name: 'hook', level: 'ok', msg: 'y' }]);
check('any fail → exit 1', sum.exitCode === 1 && /FAIL\s+plugin/.test(sum.lines[0]));
sum = D.summarize([{ name: 'office', level: 'skip', msg: 'z' }]);
check('skip only → exit 0', sum.exitCode === 0 && sum.worst === 'skip');

console.log('doctor: real run (tray + office skipped, temp config dir)');
fs.mkdirSync(path.join(TMP, 'plugins'), { recursive: true });
fs.writeFileSync(path.join(TMP, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'promptgate@promptgate': [{ scope: 'user', installPath: ROOT, version: VERSION }] } }));
const env = Object.assign({}, process.env, { PROMPTGATE_DOCTOR_SKIP: 'tray,office' });
let r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/doctor.js'), '--json'], { encoding: 'utf8', env, timeout: 60000 });
let o = null; try { o = JSON.parse(r.stdout); } catch (_) {}
check('--json exits 0 and parses', r.status === 0 && o && o.exitCode === 0, (r.stderr || r.stdout || '').slice(0, 200));
check('plugin ok, hook ok, extension reported', o && o.results.find((x) => x.name === 'plugin').level === 'ok' && o.results.find((x) => x.name === 'hook').level === 'ok' && !!o.results.find((x) => x.name === 'extension'), o && JSON.stringify(o.results).slice(0, 300));
check('tray and office skipped via PROMPTGATE_DOCTOR_SKIP', o && !o.results.some((x) => x.name === 'tray' || x.name === 'office'));
r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/doctor.js')], { encoding: 'utf8', env, timeout: 60000 });
check('human output has a header and a verdict line', r.status === 0 && new RegExp('^PromptGate ' + VERSION.replace(/\./g, '\\.') + ' doctor').test(r.stdout) && /All editions accounted for|Something is broken/.test(r.stdout), r.stdout.slice(0, 200));
fs.writeFileSync(path.join(TMP, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: {} }));
r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/doctor.js'), '--json'], { encoding: 'utf8', env, timeout: 60000 });
try { o = JSON.parse(r.stdout); } catch (_) { o = null; }
check('plugin missing → exit 1 with install commands', r.status === 1 && o && o.results[0].level === 'fail' && /plugin install/.test(o.results[0].msg));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
