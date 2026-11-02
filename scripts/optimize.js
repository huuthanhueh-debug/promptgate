#!/usr/bin/env node
'use strict';
// /promptgate:optimize — score + rewrite a prompt on demand. Text from argv or stdin.
const cfgm = require('./lib/config');
const packs = require('./lib/packs');
const E = require('./lib/engine');
const { t } = require('./lib/i18n');

async function readStdin() {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => { let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (d) => (s += d)); process.stdin.on('end', () => resolve(s)); process.stdin.on('error', () => resolve(s)); });
}

(async () => {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const text = (args.filter((x) => x !== '--json' && x !== '--').join(' ').trim()) || (await readStdin()).trim();
  if (!text) { console.log('Usage: optimize.js <prompt text>  (or pipe the prompt on stdin)'); process.exit(0); }
  const cfg = cfgm.loadConfig(process.cwd());
  const pack = packs.load();
  const a = E.analyze(text, { pack, language: cfg.language });
  const T = t(a.lang);
  let suggestion = E.rewrite(text, a, pack, T);
  let viaLlm = false;
  if (cfg.brain === 'llm' && cfgm.isPro()) {
    try { const s = await require('./lib/brain-llm').rewrite(text, a, cfg, T); if (s) { suggestion = s; viaLlm = true; } } catch (_) {}
  }
  if (json) { console.log(JSON.stringify({ analysis: a, suggestion, viaLlm }, null, 2)); return; }
  console.log(T.block.header(a.score, T.types[a.type] || a.type, T.depth[a.depth]));
  console.log(E.formatDims(a, T));
  const miss = a.missing.map((k) => T.dims[k]).join(', ');
  const ex = E.describeExcess(a, T);
  if (miss || ex) console.log([miss && `${T.block.missing}: ${miss}`, ex && `${T.block.excess}: ${ex}`].filter(Boolean).join(' · '));
  const tip = E.tipFor(a, T); if (tip) console.log(`${T.block.tip}: ${tip}`);
  console.log(T.block.sugHeader + (viaLlm ? ' ' + T.block.llm : ''));
  console.log(suggestion);
  console.log(T.block.sugFooter);
})();