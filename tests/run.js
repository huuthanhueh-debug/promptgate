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
check('build detected', E.analyze('Tạo trang landing page cho sản phẩm mới', { pack }).type === 'build');
check('question detected', E.analyze('Tại sao Node dùng event loop?', { pack }).type === 'question');
check('write detected', E.analyze('Viết caption Facebook cho khuyến mãi tháng 11', { pack }).type === 'write');
check('fast cue → light', E.analyze('Xây nhanh một script đổi tên file trong thư mục này', { pack }).depth === 'light');
check('max cue → deep', E.analyze('Sửa chữ tiêu đề, làm kỹ nhất có thể', { pack }).depth === 'deep');

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
h = hook('làm cho tôi cái này tốt hơn đi bạn ơi nhé');
check('weak prompt blocked', h.out.decision === 'block' && /PromptGate ▸ \d+\/100/.test(h.out.reason || ''), JSON.stringify(h.out).slice(0, 200));
check('block suppresses original prompt', h.out.hookSpecificOutput && h.out.hookSpecificOutput.suppressOriginalPrompt === true);
const suggested = (h.out.reason || '').split('\n').find((l) => l.startsWith('Mục tiêu:')) || '';
h = hook('làm cho tôi cái này tốt hơn đi bạn ơi nhé');
check('cooldown lets the next prompt through', Object.keys(h.out).length === 0, JSON.stringify(h.out).slice(0, 120));
h = hook(suggested + '\nNgữ cảnh: file app.js');
check('resending the suggestion is accepted (or scored, never blocked)', h.out.decision !== 'block', JSON.stringify(h.out).slice(0, 160));
h = hook('Xây một app Electron kiểu Kahoot cho công ty event, chạy trên laptop MC, cổng 3777');
check('mid-band prompt shows score + injects depth', !h.out.decision && /PromptGate \d+\/100/.test(h.out.systemMessage || '') && /additionalContext/.test(JSON.stringify(h.out)), JSON.stringify(h.out).slice(0, 200));
h = hook('Viết email xin nghỉ phép 2 ngày gửi sếp, giọng lịch sự, dưới 120 từ, tiếng Việt');
check('good prompt passes silently', Object.keys(h.out).length === 0, JSON.stringify(h.out).slice(0, 120));
h = hook('not json at all', {}); // still JSON input; now test garbage stdin
const g = spawnSync(process.execPath, [path.join(ROOT, 'scripts/gate.js')], { input: 'garbage', encoding: 'utf8', env: process.env, timeout: 15000 });
check('garbage stdin fails open', g.status === 0 && g.stdout.trim() === '{}');
fs.writeFileSync(path.join(TMP, 'promptgate', 'config.json'), JSON.stringify({ mode: 'off' }));
h = hook('làm cho tôi cái này tốt hơn đi bạn ơi nhé', { session_id: 'other' });
check('mode off disables the gate', Object.keys(h.out).length === 0);
const logLines = fs.readFileSync(path.join(TMP, 'promptgate', 'log.jsonl'), 'utf8').trim().split('\n');
check('log written without prompt text', logLines.length > 0 && !logLines.some((l) => l.includes('cái này tốt hơn')));

console.log('perf');
const t0 = Date.now(); for (let i = 0; i < 500; i++) E.analyze(cases[6][0], { pack }); const ms = (Date.now() - t0) / 500;
check(`analyze < 2 ms avg (${ms.toFixed(2)} ms)`, ms < 2);

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);