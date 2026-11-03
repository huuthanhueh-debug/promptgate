#!/usr/bin/env node
'use strict';
// /promptgate:doctor — are all three editions running on this machine?
//   plugin    Claude Code plugin registered + the hook answers a weak prompt
//   tray      Windows tray (Ctrl+Alt+P) process alive            --fix starts it
//   extension claude.ai bundle in extension/dist up to date       --fix rebuilds it
//   office    optional: the virtual-office widget on :7788 (only reported when reachable)
// Exit 0 when nothing failed; 1 when the plugin or the hook is broken. `--json` prints machine output.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRODUCT = require('./lib/product');
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

// ---------- pure helpers (unit-tested in tests/doctor.js) ----------

// registry = parsed ~/.claude/plugins/installed_plugins.json; marketplaces = known_marketplaces.json.
// A marketplace whose source is this folder means Claude Code reads the plugin in place (the registry
// version is then stale by design), so the folder version is the truth.
function pluginStatus(registry, repoRoot, version, marketplaces) {
  const plugins = (registry && registry.plugins) || {};
  const key = Object.keys(plugins).find((k) => k.startsWith('promptgate@'));
  if (!key) return { level: 'fail', installed: false, msg: 'not installed: claude plugin marketplace add huuthanhueh-debug/promptgate && claude plugin install promptgate@promptgate' };
  const e = (Array.isArray(plugins[key]) ? plugins[key] : [plugins[key]]).find(Boolean) || {};
  const mk = marketplaces && (marketplaces.promptgate || (marketplaces.marketplaces || {}).promptgate);
  const mkPath = mk && (mk.installLocation || (mk.source && mk.source.path));
  const same = (p) => !!p && path.resolve(p).toLowerCase() === path.resolve(repoRoot).toLowerCase();
  const inPlace = same(e.installPath) || same(mkPath);
  if (inPlace) return { level: 'ok', installed: true, version, msg: `${key} ${version} (read from this folder${e.version && e.version !== version ? '; registry still says ' + e.version : ''})` };
  if (e.version && e.version !== version) return { level: 'warn', installed: true, version: e.version, msg: `installed ${e.version}, latest is ${version}: claude plugin update ${key}` };
  return { level: 'ok', installed: true, version: e.version || version, msg: `${key} ${e.version || version}` };
}

// newest source mtime vs the bundle: stale when the bundle is missing or older than any input
function extensionStale(sourceMtimes, distMtime) {
  if (!distMtime) return true;
  return sourceMtimes.some((m) => m > distMtime);
}

// PowerShell output (one PID per line) → numbers; anything else is ignored
function parseTrayPids(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => /^\d+$/.test(l)).map(Number);
}

function summarize(results) {
  const order = { fail: 0, warn: 1, ok: 2, skip: 3 };
  const worst = results.reduce((w, r) => (order[r.level] < order[w] ? r.level : w), 'skip');
  return { exitCode: worst === 'fail' ? 1 : 0, worst, lines: results.map((r) => `${pad(r.level)} ${r.name.padEnd(9)} ${r.msg}`) };
}
const pad = (lvl) => ({ ok: '  ok  ', warn: ' warn ', fail: ' FAIL ', skip: ' skip ' })[lvl] || lvl;

// ---------- environment checks ----------

function checkPlugin() {
  const reg = readJson(path.join(CONFIG_DIR, 'plugins', 'installed_plugins.json'));
  const mks = readJson(path.join(CONFIG_DIR, 'plugins', 'known_marketplaces.json'));
  const s = pluginStatus(reg, ROOT, PRODUCT.version, mks);
  return Object.assign({ name: 'plugin' }, s);
}

function checkHook() {
  // fresh session id each run so cooldown / follow-up relaxation from a previous run cannot mask the result
  const input = JSON.stringify({ session_id: 'doctor-' + Date.now(), cwd: ROOT, hook_event_name: 'UserPromptSubmit', prompt: 'giúp tôi làm cái dashboard doanh thu cho khách sạn tuần này' });
  const env = Object.assign({}, process.env, { CLAUDE_PLUGIN_ROOT: ROOT });
  const r = spawnSync(process.execPath, ['-e', "require(require('path').join(process.env.CLAUDE_PLUGIN_ROOT,'scripts','gate.js'))"], { input, encoding: 'utf8', env, timeout: 15000 });
  let out = null; try { out = JSON.parse(r.stdout || '{}'); } catch (_) {}
  if (r.status !== 0 || !out) return { name: 'hook', level: 'fail', msg: 'gate.js crashed: ' + (r.stderr || '').trim().split('\n')[0] };
  if (out.systemMessage || out.decision) return { name: 'hook', level: 'ok', msg: (out.systemMessage || out.decision).slice(0, 70) };
  return { name: 'hook', level: 'warn', msg: 'gate answered {} for a weak prompt (mode off, or cooldown for session "doctor")' };
}

