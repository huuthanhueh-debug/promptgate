#!/usr/bin/env node
'use strict';
// PromptGate test suite: engine calibration + hook end-to-end via stdin/stdout.
// Uses a temp CLAUDE_CONFIG_DIR so it never touches the real ~/.claude/promptgate.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'promptgate-test-'));
process.env.CLAUDE_CONFIG_DIR = TMP;
process.env.CLAUDE_PLUGIN_ROOT = ROOT;
delete process.env.PROMPTGATE_PRO;

const packs = require(path.join(ROOT, 'scripts/lib/packs.js'));
const E = require(path.join(ROOT, 'scripts/lib/engine.js'));
const { t } = require(path.join(ROOT, 'scripts/lib/i18n.js'));
const pack = packs.load();

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); } }
const band = (s) => (s < 50 ? 'block' : s < 75 ? 'show' : 'pass');

console.log('engine calibration');
const cases = [
  ['làm cho tôi cái này tốt hơn đi bạn ơi', 'block', 'vi'],
  ['Bạn ơi giúp tôi sửa lỗi app với, nó không chạy', 'block', 'vi'],
  ['fix this', 'block', 'en'],
  ['Can you please help me make the app better? Thanks!', 'block', 'en'],
  ['review code giúp tôi', 'block', 'vi'],
  ['giúp tôi làm cái dashboard doanh thu cho khách sạn nhé, đẹp đẹp chút', 'block', 'vi'],
  ['Xây một app Electron kiểu Kahoot cho công ty event, chạy trên laptop MC, cổng 3777', 'show', 'vi'],
  ['Phân tích giúp tôi nên chọn Render hay Neon cho Postgres, viết bảng so sánh chi phí và giới hạn, kết luận trước, ultrathink', 'pass', 'vi'],
  ['Deploy fsvt-opshub lên Render với Neon Postgres, giữ nguyên env hiện tại, báo lại từng bước và cách rollback', 'pass', 'vi'],
  ['Sửa lỗi đăng nhập trong hrfsvt-app/server/auth.js: khi sai mật khẩu 3 lần vẫn cho vào. Không đổi schema DB. Xong khi test login pass.', 'pass', 'vi'],
  ['Viết email xin nghỉ phép 2 ngày gửi sếp, giọng lịch sự, dưới 120 từ, tiếng Việt', 'pass', 'vi'],
  ['Refactor src/utils/date.ts to remove moment.js. Keep the public API unchanged, all tests must pass, show only the diff.', 'pass', 'en'],
  ['What is the difference between let and const in JavaScript?', 'pass', 'en'],
];
for (const [text, expected, lang] of cases) {
  const a = E.analyze(text, { pack });
  check(`${expected.padEnd(5)} ${a.score.toString().padStart(3)} ${text.slice(0, 50)}`, band(a.score) === expected && a.lang === lang, `got ${band(a.score)} (${a.score}) lang=${a.lang} type=${a.type}`);
}

console.log('classification');
check('debug detected', E.analyze('App báo lỗi 500 khi submit form', { pack }).type === 'debug');
check('build detected', E.analyze('Tạo trang landing page cho sản phẩm mới', { pack }).type === 'build' /* tie with business 'sales' resolves to the general type */);
const generalOnly = packs.merge([packs.readPack(path.join(ROOT, 'packs', 'general.json'))]);
check('general pack alone: landing page → build', E.analyze('Tạo trang landing page cho sản phẩm mới', { pack: generalOnly }).type === 'build');
check('general pack alone: caption → write', E.analyze('Viết caption Facebook cho khuyến mãi tháng 11', { pack: generalOnly }).type === 'write');
check('all five packs load, no duplicates', pack.ids.join(',') === 'general,business,coding,hospitality,writing', pack.ids.join(','));
check('isPro() is always true since 1.3.0', require(path.join(ROOT, 'scripts/lib/config.js')).isPro() === true);
check('build detected (làm cái dashboard)', E.analyze('giúp tôi làm cái dashboard doanh thu', { pack }).type === 'build');
check('question detected', E.analyze('Tại sao Node dùng event loop?', { pack }).type === 'question');
check('write detected', E.analyze('Viết caption Facebook cho khuyến mãi tháng 11', { pack }).type === 'write' /* tie with writing 'social' resolves to the general type */);
check('fast cue → light', E.analyze('Xây nhanh một script đổi tên file trong thư mục này', { pack }).depth === 'light');
check('max cue → deep', E.analyze('Sửa chữ tiêu đề, làm kỹ nhất có thể', { pack }).depth === 'deep');

