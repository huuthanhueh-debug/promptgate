'use strict';
// Runs every Vision 6D test suite that needs nothing but Node: node tests/run.js
// (The browser suites, tests/mobile-e2e.js and tests/desktop-e2e.js, need Playwright and are run separately.)
const path = require('path');
const { spawnSync } = require('child_process');

let failed = 0;
for (const suite of ['mobile.js', 'desktop.js']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, suite)], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '').trim().split('\n');
  const summary = out[out.length - 1] || '';
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} tests/${suite}  ${summary}`);
  for (const line of out) if (/^\s+(FAIL|skip)/.test(line)) console.log('     ' + line.trim());
  if (!ok && r.stderr) console.log(r.stderr.trim());
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nall suites passed');
process.exit(failed ? 1 : 0);
