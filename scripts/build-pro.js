#!/usr/bin/env node
'use strict';
// Builds the Pro zip for Gumroad: pro/packs/*.json + a short README → dist/promptgate-pro-<version>.zip
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const PRODUCT = require('./lib/product');
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'pro', 'packs');
const stage = path.join(root, 'dist', 'stage', 'promptgate-pro');
const out = path.join(root, 'dist', `promptgate-pro-${PRODUCT.version}.zip`);
fs.rmSync(path.join(root, 'dist', 'stage'), { recursive: true, force: true });
fs.mkdirSync(path.join(stage, 'packs'), { recursive: true });
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.json'))) fs.copyFileSync(path.join(src, f), path.join(stage, 'packs', f));
fs.writeFileSync(path.join(stage, 'README.txt'), [
  `PromptGate Pro ${PRODUCT.version}`, '',
  '1. Install the free plugin if you have not:',
  '   claude plugin marketplace add huuthanhueh-debug/promptgate',
  '   claude plugin install promptgate@promptgate',
  '2. Copy the files in packs/ to:  ~/.claude/promptgate/packs/   (Windows: %USERPROFILE%\\.claude\\promptgate\\packs\\)',
  '3. In Claude Code run:  /promptgate:activate <YOUR-LICENSE-KEY>   (the key is in your Gumroad receipt)',
  '4. Check with /promptgate:status — it should list coding, writing, business, hospitality.',
  '5. Optional: /promptgate:brain llm  to enable tier-2 rewrites through your own `claude -p` login.', '',
  'Updates for 12 months are delivered through your Gumroad library. Support: huuthanhueh@gmail.com',
].join('\n'));
fs.rmSync(out, { force: true });
if (process.platform === 'win32') execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${stage}\\*' -DestinationPath '${out}' -Force"`);
else execSync(`cd "${path.dirname(stage)}" && zip -qr "${out}" "${path.basename(stage)}"`);
console.log('built', out, fs.statSync(out).size, 'bytes');