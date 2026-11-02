#!/usr/bin/env node
'use strict';
// /promptgate:history — scan every Claude Code transcript on this machine, score each human
// prompt with the same engine the hook uses, and write a local report. Nothing leaves the machine.
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const cfgm = require('./lib/config');
const packs = require('./lib/packs');
const E = require('./lib/engine');
const L = require('./lib/lexicon');
const { t } = require('./lib/i18n');

const PROJECTS = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');

function parseArgs(argv) {
  const o = { days: 30, limit: null, json: false, lang: null };
  for (const a of argv) {
    if (a === '--all') o.days = 36500;
    else if (a === '--json') o.json = true;
    else if (/^--lang=(vi|en)$/.test(a)) o.lang = a.split('=')[1];
    else if (/^--limit=\d+$/.test(a)) o.limit = +a.split('=')[1];
    else if (/^\d+$/.test(a)) o.days = +a;
  }
  return o;
}

function extractText(msg) {
  const c = msg && msg.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    if (c.some((x) => x && x.type === 'tool_result')) return null;
    return c.filter((x) => x && x.type === 'text' && typeof x.text === 'string').map((x) => x.text).join('\n');
  }
  return null;
}

function isHumanPrompt(o, text, minWords) {
  if (!o || o.type !== 'user' || !o.message || o.message.role !== 'user') return false;
  if (o.isMeta || o.isSidechain) return false;
  if (o.promptSource && /scheduled|loop|agent|automation|remote|hook|system/i.test(String(o.promptSource))) return false;
  if (!text) return false;
  const s = text.trim();
  if (!s || s.startsWith('<') || s.startsWith('/')) return false;
  if (L.AUTOMATED_TEXT.test(s) || E.R.ACK.test(s)) return false;
  if (E.words(s).length < minWords) return false;
  return true;
}

async function scanFile(file, since, minWords, pack, language, acc) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  let cwd = null;
  let idx = 0;
  for await (const line of rl) {
    if (!line || line.indexOf('"type":"user"') === -1) continue;
    let o; try { o = JSON.parse(line); } catch (_) { continue; }
    if (!cwd && o.cwd) cwd = o.cwd;
    const ts = Date.parse(o.timestamp || 0);
    if (!ts || ts < since) continue;
    const text = extractText(o.message);
    if (!isHumanPrompt(o, text, minWords)) continue;
    idx += 1;
    const a = E.analyze(text, { pack, language, followUp: idx > 2 });
    acc.push({ ts: new Date(ts).toISOString(), file: path.basename(file), score: a.score, type: a.type, depth: a.depth, lang: a.lang, dims: a.dims, missing: a.missing, filler: a.excess.filler, words: a.nWords, text: text.trim().slice(0, 400) });
  }
  return cwd;
}

