'use strict';
// PromptGate tray: turn a captured prompt into popup data. Pure functions, no UI, no I/O.
// Reuses the plugin engine directly (scripts/lib) instead of copying it.
//
// Unlike the Claude Code hook (where Claude fills the A/B/C rewrites from conversation
// context), the tray has no model in the loop, so the gaps are filled here from what the
// rule engine can see: concrete references found in the text (paths, URLs, error lines,
// @files), the title of the window the text came from, and the pack's per-type defaults.
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const E = require(path.join(ROOT, 'scripts', 'lib', 'engine.js'));
const L = require(path.join(ROOT, 'scripts', 'lib', 'lexicon.js'));
const { t } = require(path.join(ROOT, 'scripts', 'lib', 'i18n.js'));

const MIN_WORDS = 3;

// Popup / tray strings. The PowerShell host is ASCII-only and reads these from JSON.
const UI = {
  vi: {
    appName: 'PromptGate',
    header: (s, type, depth) => `${s}/100 · ${type} · chiều sâu ${depth}`,
    missing: 'Thiếu', excess: 'Thừa', tip: 'Mẹo', complete: 'đủ cả 7 chiều',
    versions: { A: 'A · Gọn', B: 'B · Chuẩn', C: 'C · Sâu' },
    recommended: 'khuyên dùng',
    hint: 'Bấm một bản để chép · phím A / B / C · Esc đóng',
    copied: 'Đã chép bản {0} vào clipboard',
    pasted: 'Đã dán bản {0} đè lên vùng bôi đen',
    paste: 'Dán đè vào chỗ bôi đen',
    pro: 'Tầng 2 (Claude)', proBusy: 'Đang hỏi Claude…', proDone: 'Bản B/C do tầng 2 viết lại',
    proNotPro: 'Tầng 2 chưa sẵn sàng: cần Claude Code đã đăng nhập (claude -p)',
    proFail: 'Tầng 2 không trả lời; giữ bản theo quy tắc',
    tooShort: 'Bôi đen một prompt dài hơn (từ 3 từ) rồi nhấn phím tắt, hoặc chép prompt vào clipboard.',
    empty: 'Không có gì được bôi đen và clipboard trống.',
    origin: { selection: 'từ vùng bôi đen', clipboard: 'từ clipboard' },
    menu: {
      enable: 'Bật PromptGate', hotkey: 'Đổi phím tắt…', paste: 'Dán đè sau khi chọn bản', llm: 'Hỏi tầng 2 (Claude) khi chấm',
      history: 'Mở lịch sử prompt', startup: 'Khởi động cùng Windows', log: 'Mở thư mục dữ liệu', quit: 'Thoát',
    },
    trayOn: 'PromptGate · {0}', trayOff: 'PromptGate · tạm tắt',
    hotkeyTitle: 'Đổi phím tắt', hotkeyPrompt: 'Nhấn tổ hợp mới (cần Ctrl, Alt hoặc Win + một phím):', save: 'Lưu', cancel: 'Hủy',
    hotkeyFail: 'Không đăng ký được {0}. Tổ hợp này có thể đã bị app khác giữ hoặc bị chặn; thử tổ hợp khác.',
    nodeMissing: 'Không tìm thấy node.exe. Cài Node.js 18+ hoặc đặt "tray.node" trong ~/.claude/promptgate/config.json.',
    started: 'Đang chạy. Bôi đen prompt ở bất kỳ app nào rồi nhấn {0}.',
    engineFail: 'Engine không trả lời; xem tray.log trong thư mục dữ liệu.',
  },
  en: {
    appName: 'PromptGate',
    header: (s, type, depth) => `${s}/100 · ${type} · depth ${depth}`,
    missing: 'Missing', excess: 'Excess', tip: 'Tip', complete: 'all 7 dimensions covered',
    versions: { A: 'A · Lean', B: 'B · Standard', C: 'C · Deep' },
    recommended: 'recommended',
    hint: 'Click a version to copy · keys A / B / C · Esc closes',
    copied: 'Version {0} copied to clipboard',
    pasted: 'Version {0} pasted over the selection',
    paste: 'Paste over the selection',
    pro: 'Tier 2 (Claude)', proBusy: 'Asking Claude…', proDone: 'B/C rewritten by tier 2',
    proNotPro: 'Tier 2 not ready: needs a logged-in Claude Code (claude -p)',
    proFail: 'Tier 2 did not answer; keeping the rule-based versions',
    tooShort: 'Select a longer prompt (3+ words) and press the hotkey, or copy the prompt to the clipboard.',
    empty: 'Nothing selected and the clipboard is empty.',
    origin: { selection: 'from selection', clipboard: 'from clipboard' },
    menu: {
      enable: 'Enable PromptGate', hotkey: 'Change hotkey…', paste: 'Paste over selection after choosing', llm: 'Ask tier 2 (Claude) when scoring',
      history: 'Open prompt history', startup: 'Start with Windows', log: 'Open data folder', quit: 'Quit',
    },
    trayOn: 'PromptGate · {0}', trayOff: 'PromptGate · paused',
    hotkeyTitle: 'Change hotkey', hotkeyPrompt: 'Press the new combination (Ctrl, Alt or Win + a key):', save: 'Save', cancel: 'Cancel',
    hotkeyFail: 'Could not register {0}. Another app may hold it or it is blocked; try a different combination.',
    nodeMissing: 'node.exe not found. Install Node.js 18+ or set "tray.node" in ~/.claude/promptgate/config.json.',
    started: 'Running. Select a prompt in any app and press {0}.',
    engineFail: 'Engine did not answer; see tray.log in the data folder.',
  },
};

