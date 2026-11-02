'use strict';
// PromptGate scoring + rewrite engine. Deterministic, dependency-free, well under 1 ms per prompt.
const L = require('./lexicon');

// JS \b is ASCII-only, which breaks on Vietnamese letters (đ, ư, ơ...). Rewrite \b into
// Unicode-aware lookarounds and force the u flag.
function fixB(re) {
  const src = re.source.replace(/\\b/g, '(?:(?<![\\p{L}\\p{N}_])|(?![\\p{L}\\p{N}_]))');
  const flags = re.flags.includes('u') ? re.flags : re.flags + 'u';
  return new RegExp(src, flags);
}
const R = {
  ACK: fixB(L.ACK), AUTOMATED: L.AUTOMATED, AUTOMATED_TEXT: L.AUTOMATED_TEXT,
  VAGUE_VERBS: fixB(L.VAGUE_VERBS), VAGUE_REFS: fixB(L.VAGUE_REFS), QUESTION: fixB(L.QUESTION),
  OUTPUT: fixB(L.OUTPUT), CONSTRAINT: fixB(L.CONSTRAINT), ACCEPTANCE: fixB(L.ACCEPTANCE),
  DEPTH_CUE: fixB(L.DEPTH_CUE), FAST_CUE: fixB(L.FAST_CUE), MAX_CUE: fixB(L.MAX_CUE),
  FILLER: L.FILLER.map(fixB),
  LEAD_FILLER: (L.LEAD_FILLER || []).map(fixB),
  REFS: Object.fromEntries(Object.entries(L.REFS).map(([k, v]) => [k, fixB(v)])),
  VI_WORDS: new RegExp(fixB(L.VI_WORDS).source, 'giu'),
};
const MAX = { goal: 25, context: 15, output: 15, constraints: 15, acceptance: 10, economy: 10, depth: 10 };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const kwRe = (kw) => new RegExp('(?<![\\p{L}\\p{N}_])' + escapeRe(kw).replace(/\s+/g, '\\s+') + '(?![\\p{L}\\p{N}_])', 'iu');
const VERB_RE = new RegExp('(?<![\\p{L}\\p{N}_])(?:' + [...L.VERBS.vi, ...L.VERBS.en].map(escapeRe).join('|') + ')(?![\\p{L}\\p{N}_])', 'iu');
const PROPER_RE = /(?<=[\s(,:;])[A-Z][a-z]{2,}(?:[A-Z][a-z]+)*(?![\p{L}])/gu;

const count = (text, re) => { const m = text.match(re); return m ? m.length : 0; };
const words = (text) => text.trim().split(/\s+/).filter(Boolean);
const sentences = (text) => text.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const normalize = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

function detectLang(text, pref) {
  if (pref && pref !== 'auto') return pref;
  if (L.VI_CHARS.test(text)) return 'vi';
  return count(text, R.VI_WORDS) >= 2 ? 'vi' : 'en';
}

function refs(text) {
  const out = { total: 0 };
  for (const [k, re] of Object.entries(R.REFS)) { const n = count(text, re); out[k] = n; out.total += n; }
  // Proper nouns mid-sentence (Electron, Kahoot, Render, Neon…) ground the request too.
  out.proper = Math.min(2, count(text, PROPER_RE));
  out.total += out.proper;
  return out;
}

// Cache compiled keyword regexes per pack object.
const kwCache = new WeakMap();
function compiled(pack) {
  let c = kwCache.get(pack);
  if (c) return c;
  c = {};
  for (const [type, def] of Object.entries(pack.types || {})) {
    const kws = [...((def.keywords && def.keywords.vi) || []), ...((def.keywords && def.keywords.en) || [])];
    c[type] = kws.map(kwRe);
  }
  kwCache.set(pack, c);
  return c;
}

function classify(text, pack) {
  const trimmed = text.trim();
  const isQ = R.QUESTION.test(trimmed) || /\?\s*$/.test(trimmed);
  const nW = words(trimmed).length;
  const comp = compiled(pack);
  const scores = {};
  for (const [type, res] of Object.entries(comp)) {
    let n = 0;
    for (const re of res) if (re.test(trimmed)) n += 1;
    scores[type] = n * ((pack.types[type] && pack.types[type].weight) || 1);
  }
  if (isQ && nW <= 30 && !(scores.build > 0) && !(scores.debug > 0) && !(scores.ops > 0)) return { type: 'question', isQ, scores };
  const order = pack.priority || ['debug', 'ops', 'build', 'analyze', 'review', 'write', 'edit'];
  let best = 'general', bestN = 0;
  for (const t of order) if ((scores[t] || 0) > bestN) { best = t; bestN = scores[t]; }
  for (const t of Object.keys(scores)) if (!order.includes(t) && t !== 'question' && t !== 'general' && scores[t] > bestN) { best = t; bestN = scores[t]; }
  if (bestN === 0) return { type: isQ ? 'question' : 'general', isQ, scores };
  return { type: best, isQ, scores };
}

function analyze(text, opts) {
  opts = opts || {};
  const pack = opts.pack;
  if (!pack || !pack.types) throw new Error('analyze() needs a loaded pack');
  const trimmed = text.trim();
  const lang = detectLang(trimmed, opts.language);
  const nW = words(trimmed).length;
  const cls = classify(trimmed, pack);
  const type = cls.type;
  const tdef = pack.types[type] || pack.types.general || {};
  let depth = tdef.depth || 'standard';
  if (R.FAST_CUE.test(trimmed)) depth = 'light';
  else if (R.MAX_CUE.test(trimmed)) depth = 'deep';
  const refc = refs(trimmed);
  const base = Object.assign({ output: 3, constraints: 3, acceptance: 3 }, tdef.baseline || {});
  const dims = {};

  // Goal (25)
  const head = sentences(trimmed).slice(0, 2).join('. ');
  const hasVerb = VERB_RE.test(head) || VERB_RE.test(trimmed);
  const specificity = refc.total + Math.floor(count(trimmed, /\b\d+\b/g) / 2);
  let goal = 0;
  if (hasVerb || cls.isQ) goal += 10;
  goal += specificity >= 2 ? 10 : specificity >= 1 ? 6 : nW >= 12 ? 3 : 0;
  goal += nW >= 6 ? 5 : 2;
  const vagueRefs = refc.total === 0 ? Math.min(2, count(trimmed, R.VAGUE_REFS)) : 0;
  const vagueVerbs = specificity === 0 ? Math.min(2, count(trimmed, R.VAGUE_VERBS)) : 0;
  goal -= Math.min(15, vagueRefs * 6 + vagueVerbs * 4);
  dims.goal = clamp(Math.round(goal), 0, MAX.goal);

  // Context (15)
  const need = tdef.needsContext || 'medium';
  const table = { high: [3, 10, 15], medium: [7, 12, 15], low: [10, 15, 15] };
  dims.context = (table[need] || table.medium)[Math.min(2, refc.total)];

  // Output (15)
  const o = count(trimmed, R.OUTPUT);
  dims.output = o >= 2 ? 15 : o === 1 ? 9 : clamp(base.output, 0, 15);

  // Constraints (15)
  const c = count(trimmed, R.CONSTRAINT);
  dims.constraints = c >= 2 ? 15 : c === 1 ? 9 : clamp(base.constraints, 0, 15);

  // Acceptance (10)
  const a = count(trimmed, R.ACCEPTANCE);
  dims.acceptance = a >= 2 ? 10 : a === 1 ? 6 : clamp(base.acceptance, 0, 10);

  // Economy (10)
  let filler = 0;
  for (const re of R.FILLER) filler += count(trimmed, re);
  let eco = 10 - 3 * filler;
  const long = nW > 250 && refc.total < 2;
  if (long) eco -= 3;
  const freq = {};
  for (const w of words(normalize(trimmed))) { if (w.length < 4 || L.STOPWORDS.has(w)) continue; freq[w] = (freq[w] || 0) + 1; }
  const repeated = Object.values(freq).some((n) => n >= 5);
  if (repeated) eco -= 2;
  dims.economy = clamp(eco, 0, MAX.economy);

  // Depth fit (10)
  const cue = count(trimmed, R.DEPTH_CUE) > 0;
  dims.depth = depth === 'deep' ? (cue ? 10 : 3) : depth === 'standard' ? (cue ? 10 : 7) : (cue ? 7 : 10);

  const score = Object.values(dims).reduce((s, v) => s + v, 0);
  const missing = [];
  for (const k of ['goal', 'context', 'output', 'constraints', 'acceptance', 'depth']) {
    if (dims[k] < MAX[k] * 0.5) missing.push(k);
  }
  missing.sort((x, y) => dims[x] / MAX[x] - dims[y] / MAX[y]);
  return {
    lang, type, depth, nWords: nW, refs: refc, dims, max: MAX, score,
    missing, excess: { filler, long, repeated },
    flags: { hasVerb, isQ: cls.isQ, cue },
  };
}

function tidyPunct(t) {
  return t
    .replace(/\s+([,.!?;:])/g, '$1')                 // "word ," → "word,"
    .replace(/([,.!?;:])[\s,.!?;:]+(?=\S)/g, '$1 ')  // ",  !?" clusters inside → single mark + space
    .replace(/[\s,.!?;:]*([.!?])[\s,.!?;:]*$/, '$1') // trailing cluster → one terminal mark
    .replace(/[,;:]+$/, '')                           // dangling comma/semicolon at the end
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s*[,.;:!?]+\s*/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanFiller(text) {
  let t = text.trim();
  for (const re of R.FILLER) t = t.replace(re, ' ');
  t = tidyPunct(t);
  for (let i = 0; i < 2; i++) {
    for (const re of R.LEAD_FILLER) t = t.replace(re, (m, off) => (off === 0 ? '' : ' '));
    t = tidyPunct(t);
  }
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function rewrite(text, a, pack, T) {
  const tdef = pack.types[a.type] || pack.types.general || {};
  const lines = [];
  const core = cleanFiller(text);
  lines.push(`${T.labels.goal}: ${core}`);
  const needCtx = (tdef.needsContext || 'medium') !== 'low';
  if (a.type !== 'question') {
    if (a.dims.context < 10 && needCtx) lines.push(`${T.labels.context}: ⟨${T.ph.context}⟩`);
    if (a.dims.output < 9) {
      const d = tdef.defaults && tdef.defaults.output && tdef.defaults.output[a.lang];
      lines.push(`${T.labels.output}: ${d || '⟨' + T.ph.output + '⟩'}`);
    }
    if (a.dims.constraints < 9 && tdef.askConstraints !== false) lines.push(`${T.labels.constraints}: ⟨${T.ph.constraints}⟩`);
    if (a.dims.acceptance < 6) {
      const d = tdef.defaults && tdef.defaults.done && tdef.defaults.done[a.lang];
      if (d) lines.push(`${T.labels.done}: ${d}`);
    }
  }
  if (!a.flags.cue) {
    if (a.depth === 'deep') lines.push(T.deepLine);
    else if (a.depth === 'standard' && a.type !== 'question') lines.push(T.standardLine);
  }
  return lines.join('\n');
}

function describeExcess(a, T) {
  const parts = [];
  if (a.excess.filler) parts.push(T.excessFiller(a.excess.filler));
  if (a.excess.long) parts.push(T.excessLong);
  return parts.join(', ');
}
function tipFor(a, T) {
  const k = a.missing[0] || (a.excess.filler ? 'economy' : null);
  return k ? T.tips[k] : '';
}

function formatBlock(a, suggestion, T, viaLlm) {
  const miss = a.missing.map((k) => T.dims[k]).join(', ');
  const ex = describeExcess(a, T);
  const out = [T.block.header(a.score, T.types[a.type] || a.type, T.depth[a.depth])];
  const line2 = [];
  if (miss) line2.push(`${T.block.missing}: ${miss}`);
  if (ex) line2.push(`${T.block.excess}: ${ex}`);
  if (line2.length) out.push(line2.join(' · '));
  const tip = tipFor(a, T);
  if (tip) out.push(`${T.block.tip}: ${tip}`);
  out.push(T.block.sugHeader + (viaLlm ? ' ' + T.block.llm : ''));
  out.push(suggestion.length > 6000 ? suggestion.slice(0, 6000) + '…' : suggestion);
  out.push(T.block.sugFooter);
  out.push(T.block.bypass);
  return out.join('\n');
}
function formatSystem(a, T) {
  const miss = a.missing.slice(0, 2).map((k) => T.dims[k]).join(', ');
  return T.sys(a.score, T.types[a.type] || a.type, miss, tipFor(a, T));
}
function formatDims(a, T) {
  return Object.keys(MAX).map((k) => `${T.dims[k]} ${a.dims[k]}/${MAX[k]}`).join(' · ');
}

module.exports = { R, MAX, words, normalize, detectLang, classify, analyze, rewrite, cleanFiller, tidyPunct, formatBlock, formatSystem, formatDims, tipFor, describeExcess };