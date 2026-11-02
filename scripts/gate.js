#!/usr/bin/env node
'use strict';
// PromptGate UserPromptSubmit hook. Reads the hook payload on stdin, writes JSON on stdout.
// Fail-open by design: any internal error → empty JSON → the prompt goes through untouched.
//
// Weak prompt (score < blockBelow):
//   action=suggest (default): never blocks. Injects an instruction so Claude writes 3 expert
//     rewrites (Lean / Standard / Deep) with the gaps filled from conversation context and offers
//     them as clickable choices (AskUserQuestion). Nothing to retype.
//   action=block: classic gate — block + rule-based rewrite in the message, user resends.
const cfgm = require('./lib/config');
const packs = require('./lib/packs');
const E = require('./lib/engine');
const L = require('./lib/lexicon');
const { t } = require('./lib/i18n');

function out(o) { process.stdout.write(JSON.stringify(o || {})); process.exit(0); }

async function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    const timer = setTimeout(() => resolve(raw), 1500);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { raw += d; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(raw); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(raw); });
  });
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch (_) { return out({}); }
  const prompt = String(input.prompt || '');
  const trimmed = prompt.trim();
  const cfg = cfgm.loadConfig(input.cwd);
  const session = input.session_id || 'unknown';
  const pass = (why) => { cfgm.appendLog({ session, action: 'skip', why }); return out({}); };

  if (cfg.mode === 'off') return out({});
  if (input.agent_id || input.agent_type) return out({});
  if (!trimmed) return out({});
  if (trimmed.startsWith('//')) return pass('bypass');
  if (trimmed.startsWith('/')) return out({});
  if (L.AUTOMATED.test(trimmed) || L.AUTOMATED_TEXT.test(trimmed)) return out({});
  if (E.R.ACK.test(trimmed)) return out({});
  if (E.words(trimmed).length < cfg.minWords) return out({});

  const state = cfgm.loadState();
  const st = state[session] || {};
  const now = Date.now();
  st.lastSeen = new Date(now).toISOString();
  st.turns = (st.turns || 0) + 1;
  const followUp = st.turns > 2;
  if (st.lastBlockTs && now - Date.parse(st.lastBlockTs) < cfg.cooldownSec * 1000) {
    delete st.lastBlockTs; state[session] = st; cfgm.saveState(state);
    return pass('cooldown');
  }
  if (st.lastSuggestionHead && E.normalize(trimmed).includes(st.lastSuggestionHead)) {
    delete st.lastSuggestionHead; state[session] = st; cfgm.saveState(state);
    return pass('accepted');
  }

  const pack = packs.load();
  const a = E.analyze(trimmed, { pack, language: cfg.language, followUp });
  const blockAt = followUp ? cfg.blockBelow - 10 : cfg.blockBelow;
  const T = t(a.lang);
  const typeLabel = T.types[a.type] || a.type;
  const depthLabel = T.depth[a.depth] || a.depth;
  const base = { session, score: a.score, type: a.type, depth: a.depth, lang: a.lang, words: a.nWords, missing: a.missing, followUp };

  if (a.score < blockAt) {
    const skeleton = E.rewrite(trimmed, a, pack, T);
    if (cfg.action !== 'block') {
      // suggest mode: Claude fills the gaps and offers A/B/C as buttons. No block, no retyping.
      const rec = a.depth === 'deep' ? 'C' : a.depth === 'light' ? 'A' : 'B';
      const missing = a.missing.map((k) => T.dims[k]).join(', ');
      const ctx = T.suggest({ score: a.score, typeLabel, depthLabel }, missing, rec, skeleton);
      state[session] = st; cfgm.saveState(state);
      cfgm.appendLog(Object.assign(base, { action: 'suggest' }));
      return out({ systemMessage: T.suggestSys(a.score, typeLabel), hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx.slice(0, 9500) } });
    }
    let suggestion = skeleton;
    let viaLlm = false;
    if (cfg.brain === 'llm' && cfgm.isPro()) {
      try {
        const brain = require('./lib/brain-llm');
        const s = await brain.rewrite(trimmed, a, cfg, T);
        if (s) { suggestion = s; viaLlm = true; }
      } catch (_) {}
    }
    const reason = E.formatBlock(a, suggestion, T, viaLlm);
    const head = E.normalize(suggestion.split('\n')[0].replace(/^[^:]{1,20}:\s*/, '')).slice(0, 60);
    st.lastBlockTs = new Date(now).toISOString();
    if (head.length >= 12) st.lastSuggestionHead = head;
    state[session] = st; cfgm.saveState(state);
    cfgm.appendLog(Object.assign(base, { action: 'block', llm: viaLlm }));
    return out({
      decision: 'block',
      reason,
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', suppressOriginalPrompt: cfg.showOriginal ? false : true },
    });
  }

  state[session] = st; cfgm.saveState(state);

  if (a.score < cfg.showBelow) {
    const sys = E.formatSystem(a, T);
    const o = { systemMessage: sys, hookSpecificOutput: { hookEventName: 'UserPromptSubmit' } };
    const ctx = [];
    if (cfg.echo !== false) ctx.push(T.echo(sys));
    if (cfg.inject !== false && a.depth === 'deep' && !a.flags.cue) ctx.push(T.inject(typeLabel));
    if (ctx.length) o.hookSpecificOutput.additionalContext = ctx.join('\n');
    cfgm.appendLog(Object.assign(base, { action: 'show' }));
    return out(o);
  }

  cfgm.appendLog(Object.assign(base, { action: 'pass' }));
  return out({});
}

main().catch(() => out({}));