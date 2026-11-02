'use strict';
// Pure logic for the claude.ai extension: scoring, the A/B/C rewrites, composer helpers and UI
// strings. No globals, no Node APIs, no DOM globals (the document is passed in), so the same
// code is bundled for the browser by extension/build.js and exercised by tests/extension.js.
const E = require('../../scripts/lib/engine');
const packsLib = require('../../scripts/lib/packs');
const { t } = require('../../scripts/lib/i18n');
const { MODES } = require('../../scripts/lib/config');
const GENERAL = require('@packs/general.json');

const PACK = packsLib.merge([GENERAL]);

// Composer candidates on claude.ai, most specific first. Each selector is tried in order and the
// largest visible match wins, so a hidden or duplicate editor does not get picked.
const COMPOSER_SELECTORS = [
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'fieldset [contenteditable="true"]',
  'textarea',
];

const DEFAULT_SETTINGS = { enabled: true, mode: 'balanced', depthProfile: 'auto', language: 'auto', licenseKey: '' };
const DEPTHS = ['auto', 'light', 'standard', 'deep'];

const AUTOFILL = {
  constraints: { vi: 'giữ nguyên phần không liên quan', en: 'keep unrelated parts unchanged' },
  output: { vi: 'kết quả ngắn gọn, nêu rõ thay đổi', en: 'concise result, state what changed' },
};

const UI = {
  vi: {
    score: 'Điểm', type: 'Loại việc', depth: 'Chiều sâu', missing: 'Còn thiếu', complete: 'Đã đủ các chiều chính',
    variants: 'Chọn một bản để thay vào ô nhập. Không tự gửi.', use: 'Thay vào ô nhập',
    keep: 'Gửi nguyên bản', keepHint: 'Giữ prompt gốc trong ô nhập. Bạn tự bấm gửi.', rec: 'Khuyên dùng',
    fromChat: 'lấy từ hội thoại', empty: 'Gõ prompt để chấm điểm.', close: 'Đóng',
    buttonTitle: 'PromptGate: mở gợi ý viết lại (Ctrl+Shift+P)',
    A: 'A · Gọn', B: 'B · Chuẩn', C: 'C · Sâu',
  },
  en: {
    score: 'Score', type: 'Task', depth: 'Depth', missing: 'Still missing', complete: 'All main dimensions covered',
    variants: 'Pick one to replace the composer text. Nothing is sent.', use: 'Replace composer text',
    keep: 'Send as written', keepHint: 'Keeps your original prompt in the composer. You press send.', rec: 'Recommended',
    fromChat: 'taken from the chat', empty: 'Type a prompt to score it.', close: 'Close',
    buttonTitle: 'PromptGate: open rewrite suggestions (Ctrl+Shift+P)',
    A: 'A · Lean', B: 'B · Standard', C: 'C · Deep',
  },
};

function ui(lang) { return UI[lang] || UI.en; }

function evaluate(text, opts) {
  opts = opts || {};
  const trimmed = String(text || '').trim();
  const a = E.analyze(trimmed, { pack: PACK, language: opts.language || 'auto', followUp: !!opts.followUp });
  const T = t(a.lang);
  return {
    a, T, lang: a.lang, score: a.score, missing: a.missing, type: a.type, depth: a.depth,
    typeLabel: T.types[a.type] || a.type, depthLabel: T.depth[a.depth] || a.depth,
    dims: a.dims, max: E.MAX,
  };
}

// Band colour for the on-page button, using the same thresholds as the Claude Code plugin.
function band(score, mode) {
  const m = MODES[mode] || MODES.balanced;
  if (m.blockBelow && score < m.blockBelow) return 'low';
  if (m.showBelow && score < m.showBelow) return 'mid';
  return 'high';
}

// Facts from the chat that can stand in for missing context: file paths and URLs the user or
// the assistant already mentioned. Nothing leaves the browser; this only reads what is on screen.
function contextFrom(text) {
  const out = [];
  const seen = new Set();
  for (const re of [E.R.REFS.path, E.R.REFS.url]) {
    for (const m of String(text || '').match(re) || []) {
      const v = m.trim().replace(/[.,;:)\]]+$/, '');
      if (v.length < 3 || seen.has(v)) continue;
      seen.add(v);
      out.push(v.slice(0, 80));
      if (out.length >= 3) return out;
    }
  }
  return out;
}