// Sensible per-type constraints so version B never ships an empty ⟨…⟩ for this line.
const CONSTRAINTS = {
  vi: {
    edit: 'chỉ sửa đúng chỗ nêu trên, không đổi phần khác',
    build: 'giữ stack hiện có, không thêm thư viện mới nếu không cần, không phá API đang dùng',
    debug: 'chỉ sửa nguyên nhân lỗi, không đổi hành vi khác, không đổi schema hay dữ liệu',
    analyze: 'nêu rõ giả định và nguồn, không bịa số liệu',
    write: 'giữ đúng thông tin đã cho, không thêm cam kết mới',
    review: 'không tự sửa, chỉ báo phát hiện kèm vị trí và cách sửa',
    ops: 'không xóa dữ liệu, có đường rollback trước mỗi bước rủi ro',
    general: 'không làm ngoài phạm vi đã nêu; thiếu thông tin thì nêu giả định rồi làm tiếp',
  },
  en: {
    edit: 'change only the spot named above, leave everything else as is',
    build: 'keep the current stack, add no new library unless needed, do not break APIs in use',
    debug: 'fix the root cause only, change no other behaviour, no schema or data changes',
    analyze: 'state assumptions and sources, never invent numbers',
    write: 'keep the given facts exact, add no new commitments',
    review: 'do not edit; report findings with location and fix',
    ops: 'delete no data, have a rollback path before each risky step',
    general: 'stay within the stated scope; if information is missing, state the assumption and continue',
  },
};

// Extra lines that make version C "deep".
const DEEP = {
  vi: {
    task: ['Trước khi làm: lập kế hoạch ngắn (tối đa 5 bước), nêu ca biên và giả định.', 'Sau khi làm: tự kiểm tra kết quả, nói rõ phần chưa kiểm chứng.', 'Làm trọn vẹn, không dừng giữa chừng; tự suy luận hợp lý thay vì hỏi lại.'],
    question: ['Trả lời: kết luận trước, giải thích ngắn, một ví dụ cụ thể, nêu ngoại lệ hoặc giới hạn.'],
  },
  en: {
    task: ['Before acting: a short plan (5 steps max), edge cases and assumptions.', 'After acting: self-check the result, state what is not verified.', 'Finish completely, do not stop halfway; infer reasonably instead of asking back.'],
    question: ['Answer: conclusion first, brief explanation, one concrete example, exceptions or limits.'],
  },
};