console.log('cleanup and question depth');
const howToA = E.analyze('Làm sao để deploy lên Render, cần làm gì với Neon Postgres?', { pack });
check('how-to question is not deep without a cue', howToA.depth !== 'deep', howToA.depth);
check('how-to question gets no Ultrathink line', !E.rewrite('Làm sao để deploy lên Render, cần làm gì với Neon Postgres?', howToA, pack, t('vi')).includes('Ultrathink'));
check('explicit deep cue still wins on a question', E.analyze('Làm sao để deploy lên Render? Ultrathink, kỹ nhất có thể', { pack }).depth === 'deep');
check('deploy command (not a question) stays deep', E.analyze('Deploy fsvt-opshub lên Render với Neon Postgres, giữ nguyên env hiện tại, báo lại từng bước', { pack }).depth === 'deep');
check('"thanks so much" removed from goal', !/so much/i.test(E.cleanFiller('Make the app better please, thanks so much!')), E.cleanFiller('Make the app better please, thanks so much!'));
check('leading "Ok," removed from goal', E.cleanFiller('Ok, sửa lỗi đăng nhập trong auth.js giúp tôi nhé').startsWith('Sửa'), E.cleanFiller('Ok, sửa lỗi đăng nhập trong auth.js giúp tôi nhé'));
check('"Okay" in English removed too', E.cleanFiller('Okay, fix the login bug in auth.js').startsWith('Fix'), E.cleanFiller('Okay, fix the login bug in auth.js'));

console.log('spelling (all editions share cleanFiller)');
const S = require(path.join(ROOT, 'scripts/lib/spell.js'));
check('EN typos fixed', E.cleanFiller('teh app doesnt recieve the the adress') === 'The app doesn\'t receive the address', E.cleanFiller('teh app doesnt recieve the the adress'));
check('EN case kept (Seperate → Separate, DEFINATELY → DEFINITELY)', S.fixSpelling('Seperate and DEFINATELY') === 'Separate and DEFINITELY', S.fixSpelling('Seperate and DEFINATELY'));
check('EN "i"/"im" → "I"/"I\'m" in English text', S.fixSpelling('i think im done') === 'I think I\'m done', S.fixSpelling('i think im done'));
check('VI typos and shorthand fixed', S.fixSpelling('sữa lổi đăng nhập ko dc, xãy ra nhửng dử liệu sai') === 'sửa lỗi đăng nhập không được, xảy ra những dữ liệu sai', S.fixSpelling('sữa lổi đăng nhập ko dc, xãy ra nhửng dử liệu sai'));
check('VI reduplication kept (từ từ, rất rất)', S.fixSpelling('làm từ từ, rất rất kỹ') === 'làm từ từ, rất rất kỹ');
check('code, paths, URLs untouched', S.fixSpelling('fix `teh` in src/teh.js and https://x.io/recieve teh') === 'fix `teh` in src/teh.js and https://x.io/recieve the', S.fixSpelling('fix `teh` in src/teh.js and https://x.io/recieve teh'));
check('"i" untouched in Vietnamese text', S.fixSpelling('biến i trong vòng lặp') === 'biến i trong vòng lặp');
check('product name fixed', S.fixSpelling('Promtgate và prmotgate lỗi') === 'PromptGate và PromptGate lỗi', S.fixSpelling('Promtgate và prmotgate lỗi'));
// Colin's real typos (_handoff/lessons.md, 26/11/2026): all six were left unchanged before
[
  ['kiểu Promt mới này', 'kiểu Prompt mới này'],
  ['các Promt cho TQC', 'các Prompt cho TQC'],
  ['Cho Promgate học luôn', 'Cho PromptGate học luôn'],
  ['sàn lọc kỹ', 'sàng lọc kỹ'],
  ['Đã sưả', 'Đã sửa'],
  ['YTooi không tìm thấy', 'Tôi không tìm thấy'],
].forEach(([typed, want]) => check(`real typo: "${typed}" → "${want}"`, S.fixSpelling(typed) === want, S.fixSpelling(typed)));
// the new rules must not touch valid words: qu-/gi- syllables, English words with double letters, valid floor "sàn"
[
  'quả cam và giả sử đúng',
  'đặt phòng room 1205 có view đẹp, book trước',
  'good food, see you in the pool',
  'lau sàn nhà sạch',
  'của mùa chùa địa',
  'Mình đã sửa xong',
].forEach((ok) => check(`no false fix: "${ok}"`, S.fixSpelling(ok) === ok, S.fixSpelling(ok)));
check('misplaced tone mark moved in common words (cuả, muà, điạ)', S.fixSpelling('cuả muà điạ chỉ') === 'của mùa địa chỉ', S.fixSpelling('cuả muà điạ chỉ'));
check('tone normalisation off in English text', S.fixSpelling('Qua the Tooi') === 'Qua the Tooi', S.fixSpelling('Qua the Tooi'));