function fillLines(lines, T, lang, ctxText) {
  return lines.map((l) => {
    if (ctxText && l.startsWith(T.labels.context + ':')) return `${T.labels.context}: ${ctxText}`;
    if (l.startsWith(T.labels.constraints + ':')) return `${T.labels.constraints}: ${AUTOFILL.constraints[lang] || AUTOFILL.constraints.en}`;
    if (l.startsWith(T.labels.output + ':') && l.includes('⟨')) return `${T.labels.output}: ${AUTOFILL.output[lang] || AUTOFILL.output.en}`;
    return l;
  });
}

// Three rewrites from the same rule engine:
//   A Lean:     goal, one output line (plus context if we found some)
//   B Standard: the full skeleton with the gaps filled from pack defaults and chat context
//   C Deep:     B plus the plan/verify line, always present
// opts.depth overrides the detected depth ('light' | 'standard' | 'deep'); 'auto' keeps it.
function variants(text, opts, ctx) {
  opts = opts || {};
  const ev = evaluate(text, opts);
  const { a, T, lang } = ev;
  const trimmed = String(text || '').trim();
  const depth = opts.depth && opts.depth !== 'auto' ? opts.depth : a.depth;
  const a2 = Object.assign({}, a, { depth });
  const ctxText = ctx && ctx.length ? ctx.join(', ') : '';
  const core = E.cleanFiller(trimmed) || trimmed;

  const lean = [`${T.labels.goal}: ${core}`];
  if (ctxText && a.dims.context < 10) lean.push(`${T.labels.context}: ${ctxText}`);
  const outDef = PACK.types[a.type] && PACK.types[a.type].defaults && PACK.types[a.type].defaults.output[lang];
  lean.push(`${T.labels.output}: ${outDef || AUTOFILL.output[lang] || AUTOFILL.output.en}`);

  const standard = fillLines(E.rewrite(trimmed, a2, PACK, T).split('\n'), T, lang, ctxText);
  const deep = standard.slice();
  if (!deep.includes(T.deepLine)) deep.push(T.deepLine);

  const rec = depth === 'deep' ? 'C' : depth === 'light' ? 'A' : 'B';
  return { A: lean.join('\n'), B: standard.join('\n'), C: deep.join('\n'), rec, depth, ev };
}

// ---- composer helpers (take the document as an argument) -------------------------------

function findComposer(doc) {
  for (const sel of COMPOSER_SELECTORS) {
    let best = null;
    let bestArea = 0;
    for (const el of doc.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
      const area = (r.width || 0) * (r.height || 0);
      if (area > bestArea) { best = el; bestArea = area; }
    }
    if (best) return best;
  }
  return null;
}

function readComposer(el) {
  if (!el) return '';
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || '';
  return el.innerText != null ? el.innerText : (el.textContent || '');
}

const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function selectAll(el, doc) {
  const sel = doc.getSelection && doc.getSelection();
  if (!sel || !doc.createRange) return;
  const range = doc.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Replaces the composer content so the editor (ProseMirror) sees a real edit. Returns the
// strategy that landed ('value' | 'paste' | 'insertText' | 'text'). Never submits: the user
// still presses the site's own send button.
//
// Order of attempts on a contenteditable:
//   1. a synthetic paste with text/plain: ProseMirror turns each line into its own paragraph,
//      which keeps the A/B/C line structure intact;
//   2. execCommand('insertText'): reliable but newlines may collapse into one paragraph;
//   3. textContent swap as a last resort (the editor may need one more keystroke to notice).
function writeComposer(el, text, doc) {
  if (!el) return false;
  if (typeof el.focus === 'function') el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.value = text;
    if (typeof el.dispatchEvent === 'function') el.dispatchEvent({ type: 'input', bubbles: true });
    return 'value';
  }
  const landed = () => squash(readComposer(el)) === squash(text);
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  if (typeof g.DataTransfer === 'function' && typeof g.ClipboardEvent === 'function' && typeof el.dispatchEvent === 'function') {
    try {
      selectAll(el, doc);
      const dt = new g.DataTransfer();
      dt.setData('text/plain', text);
      const ev = new g.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      if (ev.defaultPrevented && landed()) return 'paste';
    } catch (_) { /* fall through */ }
  }
  try {
    selectAll(el, doc);
    if (doc.execCommand && doc.execCommand('insertText', false, text) && landed()) return 'insertText';
  } catch (_) { /* fall through */ }
  el.textContent = text;
  if (typeof el.dispatchEvent === 'function') el.dispatchEvent({ type: 'input', bubbles: true });
  return 'text';
}

module.exports = {
  PACK, COMPOSER_SELECTORS, DEFAULT_SETTINGS, DEPTHS, MODES,
  ui, evaluate, band, contextFrom, variants, findComposer, readComposer, writeComposer,
};