function trayPids() {
  if (process.platform !== 'win32') return [];
  const r = spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*PromptGate.ps1*' } | ForEach-Object { $_.ProcessId }"], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  return parseTrayPids(r.stdout);
}
function startTray() {
  const vbs = path.join(ROOT, 'tray', 'Start-Hidden.vbs');
  const p = spawn('wscript.exe', [vbs], { detached: true, stdio: 'ignore', windowsHide: true });
  p.unref();
}
function checkTray(fix) {
  if (process.platform !== 'win32') return { name: 'tray', level: 'skip', msg: 'Windows only' };
  let pids = trayPids();
  if (!pids.length && fix) {
    startTray();
    const until = Date.now() + 6000;
    while (!pids.length && Date.now() < until) { sleep(800); pids = trayPids(); }
    return pids.length ? { name: 'tray', level: 'ok', msg: `started (pid ${pids[0]}), Ctrl+Alt+P on any selected text` } : { name: 'tray', level: 'warn', msg: 'start attempted, not visible yet: run tray\\PromptGate.cmd' };
  }
  return pids.length ? { name: 'tray', level: 'ok', msg: `running (pid ${pids[0]}), Ctrl+Alt+P` } : { name: 'tray', level: 'warn', msg: 'not running: tray\\PromptGate.cmd or /promptgate:doctor --fix' };
}

function extensionInputs() {
  const files = [];
  const add = (dir, re) => { try { for (const f of fs.readdirSync(dir)) if (re.test(f)) files.push(path.join(dir, f)); } catch (_) {} };
  add(path.join(ROOT, 'scripts', 'lib'), /\.js$/);
  add(path.join(ROOT, 'packs'), /\.json$/);
  add(path.join(ROOT, 'extension', 'src'), /\.(js|json|html)$/);
  add(path.join(ROOT, 'extension', 'src', 'shims'), /\.js$/);
  files.push(path.join(ROOT, 'extension', 'build.js'));
  return files;
}
function checkExtension(fix) {
  const dist = path.join(ROOT, 'extension', 'dist', 'engine.js');
  const mt = (f) => { try { return fs.statSync(f).mtimeMs; } catch (_) { return 0; } };
  let stale = extensionStale(extensionInputs().map(mt), mt(dist));
  let note = '';
  if (stale && fix) {
    try { require(path.join(ROOT, 'extension', 'build.js')).build({ quiet: true }); stale = false; note = 'rebuilt, '; } catch (e) { return { name: 'extension', level: 'fail', msg: 'build failed: ' + e.message }; }
  }
  const ver = (readJson(path.join(ROOT, 'extension', 'src', 'manifest.json')) || {}).version || '?';
  if (stale) return { name: 'extension', level: 'warn', msg: 'dist older than sources: npm run build:ext (or --fix), then Reload at chrome://extensions' };
  return { name: 'extension', level: 'ok', msg: `${note}${ver} in extension/dist (if loaded unpacked, Reload at chrome://extensions after a rebuild)` };
}

async function checkOffice() {
  const url = process.env.PROMPTGATE_OFFICE_URL || 'http://127.0.0.1:7788/promptgate/stats';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { name: 'office', level: 'warn', msg: `HTTP ${r.status} from ${url}` };
    const j = await r.json();
    return { name: 'office', level: 'ok', msg: `widget on ${new URL(url).host}: ${(j.local && j.local.total) || 0} prompts scored here, GitHub ${j.github && j.github.latest}` };
  } catch (_) { return { name: 'office', level: 'skip', msg: 'virtual office not running (optional)' }; }
}

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

async function run(argv) {
  const fix = argv.includes('--fix');
  const skip = new Set((process.env.PROMPTGATE_DOCTOR_SKIP || '').split(',').filter(Boolean));
  const results = [];
  results.push(checkPlugin());
  if (!skip.has('hook')) results.push(checkHook());
  if (!skip.has('tray')) results.push(checkTray(fix));
  if (!skip.has('extension')) results.push(checkExtension(fix));
  if (!skip.has('office')) results.push(await checkOffice());
  const sum = summarize(results);
  if (argv.includes('--json')) console.log(JSON.stringify({ version: PRODUCT.version, fix, results, exitCode: sum.exitCode }, null, 2));
  else console.log([`PromptGate ${PRODUCT.version} doctor${fix ? ' (--fix)' : ''}`, ...sum.lines, sum.exitCode ? 'Something is broken: see FAIL lines.' : 'All editions accounted for.'].join('\n'));
  return sum.exitCode;
}

module.exports = { pluginStatus, extensionStale, parseTrayPids, summarize, run };
if (require.main === module) run(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => { console.error(e.message); process.exit(1); });