console.log('rewrite');
const a1 = E.analyze('Bạn ơi giúp tôi sửa lỗi app với, nó không chạy', { pack });
const r1 = E.rewrite('Bạn ơi giúp tôi sửa lỗi app với, nó không chạy', a1, pack, t('vi'));
check('rewrite starts with Mục tiêu', r1.startsWith('Mục tiêu:'));
check('rewrite drops leading politeness', !/Mục tiêu: (Bạn ơi|Giúp tôi)/.test(r1), r1.split('\n')[0]);
check('rewrite adds context placeholder', r1.includes('Ngữ cảnh: ⟨'));
check('rewrite adds done-when', r1.includes('Hoàn thành khi:'));
const a2 = E.analyze('Can you please help me make the app better? Thanks!', { pack });
const r2 = E.rewrite('Can you please help me make the app better? Thanks!', a2, pack, t('en'));
check('EN rewrite cleans punctuation', !/[?!]{2}/.test(r2), r2.split('\n')[0]);
check('EN deep task gets Ultrathink line', r2.includes('Ultrathink.'));
check('block message under 10k chars', E.formatBlock(a2, r2, t('en')).length < 10000);
check('mid-sentence "nhé," is stripped', !/nhé/.test(E.cleanFiller('giúp tôi làm cái dashboard doanh thu cho khách sạn nhé, đẹp đẹp chút')));
const emailA = E.analyze('write me an email to my boss', { pack });
check('writing context placeholder is type-aware', E.rewrite('write me an email to my boss', emailA, pack, t('en')).includes('recipient'));
const fuA = E.analyze('Duyệt rồi, hãy render MP4 cho trailer.', { pack, followUp: true });
const coldA = E.analyze('Duyệt rồi, hãy render MP4 cho trailer.', { pack });
check(`follow-up scores higher than cold (${fuA.score} > ${coldA.score})`, fuA.score > coldA.score);

