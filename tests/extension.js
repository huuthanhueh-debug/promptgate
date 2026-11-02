'use strict';
// PromptGate extension tests: the browser bundle runs with no Node globals, scores match the
// Node engine, the composer helpers handle the DOM shapes we expect, and content.js drives a
// minimal mock of claude.ai end to end (badge text, live update on typing, replace-not-send).
// Run directly (node tests/extension.js) or through tests/run.js (spawned as a child process).
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'promptgate-ext-'));
process.env.CLAUDE_CONFIG_DIR = TMP;
process.env.CLAUDE_PLUGIN_ROOT = ROOT;
delete process.env.PROMPTGATE_PRO;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('build');
const { build } = require(path.join(EXT, 'build.js'));
build({ quiet: true });
const dist = path.join(EXT, 'dist');
for (const f of ['engine.js', 'content.js', 'popup.html', 'popup.js', 'manifest.json']) {
  check(`dist/${f} exists`, fs.existsSync(path.join(dist, f)));
}
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
check('manifest permissions are storage only', JSON.stringify(manifest.permissions) === '["storage"]', JSON.stringify(manifest.permissions));
check('manifest has no host_permissions', !manifest.host_permissions);
check('content script only on claude.ai', JSON.stringify(manifest.content_scripts[0].matches) === '["https://claude.ai/*"]');
check('engine loads before content script', manifest.content_scripts[0].js[0] === 'engine.js' && manifest.content_scripts[0].js[1] === 'content.js');
const icon128 = path.join(dist, 'icons', '128.png');
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
check('icons generated at build (16/32/48/128)', [16, 32, 48, 128].every((s) => fs.existsSync(path.join(dist, 'icons', `${s}.png`))));
check('128px icon is a valid PNG header', fs.existsSync(icon128) && fs.readFileSync(icon128).subarray(0, 8).equals(PNG_SIG));
check('manifest points at the generated icons', manifest.icons && manifest.icons['128'] === 'icons/128.png' && manifest.action.default_icon['16'] === 'icons/16.png');

// ---- bundle in a bare sandbox ---------------------------------------------------------
console.log('browser bundle (no Node, no DOM)');
const engineSrc = fs.readFileSync(path.join(dist, 'engine.js'), 'utf8');
const bare = {};
vm.createContext(bare);
vm.runInContext(engineSrc, bare);
const core = bare.PromptGateCore;
check('bundle exposes PromptGateCore', !!core && typeof core.evaluate === 'function');
check('sandbox has no require/process/fs', typeof bare.require === 'undefined' && typeof bare.process === 'undefined' && typeof bare.fs === 'undefined');

const samples = [
  'làm cho tôi cái này tốt hơn đi bạn ơi nhé',
  'Bạn ơi giúp tôi sửa lỗi app với, nó không chạy',
  'fix this',
  'Can you please help me make the app better? Thanks!',
  'Xây một app Electron kiểu Kahoot cho công ty event, chạy trên laptop MC, cổng 3777',
  'Viết email xin nghỉ phép 2 ngày gửi sếp, giọng lịch sự, dưới 120 từ, tiếng Việt',
  'Refactor src/utils/date.ts to remove moment.js. Keep the public API unchanged, all tests must pass, show only the diff.',
  'Deploy fsvt-opshub lên Render với Neon Postgres, giữ nguyên env hiện tại, báo lại từng bước và cách rollback',
];
const packs = require(path.join(ROOT, 'scripts/lib/packs.js'));
const E = require(path.join(ROOT, 'scripts/lib/engine.js'));
const nodePack = packs.load({ fresh: true });
let parity = true;
for (const s of samples) {
  const a = E.analyze(s, { pack: nodePack });
  const b = core.evaluate(s);
  if (a.score !== b.score || a.type !== b.type || a.depth !== b.depth) {
    parity = false;
    console.log('      mismatch: ' + s.slice(0, 40) + ' node=' + a.score + ' bundle=' + b.score);
  }
}
check(`bundle scores match Node engine on ${samples.length} prompts`, parity);

