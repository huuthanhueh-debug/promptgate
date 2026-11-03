#!/usr/bin/env node
'use strict';
// /promptgate:* control commands: status | config <mode|suggest|block> | brain <rules|llm> | packs | activate (legacy, prints a note)
const cfgm = require('./lib/config');
const packs = require('./lib/packs');
const PRODUCT = require('./lib/product');

const [cmd, ...rest] = process.argv.slice(2);

function status() {
  const cfg = cfgm.loadConfig(process.cwd());
  const pack = packs.load();
  const log = cfgm.readLog(7);
  const scored = log.filter((e) => e.action !== 'skip');
  const n = (a) => log.filter((e) => e.action === a).length;
  const avg = scored.length ? Math.round(scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length) : null;
  const lines = [
    `PromptGate ${PRODUCT.version}`,
    `mode: ${cfg.mode} (weak < ${cfg.blockBelow}, show < ${cfg.showBelow >= 101 ? 'always' : cfg.showBelow}) · on weak: ${cfg.action} · brain: ${cfg.brain} · language: ${cfg.language}`,
    `tier: free, all packs and tier 2 included (since 1.3.0)`,
    `packs: ${pack.ids.join(', ')}${pack.customIds && pack.customIds.length ? ' (custom: ' + pack.customIds.join(', ') + ')' : ''}`,
    `last 7 days: ${scored.length} scored · ${n('suggest')} suggested · ${n('block')} blocked · ${n('show')} shown · ${n('pass')} passed · ${n('skip')} skipped${avg != null ? ' · avg ' + avg + '/100' : ''}`,
    `data: ${cfgm.HOME}`,
  ];
  console.log(lines.join('\n'));
}

function config(mode) {
  if (mode === 'suggest' || mode === 'block') {
    cfgm.saveConfig({ action: mode });
    console.log(mode === 'suggest'
      ? 'PromptGate → suggest: weak prompts are never blocked; Claude proposes 3 filled-in rewrites (Lean / Standard / Deep) as buttons. Nothing to retype.'
      : 'PromptGate → block: weak prompts are stopped with a rule-based rewrite in the message; you resend.');
    return;
  }
  if (!cfgm.MODES[mode]) { const c = cfgm.loadConfig(); console.log(`Usage: config <strict|balanced|gentle|off> or config <suggest|block>. Current: mode=${c.mode}, action=${c.action}`); return; }
  cfgm.saveConfig({ mode });
  const m = cfgm.MODES[mode];
  console.log(`PromptGate mode → ${mode} (weak < ${m.blockBelow}, show < ${m.showBelow >= 101 ? 'always' : m.showBelow}). Takes effect on your next prompt.`);
}

function brain(which) {
  if (!['rules', 'llm'].includes(which)) { console.log(`Usage: brain <rules|llm>. Current: ${cfgm.loadConfig().brain}`); return; }
  cfgm.saveConfig({ brain: which });
  console.log(`PromptGate brain → ${which}${which === 'llm' ? ' (uses `claude -p --model haiku` with your own login; falls back to ANTHROPIC_API_KEY)' : ''}.`);
}

const FREE_NOTE = 'PromptGate is fully free since 1.3.0: the coding, writing, business and hospitality packs ship with the plugin and tier 2 (/promptgate:brain llm) needs no key. Nothing to activate. Update with: claude plugin update promptgate@promptgate';
async function activate() { console.log(FREE_NOTE); }
function deactivate() { try { require('fs').unlinkSync(cfgm.FILES.license); } catch (_) {} console.log(FREE_NOTE); }

function listPacks() {
  const pack = packs.load();
  console.log(`built-in: ${pack.freeIds.join(', ')}\ncustom: ${pack.customIds.join(', ') || '-'}\ncustom dir (drop extra *.json here): ${cfgm.FILES.packs}`);
}

(async () => {
  switch (cmd) {
    case 'status': return status();
    case 'config': return config(rest[0]);
    case 'brain': return brain(rest[0]);
    case 'activate': return activate();
    case 'deactivate': return deactivate();
    case 'packs': return listPacks();
    default: console.log('Usage: pg-cli.js <status|config <mode|suggest|block>|brain <rules|llm>|packs|activate|deactivate>');
  }
})();