const AT_FILE = /@[\w./\\-]+\.\w{1,6}(?![\p{L}\p{N}])/gu;

function uniqPush(arr, v) { v = String(v || '').trim(); if (v && !arr.includes(v)) arr.push(v); }

// A window title is worth quoting only when it names a document (file-ish token or path).
function sourceHint(title, lang) {
  if (!title) return '';
  const s = String(title).replace(/\s+/g, ' ').trim();
  if (!s || s.length > 120) return '';
  if (!/\.[A-Za-z0-9]{1,6}(?:\s|$)/.test(s) && !/[\\/]/.test(s)) return '';
  if (/^(untitled|không có tiêu đề|new document)\b/i.test(s)) return '';
  return (lang === 'vi' ? 'đang mở: ' : 'open: ') + s;
}

// Concrete references the text already contains. These fill the context line for real.
function contextFrom(text, source, lang) {
  const items = [];
  for (const m of (text.match(L.REFS.path) || []).slice(0, 4)) uniqPush(items, m);
  for (const m of (text.match(L.REFS.url) || []).slice(0, 2)) uniqPush(items, m.replace(/[.,;:!?)]+$/, ''));
  for (const m of (text.match(AT_FILE) || []).slice(0, 3)) uniqPush(items, m);
  // Forward-only from the error token: never walk back across a path like auth.js.
  const errRe = new RegExp('(?:' + L.REFS.error.source + ')[^\\n]{0,140}', 'iu');
  const err = text.match(errRe);
  if (err) uniqPush(items, err[0].trim().replace(/[\s,.;:]+$/, ''));
  const hint = sourceHint(source, lang);
  if (hint) uniqPush(items, hint);
  return items;
}

function versions(text, a, pack, T, opts) {
  opts = opts || {};
  const lang = a.lang === 'vi' ? 'vi' : 'en';
  const tdef = pack.types[a.type] || pack.types.general || {};
  const isQ = a.type === 'question';
  const core = E.cleanFiller(text);
  const ctx = contextFrom(text, opts.source, lang);
  const needCtx = (tdef.needsContext || 'medium') !== 'low';
  const outDefault = tdef.defaults && tdef.defaults.output && tdef.defaults.output[lang];
  const doneDefault = tdef.defaults && tdef.defaults.done && tdef.defaults.done[lang];
  const ph = (tdef.ph && tdef.ph.context && tdef.ph.context[lang]) || T.ph.context;

  const A = [core];
  if (!isQ && a.dims.output < 9 && outDefault) A.push(`${T.labels.output}: ${outDefault}`);

  const B = [`${T.labels.goal}: ${core}`];
  if (!isQ) {
    if (ctx.length) B.push(`${T.labels.context}: ${ctx.join('; ')}`);
    else if (a.dims.context < 10 && needCtx) B.push(`${T.labels.context}: ⟨${ph}⟩`);
    if (a.dims.output < 9) B.push(`${T.labels.output}: ${outDefault || '⟨' + T.ph.output + '⟩'}`);
    if (a.dims.constraints < 9 && tdef.askConstraints !== false) B.push(`${T.labels.constraints}: ${CONSTRAINTS[lang][a.type] || CONSTRAINTS[lang].general}`);
    if (a.dims.acceptance < 6 && doneDefault) B.push(`${T.labels.done}: ${doneDefault}`);
  }
  const C = B.slice();
  if (!isQ && !a.flags.cue) B.push(T.standardLine);
  const deep = (isQ ? DEEP[lang].question : DEEP[lang].task).slice();
  if (!isQ && !a.flags.cue) deep[0] = 'Ultrathink. ' + deep[0];
  C.push(...deep);

  const U = UI[lang];
  return [
    { id: 'A', label: U.versions.A, text: A.join('\n') },
    { id: 'B', label: U.versions.B, text: B.join('\n') },
    { id: 'C', label: U.versions.C, text: C.join('\n') },
  ];
}