console.log('handoff: multi-session cue, block and session boot (SPEC-handoff-structure)');
const HV_PATH = 'D:\\PERSONAL\\The Quiet Concierge';
const HV = 'làm tiếp phần TQC hôm qua trong ' + HV_PATH;
const hvA = E.analyze(HV, { pack });
check('multi-session cue + drive path → handoff needed', !!hvA.handoff && hvA.handoff.needed === true, JSON.stringify(hvA.handoff));
check('handoff path is the drive path exactly', !!hvA.handoff && hvA.handoff.path === HV_PATH, hvA.handoff && hvA.handoff.path);
check('HANDOFF.md not named yet → not present', !!hvA.handoff && hvA.handoff.present === false);
check('one-off prompt → handoff not needed', E.analyze('Viết email cảm ơn khách hàng đã đặt phòng', { pack }).handoff.needed === false);
check('"continuous" does not trigger the cue "continue"', E.analyze('Viết một đoạn về continuous integration', { pack }).handoff.needed === false);
check('EN cue "overnight" → needed', E.analyze('Continue the TQC posts overnight and report back', { pack }).handoff.needed === true);
check('"./" path alone → needed', E.analyze('Kiểm tra lỗi trong ./src/app.js giúp tôi nhé', { pack }).handoff.needed === true);
const hvP = E.analyze('làm tiếp theo HANDOFF.md và GOAL.md trong ' + HV_PATH, { pack });
check('prompt naming HANDOFF.md → present (no second block)', hvP.handoff.needed === true && hvP.handoff.present === true);
check('handoff switch off → never needed', E.analyze(HV, { pack, handoff: false }).handoff.needed === false);
const hbVi = E.handoffBlock(t('vi'), HV_PATH).split('\n');
check('VI block is 6 lines, folder in line 1, HANDOFF.md in the stop rules', hbVi.length === 6 && hbVi[0].includes(HV_PATH) && /HANDOFF\.md/.test(hbVi[3]), hbVi.length + ' lines');
check('block without a path falls back to <thư mục dự án>', E.handoffBlock(t('vi'), '').includes('<thư mục dự án>'));
const hbEn = E.handoffBlock(t('en'), '').split('\n');
check('EN block is 6 lines and names GOAL.md, lessons.md, HANDOFF.md', hbEn.length === 6 && /GOAL\.md/.test(hbEn[1]) && /lessons\.md/.test(hbEn[1]) && /HANDOFF\.md/.test(hbEn[1]));
check('tipFor adds a handoff tip when needed and not present', E.tipFor(hvA, t('vi')).includes('HANDOFF.md'), E.tipFor(hvA, t('vi')));

const makeCfg = (cfgObj) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-cfg-'));
  if (cfgObj) { fs.mkdirSync(path.join(d, 'promptgate'), { recursive: true }); fs.writeFileSync(path.join(d, 'promptgate', 'config.json'), JSON.stringify(cfgObj)); }
  return d;
};
const hookIn = (cfgDir, prompt, sid) => {
  const input = { session_id: sid, cwd: cfgDir, hook_event_name: 'UserPromptSubmit', prompt };
  const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfgDir, CLAUDE_PLUGIN_ROOT: ROOT });
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/gate.js')], { input: JSON.stringify(input), encoding: 'utf8', env, timeout: 15000 });
  try { return JSON.parse(r.stdout || '{}'); } catch (_) { return {}; }
};
const ctxOf = (o) => ((o && o.hookSpecificOutput) || {}).additionalContext || '';
const hvSug = hookIn(makeCfg(null), 'làm tiếp phần TQC hôm qua', 'hv-sug');
check('suggest C carries the handoff block (no path → placeholder)', /AskUserQuestion/.test(ctxOf(hvSug)) && /HANDOFF\.md/.test(ctxOf(hvSug)) && /<thư mục dự án>/.test(ctxOf(hvSug)), ctxOf(hvSug).slice(0, 120));
const hvOff = hookIn(makeCfg({ handoff: { enabled: false } }), 'làm tiếp phần TQC hôm qua', 'hv-off');
check('handoff.enabled=false → suggestion still made, no block', /AskUserQuestion/.test(ctxOf(hvOff)) && !/HANDOFF\.md/.test(ctxOf(hvOff)));
const hvOne = hookIn(makeCfg(null), 'làm cho tôi cái này tốt hơn đi bạn ơi nhé', 'hv-one');
check('one-off weak prompt → suggestion without the block', /AskUserQuestion/.test(ctxOf(hvOne)) && !/HANDOFF\.md/.test(ctxOf(hvOne)));

