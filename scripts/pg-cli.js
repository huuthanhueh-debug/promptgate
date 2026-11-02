#!/usr/bin/env node
'use strict';
// /promptgate:* control commands: status | config <mode> | brain <rules|llm> | activate <key> | deactivate | packs
const cfgm = require('./lib/config');
const packs = require('./lib/packs');
const PRODUCT = require('./lib/product');

const [cmd, ...rest] = process.argv.slice(2);

function status() {
  const cfg = cfgm.loadConfig(process.cwd());
  const lic = cfgm.loadLicense();
  const pro = cfgm.isPro();
  const pack = packs.load();
  const log = cfgm.readLog(7);
  const scored = log.filter((e) => e.action !== 'skip');
  const n = (a) => log.filter((e) => e.action === a).length;
  const avg = scored.length ? Math.round(scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length) : null;
  const lines = [
    `PromptGate ${PRODUCT.version}`,
    `mode: ${cfg.mode} (weak < ${cfg.blockBelow}, show < ${cfg.showBelow >= 101 ? 'always' : cfg.showBelow}) · on weak: ${cfg.action} · brain: ${cfg.brain} · language: ${cfg.language}`,
    `tier: ${pro ? 'Pro' : 'Free'}${lic && lic.updatesUntil ? ' · updates until ' + lic.updatesUntil.slice(0, 10) : ''}${process.env.PROMPTGATE_PRO === '1' ? ' (dev override)' : ''}`,
    `packs: ${pack.ids.join(', ')}${pack.proLocked.length ? ' · locked Pro packs present: ' + pack.proLocked.join(', ') : ''}`,
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
  if (which === 'llm' && !cfgm.isPro()) { console.log('Tier 2 (LLM rewrite) is a Pro feature. Get a key at ' + PRODUCT.url + ' then run /promptgate:activate <KEY>.'); return; }
  cfgm.saveConfig({ brain: which });
  console.log(`PromptGate brain → ${which}${which === 'llm' ? ' (uses `claude -p --model haiku` with your own login; falls back to ANTHROPIC_API_KEY)' : ''}.`);
}

async function activate(key) {
  if (!key) { console.log('Usage: activate <LICENSE-KEY>  (the key is in your Gumroad receipt email)'); return; }
  if (typeof fetch !== 'function') { console.log('Node 18+ is required for activation.'); return; }
  const body = new URLSearchParams({ license_key: key.trim(), increment_uses_count: 'true' });
  if (PRODUCT.gumroadProductId) body.set('product_id', PRODUCT.gumroadProductId); else body.set('product_permalink', PRODUCT.gumroadPermalink);
  let j;
  try { const r = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body }); j = await r.json(); } catch (e) { console.log('Could not reach Gumroad: ' + e.message); return; }
  if (!j || !j.success) { console.log('License not valid: ' + ((j && j.message) || 'unknown error')); return; }
  const p = j.purchase || {};
  if (p.refunded || p.chargebacked || p.disputed) { console.log('This license was refunded or disputed and cannot be activated.'); return; }
  const sale = p.sale_timestamp ? new Date(p.sale_timestamp) : new Date();
  const updatesUntil = new Date(sale.getTime() + 366 * 86400e3).toISOString();
  cfgm.writeJson(cfgm.FILES.license, { valid: true, key: key.trim().slice(0, 8) + '…', keyHash: require('crypto').createHash('sha256').update(key.trim()).digest('hex').slice(0, 16), product: p.product_name || PRODUCT.gumroadPermalink, verifiedAt: new Date().toISOString(), purchasedAt: sale.toISOString(), updatesUntil });
  packs.load({ fresh: true });
  console.log(`PromptGate Pro activated. Updates until ${updatesUntil.slice(0, 10)}. Drop Pro packs into ${cfgm.FILES.packs} and run /promptgate:status.`);
}

function deactivate() { try { require('fs').unlinkSync(cfgm.FILES.license); } catch (_) {} console.log('PromptGate Pro deactivated on this machine.'); }

function listPacks() {
  const pack = packs.load();
  console.log(`free: ${pack.freeIds.join(', ')}\npro loaded: ${pack.proIds.join(', ') || '-'}\npro locked: ${pack.proLocked.join(', ') || '-'}\npro dir: ${cfgm.FILES.packs}`);
}

(async () => {
  switch (cmd) {
    case 'status': return status();
    case 'config': return config(rest[0]);
    case 'brain': return brain(rest[0]);
    case 'activate': return activate(rest.join(' '));
    case 'deactivate': return deactivate();
    case 'packs': return listPacks();
    default: console.log('Usage: pg-cli.js <status|config <mode>|brain <rules|llm>|activate <key>|deactivate|packs>');
  }
})();