const v = core.variants('sửa lỗi login không chạy', { language: 'vi', depth: 'auto' }, ['src/app.js']);
check('A is shorter than B', v.A.length < v.B.length, `${v.A.length} vs ${v.B.length}`);
check('A/B/C carry the goal line', [v.A, v.B, v.C].every((x) => x.startsWith('Mục tiêu: Sửa lỗi login')));
check('context filled from chat when prompt lacks it', v.B.includes('Ngữ cảnh: src/app.js'));
check('constraints auto-filled, no placeholder left', v.B.includes('Ràng buộc: giữ nguyên phần không liên quan') && !/Ràng buộc:.*⟨/.test(v.B));
check('C adds the plan/verify line when missing', v.C.includes('Ultrathink.') && !v.B.includes('Ultrathink.'));
const deepV = core.variants('Xây một app Electron kiểu Kahoot cho công ty event, chạy trên laptop MC, cổng 3777', { language: 'vi' }, []);
check('deep build task recommends C', deepV.rec === 'C', deepV.rec);
const forced = core.variants('sửa lỗi login không chạy', { language: 'vi', depth: 'light' }, []);
check('depth profile override changes recommendation', forced.rec === 'A', forced.rec);
check('no chat context → context placeholder stays visible', core.variants('sửa lỗi login không chạy', { language: 'vi' }, []).B.includes('⟨'));
const ctxFound = core.contextFrom('Lỗi ở src/app.js:42 và https://x.test/api');
check('contextFrom finds paths and URLs', JSON.stringify(ctxFound) === '["src/app.js","https://x.test/api"]', JSON.stringify(ctxFound));
check('contextFrom caps at three', core.contextFrom('a/b.js c/d.js e/f.js g/h.js').length === 3);
check('band: balanced thresholds', core.band(40, 'balanced') === 'low' && core.band(60, 'balanced') === 'mid' && core.band(80, 'balanced') === 'high');
check('band: off mode never low', core.band(10, 'off') === 'high');
check('ui() falls back to English for unknown language', core.ui('xx').A === 'A · Lean');

// ---- composer helpers with a mock document -------------------------------------------
console.log('composer helpers (mock DOM)');
const SEL = core.COMPOSER_SELECTORS;
function rectEl(w, h, extra) { return Object.assign({ tagName: 'DIV', getBoundingClientRect: () => ({ width: w, height: h }) }, extra || {}); }
const big = rectEl(600, 40);
const small = rectEl(10, 10);
const hidden = rectEl(0, 0);
const docA = { querySelectorAll: (s) => (s === SEL[0] ? [hidden, small, big] : []) };
check('findComposer picks the largest visible ProseMirror', core.findComposer(docA) === big);
const docB = { querySelectorAll: (s) => (s === SEL[3] ? [rectEl(400, 30, { tagName: 'TEXTAREA' })] : []) };
check('findComposer falls back to textarea', !!core.findComposer(docB) && core.findComposer(docB).tagName === 'TEXTAREA');
check('findComposer returns null when nothing matches', core.findComposer({ querySelectorAll: () => [] }) === null);
check('readComposer uses innerText for contenteditable', core.readComposer({ tagName: 'DIV', innerText: 'xin chào', textContent: 'x' }) === 'xin chào');
check('readComposer uses value for textarea', core.readComposer({ tagName: 'TEXTAREA', value: 'abc' }) === 'abc');

// execOk: whether execCommand reports success; target: the element whose text it updates.
function mockDoc(execOk, target) {
  const calls = [];
  return {
    calls,
    getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
    createRange: () => ({ selectNodeContents() {} }),
    execCommand: (cmd, ui, val) => { calls.push([cmd, val]); if (execOk && target && cmd === 'insertText') { target.innerText = val; target.textContent = val; } return execOk; },
  };
}
function fakeEditable(text, onPaste) {
  return {
    tagName: 'DIV', innerText: text, textContent: text, focus() {}, dispatched: [],
    dispatchEvent(ev) { this.dispatched.push(ev.type); if (ev.type === 'paste' && onPaste) onPaste(this, ev); return true; },
  };
}
const ce = fakeEditable('old');
const d1 = mockDoc(true, ce);
check('writeComposer uses insertText so the editor sees input', core.writeComposer(ce, 'mới', d1) === 'insertText' && d1.calls[0][0] === 'insertText' && d1.calls[0][1] === 'mới');
const ce2 = fakeEditable('old');
check('writeComposer falls back to textContent and fires input', core.writeComposer(ce2, 'fallback', mockDoc(false)) === 'text' && ce2.textContent === 'fallback' && ce2.dispatched.includes('input'));
const ta = { tagName: 'TEXTAREA', value: '', focus() {}, dispatchEvent() { return true; } };
check('writeComposer sets textarea value', core.writeComposer(ta, 'xyz', mockDoc(false)) === 'value' && ta.value === 'xyz');

