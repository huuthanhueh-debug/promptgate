#!/usr/bin/env node
'use strict';
// Chấm điểm thư viện prompt bằng engine PromptGate của repo này.
// Dùng:  node OUTPUTS/claude-web-design-viktor-oddy/tools/score-prompts.js [file.txt ...] [--min 80] [--write]
//   file.txt  file prompt dạng "=== [ID] Tên ===" (mặc định: prompts-goc.txt và prompts.txt cạnh thư mục tools/)
//   --min N   ngưỡng tối thiểu cho mọi prompt không phải prompt gốc G-xx (mặc định 80); dưới ngưỡng thì thoát mã 1
//   --write   ghi kết quả ra scores.md trong thư mục của file đầu tiên
const fs = require('fs');
const path = require('path');

const HERE = path.resolve(__dirname, '..');
const ROOT = path.resolve(HERE, '..', '..');
const E = require(path.join(ROOT, 'scripts', 'lib', 'engine'));
const packs = require(path.join(ROOT, 'scripts', 'lib', 'packs'));
const { t } = require(path.join(ROOT, 'scripts', 'lib', 'i18n'));

const args = process.argv.slice(2);
const minIdx = args.indexOf('--min');
const MIN = minIdx >= 0 ? Number(args[minIdx + 1]) : 80;
const WRITE = args.includes('--write');
const positional = args.filter((a, i) => !a.startsWith('--') && !(minIdx >= 0 && i === minIdx + 1));
const FILES = positional.length
  ? positional.map((f) => path.resolve(f))
  : ['prompts-goc.txt', 'prompts.txt'].map((f) => path.join(HERE, f));
const OUT_DIR = path.dirname(FILES[0]);

function parse(file) {
  const text = fs.readFileSync(file, 'utf8');
  const re = /^=== \[([A-Z]-\d+)\] (.+?) ===$/gm;
  const heads = [...text.matchAll(re)];
  return heads.map((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    return { id: m[1], title: m[2], body: text.slice(start, end).trim() };
  });
}

const pack = packs.load();
const T = t('vi');
const rows = [];
for (const file of FILES) {
  for (const p of parse(file)) {
    const a = E.analyze(p.body, { pack });
    rows.push({
      id: p.id,
      title: p.title,
      type: (T.types && T.types[a.type]) || a.type,
      depth: (T.depth && T.depth[a.depth]) || a.depth,
      score: a.score,
      missing: a.missing.map((k) => (T.dims && T.dims[k]) || k).join(', ') || 'đủ',
    });
  }
}

const line = (r) => `| ${r.id} | ${r.title} | ${r.type} | ${r.depth} | **${r.score}** | ${r.missing} |`;
const table = [
  '| ID | Prompt | Loại việc | Chiều sâu | Điểm | Còn thiếu |',
  '|---|---|---|---|---|---|',
  ...rows.map(line),
].join('\n');

const orig = rows.filter((r) => r.id.startsWith('G-'));
const upg = rows.filter((r) => !r.id.startsWith('G-'));
const avg = (xs) => Math.round(xs.reduce((s, r) => s + r.score, 0) / (xs.length || 1));
const below = upg.filter((r) => r.score < MIN);
const summary = [
  orig.length ? `Prompt gốc trong video: ${orig.length} prompt, điểm trung bình ${avg(orig)}/100.` : null,
  `Prompt nâng cấp: ${upg.length} prompt, điểm trung bình ${avg(upg)}/100, thấp nhất ${Math.min(...upg.map((r) => r.score))}.`,
  below.length ? `DƯỚI NGƯỠNG ${MIN}: ${below.map((r) => r.id).join(', ')}` : `Tất cả prompt nâng cấp đạt ngưỡng ${MIN}.`,
].filter(Boolean).join('\n');

console.log(table + '\n\n' + summary);

if (WRITE) {
  const md = [
    '# Điểm PromptGate của thư viện prompt',
    '',
    `Chấm bằng engine PromptGate (scripts/lib/engine.js), gói ${pack.ids.join(', ')}. Chạy lại: \`node OUTPUTS/claude-web-design-viktor-oddy/tools/score-prompts.js ${positional.length ? positional.map((f) => path.relative(ROOT, path.resolve(f))).join(' ') + ' ' : ''}--write\`.`,
    '',
    table,
    '',
    summary.split('\n').map((s) => `- ${s}`).join('\n'),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'scores.md'), md);
  console.log('\nĐã ghi scores.md');
}

process.exit(below.length ? 1 : 0);
