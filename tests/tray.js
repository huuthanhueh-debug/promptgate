#!/usr/bin/env node
'use strict';
// Tray (phase 2) tests: the non-UI half. Composer (A/B/C from rules + detected context),
// the core.js bridge (request/result JSON files, UI strings, config), and logging.
// Uses a temp CLAUDE_CONFIG_DIR so it never touches the real ~/.claude/promptgate.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'promptgate-tray-test-'));
process.env.CLAUDE_CONFIG_DIR = TMP;
process.env.CLAUDE_PLUGIN_ROOT = ROOT;
delete process.env.PROMPTGATE_PRO;

const packs = require(path.join(ROOT, 'scripts/lib/packs.js'));
const C = require(path.join(ROOT, 'tray/lib/compose.js'));
const pack = packs.load();

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); } }
const byId = (r, id) => r.versions.find((v) => v.id === id).text;

console.log('composer: input guards');
let r = C.compose('', { pack });
check('empty text → ok:false empty', r.ok === false && r.reason === 'empty' && /clipboard/i.test(r.message));
r = C.compose('sửa đi', { pack });
check('too short → ok:false too_short with VI message', r.ok === false && r.reason === 'too_short' && /Bôi đen/.test(r.message));
r = C.compose('fix it', { pack });
check('too short EN → EN message', r.ok === false && /Select a longer/.test(r.message));
r = C.compose('   \r\n  ', { pack });
check('whitespace only → empty', r.ok === false && r.reason === 'empty');

console.log('composer: weak VI prompt');
const weakVi = 'Bạn ơi giúp tôi sửa lỗi app với, nó không chạy';
r = C.compose(weakVi, { pack, origin: 'selection' });
check('ok with VI lang and score < 50', r.ok && r.lang === 'vi' && r.score < 50, `score=${r.score} lang=${r.lang}`);
check('three versions A/B/C in order', r.versions.map((v) => v.id).join('') === 'ABC');
check('labels are VI', r.versions[0].label === 'A · Gọn' && r.versions[2].label === 'C · Sâu');
check('A is shortest, C is longest', byId(r, 'A').length < byId(r, 'B').length && byId(r, 'B').length < byId(r, 'C').length);
check('A has no label prefix (bare intent)', !/^Mục tiêu:/.test(byId(r, 'A')));
check('A drops leading politeness', !/^(Bạn ơi|Giúp tôi)/i.test(byId(r, 'A')), byId(r, 'A').split('\n')[0]);
check('B starts with Mục tiêu and has Ràng buộc + Hoàn thành khi', /^Mục tiêu:/.test(byId(r, 'B')) && /\nRàng buộc: /.test(byId(r, 'B')) && /\nHoàn thành khi: /.test(byId(r, 'B')));
check('B constraints line is filled (no ⟨ on it)', !/Ràng buộc: ⟨/.test(byId(r, 'B')));
check('B context is a placeholder when nothing concrete is known', /Ngữ cảnh: ⟨/.test(byId(r, 'B')));
check('C has Ultrathink + plan + self-check lines', /Ultrathink\./.test(byId(r, 'C')) && /kế hoạch ngắn/.test(byId(r, 'C')) && /tự kiểm tra/.test(byId(r, 'C')));
check('B does not have the deep lines', !/Ultrathink/.test(byId(r, 'B')));
check('header mentions score/100 and VI depth word', new RegExp(`^${r.score}/100 · .+ · chiều sâu `).test(r.header), r.header);
check('missing dims listed in VI', r.missingLabels.length > 0 && r.missingText.includes(r.missingLabels[0]));
check('tip present', typeof r.tip === 'string' && r.tip.length > 10);
check('rec is one of A/B/C and matches depth', ['A', 'B', 'C'].includes(r.rec) && r.rec === C.recommend({ depth: r.depth }));
check('ui strings are serializable VI (no functions)', r.ui && r.ui.menu && r.ui.menu.quit === 'Thoát' && Object.values(r.ui).every((v) => typeof v !== 'function'));
check('ui templates carry {0} for the host', /\{0\}/.test(r.ui.copied) && /\{0\}/.test(r.ui.trayOn) && /\{0\}/.test(r.ui.started));
check('origin echoed back', r.origin === 'selection');