// Synthetic paste path (what a browser offers): the editor handles the paste and keeps lines.
bare.DataTransfer = class { constructor() { this.d = {}; } setData(k, v) { this.d[k] = v; } getData(k) { return this.d[k] || ''; } };
bare.ClipboardEvent = class { constructor(type, init) { this.type = type; this.clipboardData = init.clipboardData; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } };
const multi = 'Mục tiêu: a\nNgữ cảnh: b\nĐầu ra: c';
const pm = fakeEditable('old', (el, ev) => { el.innerText = ev.clipboardData.getData('text/plain'); el.textContent = el.innerText; ev.preventDefault(); });
const d3 = mockDoc(true, pm);
check('writeComposer prefers a synthetic paste when the editor accepts it', core.writeComposer(pm, multi, d3) === 'paste' && pm.innerText === multi && d3.calls.length === 0);
const pmIgnore = fakeEditable('old');
const d4 = mockDoc(true, pmIgnore);
check('paste ignored by the editor → falls back to insertText', core.writeComposer(pmIgnore, multi, d4) === 'insertText' && pmIgnore.innerText === multi);
delete bare.DataTransfer; delete bare.ClipboardEvent;

// ---- content.js against a minimal claude.ai mock --------------------------------------
console.log('content script (mock claude.ai)');
function mkEl(tag) {
  const listeners = {};
  const node = {
    tagName: String(tag).toUpperCase(), className: '', id: '', type: '', textContent: '', hidden: false, isConnected: false,
    style: {}, dataset: {}, children: [], shadowChildren: [], _l: listeners,
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach((fn) => fn(ev)); return true; },
    append(...xs) { for (const x of xs) { x.isConnected = true; this.children.push(x); } },
    appendChild(x) { this.append(x); return x; },
    replaceChildren(...xs) { this.children = []; this.append(...xs); },
    // A shadow root's children are kept apart from light DOM, as in the browser.
    attachShadow() {
      const root = { children: node.shadowChildren, append(...xs) { for (const x of xs) { x.isConnected = true; node.shadowChildren.push(x); } } };
      return root;
    },
    getBoundingClientRect() { return { top: 600, bottom: 640, left: 300, right: 900, width: 600, height: 40 }; },
    focus() { this.focused = true; },
    contains(n) { return n === this; },
  };
  return node;
}
function allNodes(root, out) {
  out = out || [];
  out.push(root);
  for (const c of root.children || []) allNodes(c, out);
  for (const c of root.shadowChildren || []) allNodes(c, out);
  return out;
}

const composer = mkEl('div');
composer.className = 'ProseMirror';
composer.innerText = 'làm cho tôi cái này tốt hơn đi bạn ơi nhé';
composer.textContent = composer.innerText;
composer.isConnected = true;
const docListeners = {};
const execLog = [];
const body = mkEl('body');
body.isConnected = true;
const doc = {
  body,
  querySelector: () => null,
  querySelectorAll: (s) => (s === SEL[0] ? [composer] : []),
  addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
  createElement: (t) => mkEl(t),
  getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
  createRange: () => ({ selectNodeContents() {} }),
  execCommand: (cmd, ui, val) => {
    execLog.push([cmd, val]);
    if (cmd === 'insertText') { composer.innerText = val; composer.textContent = val; }
    return true;
  },
};
const sandbox = {
  document: doc,
  navigator: { language: 'vi-VN' },
  innerWidth: 1200, innerHeight: 800,
  setTimeout, clearTimeout,
  MutationObserver: class { observe() {} },
  chrome: {
    storage: {
      local: { get(defaults, cb) { cb({ settings: null }); } },
      onChanged: { addListener() {} },
    },
  },
};
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);
vm.runInContext(fs.readFileSync(path.join(dist, 'content.js'), 'utf8'), sandbox);

