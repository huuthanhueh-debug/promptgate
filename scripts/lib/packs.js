'use strict';
// Loads and merges pattern packs. Free packs ship in <plugin>/packs; Pro packs live in
// ~/.claude/promptgate/packs and are only merged when a valid license is present.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

function readPack(file) {
  try { const p = JSON.parse(fs.readFileSync(file, 'utf8')); p.__file = file; return p; } catch (e) { return null; }
}
function listJson(dir) {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(dir, f)); } catch (_) { return []; }
}

function merge(packs) {
  const out = { types: {}, priority: null, ids: [], tips: {} };
  for (const p of packs) {
    if (!p) continue;
    out.ids.push(p.id || path.basename(p.__file || 'pack', '.json'));
    for (const [t, d] of Object.entries(p.types || {})) {
      const cur = out.types[t] || { keywords: { vi: [], en: [] }, defaults: { output: {}, done: {} } };
      cur.keywords.vi = cur.keywords.vi.concat((d.keywords && d.keywords.vi) || []);
      cur.keywords.en = cur.keywords.en.concat((d.keywords && d.keywords.en) || []);
      for (const k of ['depth', 'needsContext', 'weight', 'askConstraints']) if (d[k] !== undefined) cur[k] = d[k];
      if (d.baseline) cur.baseline = Object.assign({}, cur.baseline || {}, d.baseline);
      if (d.defaults) {
        if (d.defaults.output) cur.defaults.output = Object.assign({}, cur.defaults.output, d.defaults.output);
        if (d.defaults.done) cur.defaults.done = Object.assign({}, cur.defaults.done, d.defaults.done);
      }
      out.types[t] = cur;
    }
    if (p.priority) out.priority = p.priority;
  }
  if (!out.types.general) out.types.general = { keywords: { vi: [], en: [] }, depth: 'standard', needsContext: 'medium', defaults: { output: {}, done: {} } };
  if (!out.types.question) out.types.question = { keywords: { vi: [], en: [] }, depth: 'light', needsContext: 'low', baseline: { output: 12, constraints: 10, acceptance: 7 }, defaults: { output: {}, done: {} } };
  return out;
}

let cache = null;
function load(opts) {
  opts = opts || {};
  if (cache && !opts.fresh) return cache;
  const freeDir = path.join(cfg.PLUGIN_ROOT, 'packs');
  const free = listJson(freeDir).map(readPack).filter(Boolean);
  // general first so later packs override its defaults
  free.sort((a, b) => (a.id === 'general' ? -1 : b.id === 'general' ? 1 : 0));
  const proFiles = listJson(cfg.FILES.packs);
  const pro = cfg.isPro() ? proFiles.map(readPack).filter(Boolean) : [];
  const merged = merge([...free, ...pro]);
  merged.proLocked = cfg.isPro() ? [] : proFiles.map((f) => path.basename(f, '.json'));
  merged.freeIds = free.map((p) => p.id);
  merged.proIds = pro.map((p) => p.id);
  cache = merged;
  return merged;
}

module.exports = { load, merge, readPack };