console.log('composer: context filled from the text and the source window');
const withRefs = 'Sửa lỗi đăng nhập trong hrfsvt-app/server/auth.js, nó báo TypeError: cannot read properties of undefined';
r = C.compose(withRefs, { pack, source: 'auth.js - Visual Studio Code' });
const ctxLine = byId(r, 'B').split('\n').find((l) => l.startsWith('Ngữ cảnh:')) || '';
check('context line is filled, not a placeholder', ctxLine && !ctxLine.includes('⟨'), ctxLine);
check('context names the path', ctxLine.includes('hrfsvt-app/server/auth.js'), ctxLine);
check('context quotes the error forward from the token (no path fragment)', /TypeError: cannot read properties of undefined/.test(ctxLine) && !/; js /.test(ctxLine), ctxLine);
check('context quotes the window title', /đang mở: auth\.js - Visual Studio Code/.test(ctxLine), ctxLine);
check('sourceHint ignores generic titles', C.sourceHint('Untitled - Notepad', 'vi') === '' && C.sourceHint('Claude', 'vi') === '' && C.sourceHint('', 'vi') === '');
check('sourceHint keeps document titles (EN)', C.sourceHint('notes.txt - Notepad', 'en') === 'open: notes.txt - Notepad');
const items = C.contextFrom('xem https://example.com/docs/a. và @src/index.ts nhé', '', 'vi');
check('contextFrom finds URL (trailing dot stripped) and @file', items.includes('https://example.com/docs/a') && items.includes('@src/index.ts'), JSON.stringify(items));

console.log('composer: EN and question');
r = C.compose('Can you please help me make the app better? Thanks!', { pack });
check('EN prompt → EN labels and lines', r.lang === 'en' && r.versions[1].label === 'B · Standard' && /^Goal: /.test(byId(r, 'B')) && /Done when: /.test(byId(r, 'B')));
check('EN C has Ultrathink + EN deep lines', /Ultrathink\. Before acting/.test(byId(r, 'C')));
check('EN header uses "depth"', / · depth /.test(r.header), r.header);
r = C.compose('What is the difference between let and const in JavaScript?', { pack });
check('question: A is the bare question', byId(r, 'A') === 'What is the difference between let and const in JavaScript?', byId(r, 'A'));
check('question: B has no constraints/context lines', !/Context:|Constraints:/.test(byId(r, 'B')), byId(r, 'B'));
check('question: C adds the answer-shape line, no Ultrathink', /conclusion first/.test(byId(r, 'C')) && !/Ultrathink/.test(byId(r, 'C')));
check('question: rec A (light)', r.rec === 'A');

console.log('composer: good prompt and cues');
r = C.compose('Sửa lỗi đăng nhập trong hrfsvt-app/server/auth.js: khi sai mật khẩu 3 lần vẫn cho vào. Không đổi schema DB. Xong khi test login pass.', { pack });
check('good prompt scores ≥ 75 and still gets 3 versions', r.score >= 75 && r.versions.length === 3, `score=${r.score}`);
r = C.compose('Phân tích nên chọn Render hay Neon cho Postgres, viết bảng so sánh, ultrathink', { pack });
check('explicit cue: C does not prepend a second Ultrathink', (byId(r, 'C').match(/Ultrathink/gi) || []).length <= 1, byId(r, 'C'));
check('explicit cue: B has no standard verify line', !/Kiểm tra lại kết quả/.test(byId(r, 'B')));

console.log('composer: tier-2 application and text rendering');
const base = C.compose(weakVi, { pack });
const before = byId(base, 'A');
C.applyLlm(base, 'Mục tiêu: sửa lỗi app X trong app.js\nĐầu ra: diff');
check('applyLlm replaces B with the rewrite', byId(base, 'B') === 'Mục tiêu: sửa lỗi app X trong app.js\nĐầu ra: diff');
check('applyLlm keeps A unchanged', byId(base, 'A') === before);
check('applyLlm C = rewrite + deep lines', byId(base, 'C').startsWith('Mục tiêu: sửa lỗi app X') && /Ultrathink\./.test(byId(base, 'C')));
check('applyLlm flags viaLlm', base.viaLlm === true);
check('applyLlm ignores empty rewrite', C.applyLlm(C.compose(weakVi, { pack }), '   ').viaLlm === false);
const txt = C.toText(C.compose(weakVi, { pack }));
check('toText has header, Thiếu line, three section bars and the recommended mark', /\/100/.test(txt) && /Thiếu: /.test(txt) && (txt.match(/── [ABC] · /g) || []).length === 3 && /\(khuyên dùng\)/.test(txt));
check('toText on failure returns the message', C.toText(C.compose('', { pack })) === C.UI.vi.empty);
check('language forced to en → EN UI even for VI text', C.compose(weakVi, { pack, language: 'en' }).versions[0].label === 'A · Lean');