(async () => {
  await sleep(30);
  const nodes = allNodes(body);
  const badge = nodes.find((n) => n.tagName === 'BUTTON' && n.className === 'pg-btn');
  const panel = nodes.find((n) => n.className === 'pg-panel');
  check('badge is rendered in the shadow root', !!badge, 'no .pg-btn found');
  check('badge shows a live score', !!badge && /^PG \d+$/.test(badge.textContent), badge && badge.textContent);
  const firstLabel = badge && badge.textContent;

  composer.innerText = 'Viết email xin nghỉ phép 2 ngày gửi sếp, giọng lịch sự, dưới 120 từ, tiếng Việt';
  (docListeners.input || []).forEach((fn) => fn({ type: 'input' }));
  await sleep(340);
  check('score updates while typing (debounced)', badge.textContent !== firstLabel, `${firstLabel} → ${badge.textContent}`);
  check('good prompt is in the high band', badge.dataset.band === 'high', badge.dataset.band);

  composer.innerText = 'làm cho tôi cái này tốt hơn đi bạn ơi nhé';
  (docListeners.input || []).forEach((fn) => fn({ type: 'input' }));
  await sleep(340);
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'P', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false,
    preventDefault() {}, stopPropagation() {},
  }));
  check('Ctrl+Shift+P opens the panel', panel && panel.hidden === false);
  const cards = panel ? allNodes(panel).filter((n) => n.className && n.className.startsWith('pg-card')) : [];
  check('panel shows three rewrite cards', cards.length === 3, String(cards.length));

  const useButtons = panel ? allNodes(panel).filter((n) => n.tagName === 'BUTTON' && n.textContent === 'Thay vào ô nhập') : [];
  check('panel has three replace buttons', useButtons.length === 3, String(useButtons.length));

  // Regression: pressing a panel button focuses it (focusin bubbles out of the shadow root).
  // That must not rebuild the panel before the click lands, or the click is swallowed.
  const host = doc.body.children.find((c) => c.id === 'promptgate-host');
  (docListeners.focusin || []).forEach((fn) => fn({ type: 'focusin', target: useButtons[1], composedPath: () => [useButtons[1], panel, host, doc.body] }));
  await sleep(40);
  const after = panel ? allNodes(panel).filter((n) => n.tagName === 'BUTTON' && n.textContent === 'Thay vào ô nhập') : [];
  check('focus inside the panel does not rebuild it (buttons keep identity)', after.length === 3 && after[1] === useButtons[1]);
  // A composer edit while the panel is open still refreshes it.
  composer.innerText = 'làm cho tôi cái này tốt hơn đi bạn ơi nhé ngay';
  (docListeners.input || []).forEach((fn) => fn({ type: 'input', target: composer, composedPath: () => [composer, doc.body] }));
  await sleep(340);
  const rebuilt = allNodes(panel).filter((n) => n.tagName === 'BUTTON' && n.textContent === 'Thay vào ô nhập');
  check('typing in the composer re-renders the open panel', rebuilt.length === 3 && rebuilt[1] !== useButtons[1]);
  useButtons.splice(0, 3, ...rebuilt);
  const before = execLog.length;
  (useButtons[1]._l.click || []).forEach((fn) => fn({ preventDefault() {} }));
  const inserted = execLog.slice(before);
  check('clicking B inserts the B text via insertText',
    inserted.length === 1 && inserted[0][0] === 'insertText' && inserted[0][1].startsWith('Mục tiêu:'),
    JSON.stringify(inserted).slice(0, 120));
  check('composer now holds the B text', composer.innerText.includes('Ràng buộc: giữ nguyên phần không liên quan'));
  check('panel closes after replacing', panel.hidden === true);
  check('nothing was sent (no submit, no Enter)', !execLog.some(([c]) => c === 'submit' || c === 'insertParagraph'));

  console.log(`\n${pass} passed, ${fail} failed`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  process.exit(fail ? 1 : 0);
})();