function isoWeek(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return `${x.getUTCFullYear()}-W${String(Math.ceil(((x - y0) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : 0);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

function aggregate(entries) {
  const scores = entries.map((e) => e.score);
  const sorted = [...scores].sort((a, b) => a - b);
  const dist = { lt30: 0, b30_49: 0, b50_74: 0, ge75: 0 };
  for (const s of scores) { if (s < 30) dist.lt30++; else if (s < 50) dist.b30_49++; else if (s < 75) dist.b50_74++; else dist.ge75++; }
  const dims = {};
  for (const k of Object.keys(E.MAX)) dims[k] = pct(avg(entries.map((e) => e.dims[k])), E.MAX[k]);
  const missing = {}; const types = {}; const weeks = {}; const projects = {};
  for (const e of entries) {
    for (const m of e.missing) missing[m] = (missing[m] || 0) + 1;
    types[e.type] = (types[e.type] || 0) + 1;
    const w = isoWeek(new Date(e.ts)); (weeks[w] = weeks[w] || []).push(e.score);
    (projects[e.project] = projects[e.project] || []).push(e.score);
  }
  const fillerTotal = entries.reduce((s, e) => s + e.filler, 0);
  return {
    count: entries.length, avg: avg(scores), median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
    dist, dims, types, fillerTotal,
    missing: Object.entries(missing).sort((a, b) => b[1] - a[1]),
    weeks: Object.entries(weeks).sort().map(([w, xs]) => ({ week: w, count: xs.length, avg: avg(xs) })),
    projects: Object.entries(projects).map(([p, xs]) => ({ project: p, count: xs.length, avg: avg(xs) })).sort((a, b) => b.count - a.count),
    worst: [...entries].sort((a, b) => a.score - b.score),
  };
}

function bar(p) { const n = Math.round(p / 10); return '█'.repeat(n) + '░'.repeat(10 - n); }

function renderMarkdown(agg, pack, lang, days, pro) {
  const T = t(lang);
  const vi = lang === 'vi';
  const L2 = vi ? {
    title: 'PromptGate · Báo cáo lịch sử prompt', scope: (d, n) => `${d >= 36500 ? 'Toàn bộ lịch sử' : d + ' ngày gần nhất'} · ${n} prompt do bạn gõ · chỉ đọc cục bộ, không gửi đi đâu`,
    overall: 'Tổng quan', avgS: 'Điểm trung bình', med: 'Trung vị', dist: 'Phân bố', blocked: 'sẽ bị chặn (<50)', shown: 'hiện điểm (50–74)', silent: 'đi thẳng (≥75)',
    dims: 'Bảy chiều (trung bình, % điểm tối đa)', weak: 'Ba điểm yếu lớn nhất', filler: (n, c) => `Câu xã giao: ${n} lần trong ${c} prompt`,
    types: 'Loại việc', weeks: 'Xu hướng theo tuần', projects: 'Theo project', worst: (n) => `${n} prompt yếu nhất kèm bản viết lại`,
    proNote: 'Bản Pro mở khóa: theo project, xu hướng tuần, 20 prompt yếu nhất kèm viết lại, dashboard HTML. → /promptgate:activate',
    next: 'Bước tiếp theo', nextBody: 'Giữ mode balanced 1 tuần rồi chạy lại /promptgate:history 7 để xem tiến bộ.',
  } : {
    title: 'PromptGate · Prompt history report', scope: (d, n) => `${d >= 36500 ? 'Entire history' : 'last ' + d + ' days'} · ${n} prompts you typed · read locally, nothing sent anywhere`,
    overall: 'Overview', avgS: 'Average score', med: 'Median', dist: 'Distribution', blocked: 'would be blocked (<50)', shown: 'score shown (50–74)', silent: 'pass silently (≥75)',
    dims: 'Seven dimensions (average, % of max)', weak: 'Top three weaknesses', filler: (n, c) => `Filler phrases: ${n} across ${c} prompts`,
    types: 'Task types', weeks: 'Weekly trend', projects: 'By project', worst: (n) => `${n} weakest prompts with rewrites`,
    proNote: 'Pro unlocks: per-project breakdown, weekly trend, 20 weakest prompts with rewrites, HTML dashboard. → /promptgate:activate',
    next: 'Next step', nextBody: 'Keep balanced mode for a week, then run /promptgate:history 7 to see progress.',
  };
  const out = [];
  out.push(`# ${L2.title}`, '', L2.scope(days, agg.count), '');
  out.push(`## ${L2.overall}`, '', `- ${L2.avgS}: **${agg.avg}/100** · ${L2.med}: ${agg.median}`);
  out.push(`- ${L2.dist}: ${pct(agg.dist.lt30 + agg.dist.b30_49, agg.count)}% ${L2.blocked} · ${pct(agg.dist.b50_74, agg.count)}% ${L2.shown} · ${pct(agg.dist.ge75, agg.count)}% ${L2.silent}`);
  out.push(`- ${L2.filler(agg.fillerTotal, agg.count)}`, '');
  out.push(`## ${L2.dims}`, '');
  for (const k of Object.keys(E.MAX)) out.push(`- ${T.dims[k].padEnd(22)} ${bar(agg.dims[k])} ${agg.dims[k]}%`);
  out.push('', `## ${L2.weak}`, '');
  for (const [k, n] of agg.missing.slice(0, 3)) out.push(`- **${T.dims[k]}** (${pct(n, agg.count)}% prompt) — ${T.tips[k]}`);
  out.push('', `## ${L2.types}`, '');
  for (const [k, n] of Object.entries(agg.types).sort((a, b) => b[1] - a[1])) out.push(`- ${T.types[k] || k}: ${n} (${pct(n, agg.count)}%)`);
  if (pro) {
    out.push('', `## ${L2.weeks}`, '', '| ' + (vi ? 'Tuần' : 'Week') + ' | n | avg |', '|---|---|---|');
    for (const w of agg.weeks) out.push(`| ${w.week} | ${w.count} | ${w.avg} |`);
    out.push('', `## ${L2.projects}`, '', '| project | n | avg |', '|---|---|---|');
    for (const p of agg.projects) out.push(`| ${p.project} | ${p.count} | ${p.avg} |`);
  }
  const n = pro ? 20 : 5;
  out.push('', `## ${L2.worst(n)}`, '');
  for (const e of agg.worst.slice(0, n)) {
    const a = E.analyze(e.text, { pack, language: lang === 'auto' ? undefined : undefined });
    const TT = t(a.lang);
    out.push(`### ${e.score}/100 · ${TT.types[e.type] || e.type} · ${e.ts.slice(0, 10)}`, '', '> ' + e.text.replace(/\n+/g, ' ').slice(0, 220), '', '```', E.rewrite(e.text, a, pack, TT), '```', '');
  }
  if (!pro) out.push('', `_${L2.proNote}_`);
  out.push('', `## ${L2.next}`, '', L2.nextBody, '');
  return out.join('\n');
}