console.log('core.js bridge');
const req = path.join(TMP, 'req.json');
const out = path.join(TMP, 'out.json');
function core(args) { return spawnSync(process.execPath, [path.join(ROOT, 'tray/core.js'), ...args], { encoding: 'utf8', env: process.env, timeout: 20000 }); }
fs.writeFileSync(req, JSON.stringify({ text: weakVi, source: 'Untitled - Notepad', origin: 'selection' }), 'utf8');
let p = core(['--req', req, '--out', out]);
let o = JSON.parse(fs.readFileSync(out, 'utf8'));
check('--req/--out exits 0 and writes a result', p.status === 0 && o.ok === true && o.versions.length === 3, p.stderr);
check('result file is UTF-8 with Vietnamese intact', /Mục tiêu/.test(fs.readFileSync(out, 'utf8')));
check('generic window title adds no context hint', !/đang mở/.test(o.versions[1].text));
const logFile = path.join(TMP, 'promptgate', 'log.jsonl');
const logLines = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n') : [];
check('log gets an action:tray entry without the prompt text', logLines.length === 1 && /"action":"tray"/.test(logLines[0]) && /"origin":"selection"/.test(logLines[0]) && !logLines[0].includes('không chạy'), logLines[0]);
fs.writeFileSync(req, JSON.stringify({ text: 'ok', noLog: true }), 'utf8');
p = core(['--req', req, '--out', out]);
o = JSON.parse(fs.readFileSync(out, 'utf8'));
check('too-short request → ok:false in file, exit 0', p.status === 0 && o.ok === false && o.reason === 'too_short' && o.ui && o.ui.menu);
check('noLog request writes no log line', fs.readFileSync(logFile, 'utf8').trim().split('\n').length === 1);
fs.writeFileSync(req, JSON.stringify({ text: weakVi, llm: true, noLog: true }), 'utf8');
p = core(['--req', req, '--out', out]);
o = JSON.parse(fs.readFileSync(out, 'utf8'));
check('llm request without Pro → llm:not_pro, rule versions kept', p.status === 0 && o.ok && o.llm === 'not_pro' && o.viaLlm === false);
fs.writeFileSync(req, '{not json', 'utf8');
p = core(['--req', req, '--out', out]);
o = JSON.parse(fs.readFileSync(out, 'utf8'));
check('unreadable request → ok:false bad_request, exit 0', p.status === 0 && o.ok === false && o.reason === 'bad_request');
p = core(['--req', path.join(TMP, 'missing.json'), '--out', out]);
o = JSON.parse(fs.readFileSync(out, 'utf8'));
check('missing request file → bad_request', o.ok === false && o.reason === 'bad_request');
p = core(['--ui', 'vi']);
o = JSON.parse(p.stdout);
check('--ui vi prints menu strings', o.ok && o.lang === 'vi' && o.menu.hotkey === 'Đổi phím tắt…' && o.trayOff === 'PromptGate · tạm tắt');
p = core(['--ui', 'en']);
o = JSON.parse(p.stdout);
check('--ui en prints EN menu strings', o.lang === 'en' && o.menu.quit === 'Quit');
p = core(['--config']);
o = JSON.parse(p.stdout);
check('--config prints defaults merged (hotkey Ctrl+Alt+P, paste false) and paths', o.ok && o.tray.hotkey === 'Ctrl+Alt+P' && o.tray.paste === false && o.tray.enabled === true && o.home.startsWith(TMP) && o.pro === false);
fs.mkdirSync(path.join(TMP, 'promptgate'), { recursive: true });
fs.writeFileSync(path.join(TMP, 'promptgate', 'config.json'), JSON.stringify({ mode: 'balanced', tray: { hotkey: 'Ctrl+Shift+Space', paste: true, language: 'en' } }), 'utf8');
p = core(['--config']);
o = JSON.parse(p.stdout);
check('--config merges user tray settings over defaults', o.tray.hotkey === 'Ctrl+Shift+Space' && o.tray.paste === true && o.tray.llm === false);
fs.writeFileSync(req, JSON.stringify({ text: weakVi, noLog: true }), 'utf8');
p = core(['--req', req, '--out', out]);
o = JSON.parse(fs.readFileSync(out, 'utf8'));
check('tray.language=en forces EN popup for a VI prompt', o.ok && o.versions[0].label === 'A · Lean', o.versions[0].label);
p = core(['--ui']);
o = JSON.parse(p.stdout);
check('--ui without arg follows tray.language', o.lang === 'en');
p = core(['fix this please thanks a lot']);
check('plain text argument prints a text block', p.status === 0 && /\/100/.test(p.stdout) && /── A · Lean ──/.test(p.stdout));
p = spawnSync(process.execPath, [path.join(ROOT, 'tray/core.js')], { input: weakVi, encoding: 'utf8', env: process.env, timeout: 20000 });
check('stdin text prints a text block', p.status === 0 && /── A · /.test(p.stdout));

console.log('perf');
const t0 = Date.now(); for (let i = 0; i < 300; i++) C.compose(withRefs, { pack, source: 'auth.js - Code' }); const ms = (Date.now() - t0) / 300;
check(`compose < 3 ms avg (${ms.toFixed(2)} ms)`, ms < 3);

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