const SB = path.join(ROOT, 'scripts/session-boot.js');
const tmpDir = (files) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-boot-'));
  for (const [rel, body] of Object.entries(files || {})) { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), body); }
  return d;
};
function boot(cwd, extraEnv, cfgObj) {
  const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: makeCfg(cfgObj), CLAUDE_PLUGIN_ROOT: ROOT }, extraEnv || {});
  if (!extraEnv || !('CLAUDE_PROJECT_DIR' in extraEnv)) delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync(process.execPath, [SB], { input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: 'boot', cwd }), encoding: 'utf8', env, timeout: 15000 });
  let o = {}; try { o = JSON.parse(r.stdout || '{}'); } catch (_) { o = { parseError: r.stdout }; }
  return { o, status: r.status, stdout: r.stdout || '' };
}
const bootOn = tmpDir({ 'HANDOFF.md': '# HANDOFF · demo\nĐANG CHẠY: không\n', 'GOAL.md': '# GOAL · demo\n', 'lessons.md': '# lessons\n' });
const b1 = boot(bootOn);
const ctx1 = ctxOf(b1.o);
check('SessionStart: folder with HANDOFF.md → hookSpecificOutput.additionalContext', b1.status === 0 && !!b1.o.hookSpecificOutput && b1.o.hookSpecificOutput.hookEventName === 'SessionStart' && ctx1.length > 200, b1.stdout.slice(0, 160));
check('SessionStart: context gives the read order and the stop rules', /GOAL\.md → lessons\.md → HANDOFF\.md/.test(ctx1) && /Không sửa GOAL\.md/.test(ctx1) && /XONG · ĐANG MỞ/.test(ctx1));
check('SessionStart: context shows the ĐANG CHẠY status as data', /ĐANG CHẠY: không/.test(ctx1));
check('SessionStart: context stays under the 10,000-char hook cap', ctx1.length < 9000, String(ctx1.length));
check('SessionStart: folder without handoff files → {} (silent)', Object.keys(boot(tmpDir({ 'README.md': 'x' })).o).length === 0);
check('SessionStart: finds the files in _handoff/', ctxOf(boot(tmpDir({ '_handoff/HANDOFF.md': 'ĐANG CHẠY: không\n' })).o).includes('_handoff'));
check('SessionStart: CLAUDE_PROJECT_DIR wins over cwd', ctxOf(boot(tmpDir({}), { CLAUDE_PROJECT_DIR: bootOn }).o).length > 200);
check('SessionStart: handoff.enabled=false → {}', Object.keys(boot(bootOn, null, { handoff: { enabled: false } }).o).length === 0);
const bootBad = spawnSync(process.execPath, [SB], { input: 'garbage', encoding: 'utf8', cwd: makeCfg(null), env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: makeCfg(null), CLAUDE_PLUGIN_ROOT: ROOT }), timeout: 15000 });
check('SessionStart: garbage stdin fails open', bootBad.status === 0 && bootBad.stdout.trim() === '{}', bootBad.stdout);
const hooksJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks/hooks.json'), 'utf8'));
check('hooks.json: SessionStart runs scripts/session-boot.js', JSON.stringify(hooksJson.hooks.SessionStart || []).includes('session-boot.js'));
check('hooks.json: UserPromptSubmit still runs gate.js', JSON.stringify(hooksJson.hooks.UserPromptSubmit || []).includes('gate.js'));

