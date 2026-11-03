'use strict';
// Tier 2: LLM rewrite. Prefers `claude -p` (reuses the user's own Claude login, no API
// billing); falls back to the Anthropic API when ANTHROPIC_API_KEY is set. Any failure → null,
// and the caller keeps the rule-based rewrite. Never used on history scans.
const { spawnSync } = require('child_process');

const MODEL_IDS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };

function systemPrompt(a, T) {
  const langName = a.lang === 'vi' ? 'Vietnamese' : 'English';
  return [
    'You are PromptGate, a prompt optimizer for Claude Code.',
    `Rewrite the user's prompt in ${langName}. Keep the user's intent and every concrete detail (paths, names, numbers, quotes).`,
    'Make it shorter where words add nothing (greetings, politeness, repetition) and more complete where it matters:',
    `- Task type detected: ${a.type}; depth profile: ${a.depth}; weak dimensions: ${a.missing.join(', ') || 'none'}.`,
    `- Use these line labels in this order when relevant: ${T.labels.goal}, ${T.labels.context}, ${T.labels.output}, ${T.labels.constraints}, ${T.labels.done}.`,
    '- Where information is missing and you cannot infer it, write a short placeholder inside ⟨ ⟩ instead of inventing it.',
    a.depth === 'deep' ? `- End with exactly this line: ${T.deepLine}` : a.depth === 'standard' ? `- End with exactly this line: ${T.standardLine}` : '- Do not add thinking instructions; this is a light task.',
    '- Output only the rewritten prompt. No preamble, no explanation, no markdown fences.',
  ].join('\n');
}

function viaCli(prompt, system, cfg) {
  const env = Object.assign({}, process.env);
  delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT; delete env.CLAUDE_CODE_SSE_PORT;
  const bin = process.env.PROMPTGATE_CLAUDE_BIN || 'claude';
  const args = ['-p', '--model', cfg.llmModel || 'haiku', '--output-format', 'text', '--system-prompt', system];
  try {
    const r = spawnSync(bin, args, { input: prompt, env, timeout: cfg.llmTimeoutMs || 20000, encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    if (r.status === 0 && r.stdout && r.stdout.trim()) return r.stdout.trim();
  } catch (_) {}
  return null;
}

async function viaApi(prompt, system, cfg) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || typeof fetch !== 'function') return null;
  const model = MODEL_IDS[cfg.llmModel] || cfg.llmModel || MODEL_IDS.haiku;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.llmTimeoutMs || 20000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 800, system, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    return text || null;
  } catch (_) { return null; } finally { clearTimeout(timer); }
}

async function rewrite(prompt, a, cfg, T) {
  const system = systemPrompt(a, T);
  const cli = viaCli(prompt, system, cfg);
  if (cli) return cli;
  return viaApi(prompt, system, cfg);
}

module.exports = { rewrite, systemPrompt, MODEL_IDS };