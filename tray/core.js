#!/usr/bin/env node
'use strict';
// PromptGate tray engine bridge. The PowerShell host never parses prompt text itself: it writes a
// request JSON file, runs this script, and reads the result JSON file (UTF-8 both ways, so
// PowerShell 5.1 console encoding and quoting never touch the text).
//
//   node tray/core.js --req <request.json> --out <result.json>
//       request: { "text": "...", "source": "<window title>", "origin": "selection|clipboard",
//                  "llm": false, "noLog": false }
//   node tray/core.js --ui [vi|en] [--out <file>]     UI strings for the host (menus, messages)
//   node tray/core.js --config [--out <file>]         effective tray config (defaults merged)
//   node tray/core.js "<prompt text>"  |  echo text | node tray/core.js      plain-text preview
//
// Exit code is 0 even on bad input: the result JSON carries { ok:false, reason, message }.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const cfgm = require(path.join(ROOT, 'scripts', 'lib', 'config.js'));
const packs = require(path.join(ROOT, 'scripts', 'lib', 'packs.js'));
const { t } = require(path.join(ROOT, 'scripts', 'lib', 'i18n.js'));
const C = require('./lib/compose');

const TRAY_DEFAULTS = {
  hotkey: 'Ctrl+Alt+P',   // global hotkey; "Ctrl+Shift+Space", "Win+Alt+G" ... also fine
  paste: false,           // after picking a version, paste it over the selection (Ctrl+V)
  llm: false,             // ask tier 2 (`claude -p`) on each score; false = button only
  enabled: true,
  node: '',               // explicit path to node.exe when it is not on PATH
  language: 'auto',       // popup/menu language: auto (follow the prompt) | vi | en
};

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function has(name) { return process.argv.includes(name); }
function writeOut(obj) {
  const out = arg('--out');
  const json = JSON.stringify(obj, null, 2);
  if (out) fs.writeFileSync(out, json, 'utf8'); else process.stdout.write(json + '\n');
}

function trayConfig() {
  const cfg = cfgm.loadConfig(process.cwd());
  const tray = Object.assign({}, TRAY_DEFAULTS, cfg.tray || {});
  return { cfg, tray };
}

function readStdin() {
  if (process.stdin.isTTY) return Promise.resolve('');
  return new Promise((resolve) => { let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (d) => (s += d)); process.stdin.on('end', () => resolve(s)); process.stdin.on('error', () => resolve(s)); });
}

async function score(req) {
  const { cfg, tray } = trayConfig();
  const pack = packs.load();
  const language = tray.language && tray.language !== 'auto' ? tray.language : cfg.language;
  const res = C.compose(req.text, { pack, language, source: req.source, origin: req.origin });
  if (!res.ok) return res;
  if (req.llm) {
    if (!cfgm.isPro()) res.llm = 'not_pro';
    else {
      try {
        const brain = require(path.join(ROOT, 'scripts', 'lib', 'brain-llm.js'));
        const a = require(path.join(ROOT, 'scripts', 'lib', 'engine.js')).analyze(String(req.text).trim(), { pack, language });
        const s = await brain.rewrite(String(req.text).trim(), a, cfg, t(a.lang));
        if (s) { C.applyLlm(res, s); res.llm = 'ok'; } else res.llm = 'failed';
      } catch (_) { res.llm = 'failed'; }
    }
  }
  if (!req.noLog) cfgm.appendLog({ action: 'tray', score: res.score, type: res.type, depth: res.depth, lang: res.lang, words: res.words, missing: res.missing, origin: res.origin || undefined, llm: res.viaLlm || undefined });
  return res;
}

(async () => {
  try {
    if (has('--ui')) {
      const want = arg('--ui');
      const lang = want && /^(vi|en)$/.test(want) ? want : (trayConfig().tray.language === 'en' ? 'en' : 'vi');
      return writeOut(Object.assign({ ok: true, lang }, C.strings(lang)));
    }
    if (has('--config')) {
      const { tray } = trayConfig();
      return writeOut({ ok: true, tray, home: cfgm.HOME, configFile: cfgm.FILES.config, logFile: cfgm.FILES.log, reports: cfgm.FILES.reports, pro: cfgm.isPro() });
    }
    const reqFile = arg('--req');
    if (reqFile) {
      let req = {};
      try { req = JSON.parse(fs.readFileSync(reqFile, 'utf8')); } catch (e) { return writeOut({ ok: false, reason: 'bad_request', message: 'request file unreadable: ' + e.message }); }
      return writeOut(await score(req || {}));
    }
    const plain = process.argv.slice(2).filter((x) => !x.startsWith('--')).join(' ').trim() || (await readStdin()).trim();
    const res = await score({ text: plain, noLog: true, llm: has('--llm') });
    if (has('--json')) return writeOut(res);
    process.stdout.write(C.toText(res) + '\n');
  } catch (e) {
    writeOut({ ok: false, reason: 'crash', message: String(e && e.stack || e) });
  }
})();