console.log('hook end-to-end');
function hook(prompt, extra) {
  const input = Object.assign({ session_id: 'test-session', cwd: TMP, hook_event_name: 'UserPromptSubmit', prompt }, extra || {});
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/gate.js')], { input: JSON.stringify(input), encoding: 'utf8', env: process.env, timeout: 15000 });
  let out = {}; try { out = JSON.parse(r.stdout || '{}'); } catch (_) { out = { parseError: r.stdout }; }
  return { out, status: r.status, stderr: r.stderr };
}
let h = hook('ok');
check('ack passes untouched', h.status === 0 && !h.out.decision && !h.out.systemMessage);
h = hook('/promptgate:status');
check('slash command passes', h.status === 0 && Object.keys(h.out).length === 0);
h = hook('<task-notification>\n<status>completed</status>\n</task-notification>');
check('automated event passes', Object.keys(h.out).length === 0);
h = hook('làm cho tôi cái này tốt hơn đi bạn ơi nhé', { agent_id: 'sub-1' });
check('subagent prompt passes', Object.keys(h.out).length === 0);
h = hook('// làm cho tôi cái này tốt hơn đi bạn ơi');
check('// bypass passes', Object.keys(h.out).length === 0);
h = hook('làm cho tôi cái này tốt hơn đi bạn ơi nhé', { session_id: 'sug' });
check('suggest mode: weak prompt NOT blocked', !h.out.decision, JSON.stringify(h.out).slice(0, 160));
check('suggest mode: instructs AskUserQuestion with A/B/C', /AskUserQuestion/.test(JSON.stringify(h.out)) && /A · Gọn/.test(JSON.stringify(h.out)) && /C · Sâu/.test(JSON.stringify(h.out)), JSON.stringify(h.out).slice(0, 200));
check('suggest mode: recommends C for deep build task', /lựa chọn C lên đầu/.test(h.out.hookSpecificOutput.additionalContext));
check('suggest mode: one-line system message', /đề xuất 3 bản/.test(h.out.systemMessage || ''));
h = hook('fix this please thanks a lot', { session_id: 'sug-en' });
check('suggest mode EN wording', /A · Lean/.test(JSON.stringify(h.out)) && /Send as written/.test(JSON.stringify(h.out)));
fs.mkdirSync(path.join(TMP, 'promptgate'), { recursive: true });
fs.writeFileSync(path.join(TMP, 'promptgate', 'config.json'), JSON.stringify({ action: 'block' }));
h = hook('làm cho tôi cái này tốt hơn đi bạn ơi nhé');
check('block mode: weak prompt blocked', h.out.decision === 'block' && /PromptGate ▸ \d+\/100/.test(h.out.reason || ''), JSON.stringify(h.out).slice(0, 200));
check('block suppresses original prompt', h.out.hookSpecificOutput && h.out.hookSpecificOutput.suppressOriginalPrompt === true);
const suggested = (h.out.reason || '').split('\n').find((l) => l.startsWith('Mục tiêu:')) || '';
h = hook('làm cho tôi cái này tốt hơn đi bạn ơi nhé');
check('cooldown lets the next prompt through', Object.keys(h.out).length === 0, JSON.stringify(h.out).slice(0, 120));
h = hook(suggested + '\nNgữ cảnh: file app.js');
check('resending the suggestion is accepted (or scored, never blocked)', h.out.decision !== 'block', JSON.stringify(h.out).slice(0, 160));
h = hook('Xây một app Electron kiểu Kahoot cho công ty event, chạy trên laptop MC, cổng 3777', { session_id: 'mid' });
check('mid-band prompt shows score + injects depth', !h.out.decision && /PromptGate \d+\/100/.test(h.out.systemMessage || '') && /additionalContext/.test(JSON.stringify(h.out)), JSON.stringify(h.out).slice(0, 200));
h = hook('Viết email xin nghỉ phép 2 ngày gửi sếp, giọng lịch sự, dưới 120 từ, tiếng Việt', { session_id: 'good' });
check('good prompt passes silently', Object.keys(h.out).length === 0, JSON.stringify(h.out).slice(0, 120));
h = hook('Sửa lỗi đăng nhập trong hrfsvt-app/server/auth.js: khi sai mật khẩu 3 lần vẫn cho vào. Không đổi schema DB.', { session_id: 'fu' });
h = hook('Viết email xin nghỉ phép 2 ngày gửi sếp, giọng lịch sự, dưới 120 từ, tiếng Việt', { session_id: 'fu' });
h = hook('Duyệt rồi, hãy render MP4 cho trailer.', { session_id: 'fu' });
check('3rd-turn follow-up is not blocked', h.out.decision !== 'block', JSON.stringify(h.out).slice(0, 160));
const g = spawnSync(process.execPath, [path.join(ROOT, 'scripts/gate.js')], { input: 'garbage', encoding: 'utf8', env: process.env, timeout: 15000 });
check('garbage stdin fails open', g.status === 0 && g.stdout.trim() === '{}');
fs.writeFileSync(path.join(TMP, 'promptgate', 'config.json'), JSON.stringify({ mode: 'off' }));
h = hook('làm cho tôi cái này tốt hơn đi bạn ơi nhé', { session_id: 'other' });
check('mode off disables the gate', Object.keys(h.out).length === 0);
const logLines = fs.readFileSync(path.join(TMP, 'promptgate', 'log.jsonl'), 'utf8').trim().split('\n');
check('log written without prompt text', logLines.length > 0 && !logLines.some((l) => l.includes('cái này tốt hơn')));

