'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'promptgate');
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..', '..');
const FILES = {
  config: path.join(HOME, 'config.json'),
  state: path.join(HOME, 'state.json'),
  license: path.join(HOME, 'license.json'),
  log: path.join(HOME, 'log.jsonl'),
  history: path.join(HOME, 'history.json'),
  reports: path.join(HOME, 'reports'),
  packs: path.join(HOME, 'packs'),
};

const MODES = {
  strict: { blockBelow: 70, showBelow: 101 },
  balanced: { blockBelow: 50, showBelow: 75 },
  gentle: { blockBelow: 30, showBelow: 0 },
  off: { blockBelow: 0, showBelow: 0 },
};

const DEFAULTS = {
  mode: 'balanced',
  action: 'suggest',       // suggest (Claude proposes A/B/C rewrites with buttons) | block (classic gate)
  brain: 'rules',          // rules | llm
  language: 'auto',        // auto | vi | en
  minWords: 6,
  cooldownSec: 120,
  inject: true,            // additionalContext for deep tasks in the mid band
  llmModel: 'haiku',
  llmTimeoutMs: 20000,
};

function ensureHome() { try { fs.mkdirSync(HOME, { recursive: true }); } catch (_) {} }
function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return fallback; } }
function writeJson(p, obj) { ensureHome(); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

function loadConfig(cwd) {
  const user = readJson(FILES.config, {});
  const project = cwd ? readJson(path.join(cwd, '.promptgate.json'), {}) : {};
  const cfg = Object.assign({}, DEFAULTS, user, project);
  const m = MODES[cfg.mode] || MODES.balanced;
  cfg.blockBelow = cfg.blockBelow != null && user.blockBelow != null ? cfg.blockBelow : m.blockBelow;
  cfg.showBelow = cfg.showBelow != null && user.showBelow != null ? cfg.showBelow : m.showBelow;
  if (project.blockBelow != null) cfg.blockBelow = project.blockBelow;
  if (project.showBelow != null) cfg.showBelow = project.showBelow;
  return cfg;
}
function saveConfig(patch) { const cur = readJson(FILES.config, {}); const next = Object.assign({}, cur, patch); writeJson(FILES.config, next); return next; }

function loadState() { return readJson(FILES.state, {}); }
function saveState(s) {
  // keep the file small: drop sessions older than 2 days
  const cutoff = Date.now() - 2 * 86400e3;
  for (const k of Object.keys(s)) { const t = Date.parse(s[k].lastSeen || 0); if (t && t < cutoff) delete s[k]; }
  writeJson(FILES.state, s);
}

function loadLicense() { return readJson(FILES.license, null); }
// Since 1.3.0 everything in PromptGate is free: the former Pro packs ship in <plugin>/packs and the
// tier-2 rewrite needs no key. isPro() stays for compatibility with older callers and always returns true.
function isPro() { return true; }

function appendLog(entry) {
  try { ensureHome(); fs.appendFileSync(FILES.log, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, entry)) + '\n'); } catch (_) {}
}
function readLog(days) {
  const since = Date.now() - (days || 7) * 86400e3;
  let txt = ''; try { txt = fs.readFileSync(FILES.log, 'utf8'); } catch (_) { return []; }
  const out = [];
  for (const line of txt.split('\n')) { if (!line) continue; try { const o = JSON.parse(line); if (Date.parse(o.ts) >= since) out.push(o); } catch (_) {} }
  return out;
}

module.exports = { HOME, PLUGIN_ROOT, FILES, MODES, DEFAULTS, loadConfig, saveConfig, loadState, saveState, loadLicense, isPro, appendLog, readLog, readJson, writeJson, ensureHome };