function renderHtml(agg, lang) {
  const T = t(lang);
  const rows = agg.weeks.map((w) => `<tr><td>${w.week}</td><td>${w.count}</td><td><div class="b" style="width:${w.avg}%"></div>${w.avg}</td></tr>`).join('');
  const dims = Object.keys(E.MAX).map((k) => `<tr><td>${T.dims[k]}</td><td><div class="b" style="width:${agg.dims[k]}%"></div>${agg.dims[k]}%</td></tr>`).join('');
  const projects = agg.projects.map((p) => `<tr><td>${p.project}</td><td>${p.count}</td><td><div class="b" style="width:${p.avg}%"></div>${p.avg}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>PromptGate dashboard</title><style>
  :root{--fg:#1d1d1f;--bg:#fff;--muted:#6e6e73;--bar:#0a84ff;--line:#e5e5ea}
  @media(prefers-color-scheme:dark){:root{--fg:#f5f5f7;--bg:#111;--muted:#98989d;--bar:#64d2ff;--line:#2c2c2e}}
  body{font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--fg);background:var(--bg);max-width:860px;margin:32px auto;padding:0 16px}
  h1{font-size:22px;margin:0 0 4px}.m{color:var(--muted)}table{width:100%;border-collapse:collapse;margin:8px 0 24px}td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
  .b{display:inline-block;height:10px;background:var(--bar);border-radius:5px;margin-right:8px;vertical-align:middle;min-width:2px}.big{font-size:40px;font-weight:600}
  </style></head><body><h1>PromptGate</h1><div class="m">${agg.count} prompts · ${new Date().toISOString().slice(0, 10)}</div>
  <p class="big">${agg.avg}<span class="m" style="font-size:18px">/100</span></p>
  <h3>${lang === 'vi' ? 'Bảy chiều' : 'Dimensions'}</h3><table>${dims}</table>
  <h3>${lang === 'vi' ? 'Theo tuần' : 'Weekly'}</h3><table>${rows}</table>
  <h3>${lang === 'vi' ? 'Theo project' : 'Projects'}</h3><table>${projects}</table></body></html>`;
}

(async () => {
  const o = parseArgs(process.argv.slice(2));
  const cfg = cfgm.loadConfig(process.cwd());
  const pack = packs.load();
  const pro = cfgm.isPro();
  const since = Date.now() - o.days * 86400e3;
  const entries = [];
  let dirs = [];
  try { dirs = fs.readdirSync(PROJECTS).map((d) => path.join(PROJECTS, d)).filter((d) => fs.statSync(d).isDirectory()); } catch (_) {}
  for (const dir of dirs) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
    const before = entries.length;
    let cwd = null;
    for (const f of files) { const c = await scanFile(f, since, cfg.minWords, pack, cfg.language, entries); if (c && !cwd) cwd = c; }
    const label = cwd ? path.basename(cwd) : path.basename(dir);
    for (let i = before; i < entries.length; i++) entries[i].project = label;
  }
  if (!entries.length) { console.log(`PromptGate: no human prompts found in ${PROJECTS} for the last ${o.days} days.`); return; }
  const agg = aggregate(entries);
  const lang = o.lang || (cfg.language !== 'auto' ? cfg.language : (entries.filter((e) => e.lang === 'vi').length * 2 >= entries.length ? 'vi' : 'en'));
  cfgm.ensureHome(); fs.mkdirSync(cfgm.FILES.reports, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
  const md = renderMarkdown(agg, pack, lang, o.days, pro);
  const mdPath = path.join(cfgm.FILES.reports, `history-${stamp}.md`);
  fs.writeFileSync(mdPath, md);
  let htmlPath = null;
  if (pro) { htmlPath = path.join(cfgm.FILES.reports, `dashboard-${stamp}.html`); fs.writeFileSync(htmlPath, renderHtml(agg, lang)); }
  cfgm.writeJson(cfgm.FILES.history, { generatedAt: new Date().toISOString(), days: o.days, count: agg.count, avg: agg.avg, dims: agg.dims, weeks: agg.weeks, projects: agg.projects, missing: agg.missing, types: agg.types });
  if (o.json) { console.log(JSON.stringify({ agg: Object.assign({}, agg, { worst: agg.worst.slice(0, o.limit || 20) }), mdPath, htmlPath }, null, 2)); return; }
  console.log(md);
  console.log(`\n_${lang === 'vi' ? 'Đã lưu' : 'Saved'}: ${mdPath}${htmlPath ? ' · ' + htmlPath : ''}_`);
})().catch((e) => { console.error('PromptGate history failed:', e.message); process.exit(1); });