console.log('perf');
const t0 = Date.now(); for (let i = 0; i < 500; i++) E.analyze(cases[7][0], { pack }); const ms = (Date.now() - t0) / 500;
check(`analyze < 2 ms avg (${ms.toFixed(2)} ms)`, ms < 2);

console.log('tray (phase 2, non-UI)');
const tr = spawnSync(process.execPath, [path.join(ROOT, 'tests/tray.js')], { encoding: 'utf8', env: process.env, timeout: 120000 });
const trSummary = (tr.stdout || '').trim().split('\n').pop() || '';
check(`tests/tray.js green (${trSummary})`, tr.status === 0, (tr.stdout || '').split('\n').filter((l) => /FAIL/.test(l)).join(' | ') || tr.stderr);

console.log('doctor (all editions)');
const dr = spawnSync(process.execPath, [path.join(ROOT, 'tests/doctor.js')], { encoding: 'utf8', env: process.env, timeout: 180000 });
const drSummary = (dr.stdout || '').trim().split('\n').pop() || '';
check(`tests/doctor.js green (${drSummary})`, dr.status === 0, (dr.stdout || '').split('\n').filter((l) => /FAIL/.test(l)).join(' | ') || dr.stderr);

console.log('chrome extension (phase 3, claude.ai)');
const ext = spawnSync(process.execPath, [path.join(ROOT, 'tests/extension.js')], { encoding: 'utf8', env: process.env, timeout: 120000 });
const extSummary = (ext.stdout || '').trim().split('\n').pop() || '';
check(`tests/extension.js green (${extSummary})`, ext.status === 0, (ext.stdout || '').split('\n').filter((l) => /FAIL/.test(l)).join(' | ') || ext.stderr);

console.log('video studio (web app + APK staging)');
const vid = spawnSync(process.execPath, [path.join(ROOT, 'video/tests/video.js')], { encoding: 'utf8', env: process.env, timeout: 240000 });
const vidSummary = (vid.stdout || '').trim().split('\n').pop() || '';
check(`video/tests/video.js green (${vidSummary})`, vid.status === 0, (vid.stdout || '').split('\n').filter((l) => /FAIL/.test(l)).join(' | ') || vid.stderr);

console.log('packaging');
const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {};
const missingFiles = Object.entries(scripts).map(([n, c]) => { const m = /node\s+(\S+\.js)/.exec(c); return m && !fs.existsSync(path.join(ROOT, m[1])) ? n + ' -> ' + m[1] : null; }).filter(Boolean);
check('every npm script points at an existing file', missingFiles.length === 0, missingFiles.join(', '));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