function recommend(a) { return a.depth === 'deep' ? 'C' : a.depth === 'light' ? 'A' : 'B'; }

// Main entry. Returns everything the popup needs, or { ok:false, reason, message }.
function compose(text, opts) {
  opts = opts || {};
  const pack = opts.pack;
  if (!pack) throw new Error('compose() needs a loaded pack');
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  const uiLang = opts.language && opts.language !== 'auto' ? opts.language : (raw ? E.detectLang(raw) : 'vi');
  const U = UI[uiLang] || UI.en;
  if (!raw) return { ok: false, reason: 'empty', lang: uiLang, message: U.empty, ui: strings(uiLang) };
  if (E.words(raw).length < MIN_WORDS) return { ok: false, reason: 'too_short', lang: uiLang, message: U.tooShort, ui: strings(uiLang) };

  const a = E.analyze(raw, { pack, language: opts.language });
  const T = t(a.lang);
  const UL = UI[a.lang] || UI.en;
  const typeLabel = T.types[a.type] || a.type;
  const depthLabel = T.depth[a.depth] || a.depth;
  const missingLabels = a.missing.map((k) => T.dims[k]);
  const vs = versions(raw, a, pack, T, { source: opts.source });
  return {
    ok: true,
    lang: a.lang, score: a.score, type: a.type, typeLabel, depth: a.depth, depthLabel,
    words: a.nWords, dims: a.dims, max: a.max,
    missing: a.missing, missingLabels, missingText: missingLabels.join(', '),
    excessText: E.describeExcess(a, T), tip: E.tipFor(a, T),
    header: UL.header(a.score, typeLabel, depthLabel),
    hint: UL.hint,
    rec: recommend(a),
    versions: vs,
    viaLlm: false,
    source: opts.source || '',
    origin: opts.origin || '',
    ui: strings(a.lang),
    analysis: opts.includeAnalysis ? a : undefined,
  };
}

// Apply a tier-2 (LLM) rewrite: it replaces B, and C becomes that rewrite plus the deep lines.
function applyLlm(result, rewritten) {
  const s = String(rewritten || '').trim();
  if (!result || !result.ok || !s) return result;
  const lang = result.lang === 'vi' ? 'vi' : 'en';
  const deep = (result.type === 'question' ? DEEP[lang].question : DEEP[lang].task).slice();
  if (result.type !== 'question' && !/ultrathink/i.test(s)) deep[0] = 'Ultrathink. ' + deep[0];
  result.versions = result.versions.map((v) => (v.id === 'B' ? Object.assign({}, v, { text: s }) : v.id === 'C' ? Object.assign({}, v, { text: s + '\n' + deep.join('\n') }) : v));
  result.viaLlm = true;
  return result;
}

// Plain-text rendering (CLI, logs, tests).
function toText(r) {
  if (!r.ok) return r.message;
  const U = UI[r.lang] || UI.en;
  const out = [r.header];
  const l2 = [];
  if (r.missingText) l2.push(`${U.missing}: ${r.missingText}`); else l2.push(U.complete);
  if (r.excessText) l2.push(`${U.excess}: ${r.excessText}`);
  out.push(l2.join(' · '));
  if (r.tip) out.push(`${U.tip}: ${r.tip}`);
  for (const v of r.versions) {
    out.push('', `── ${v.label}${v.id === r.rec ? ' (' + U.recommended + ')' : ''} ──`, v.text);
  }
  return out.join('\n');
}

// Serializable UI strings (functions are dropped; the host formats those itself).
function strings(lang) {
  const U = UI[lang] || UI.en;
  const out = {};
  for (const [k, v] of Object.entries(U)) if (typeof v !== 'function') out[k] = v;
  return out;
}

module.exports = { UI, CONSTRAINTS, DEEP, MIN_WORDS, compose, versions, contextFrom, sourceHint, applyLlm, toText, strings, recommend };
