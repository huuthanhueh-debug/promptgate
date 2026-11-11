'use strict';
// Vision 6D end-to-end smoke test: drives the real page in headless Chromium at phone size with a
// fake camera. Optional: needs Playwright, which this repo does not depend on, so it is not part
// of tests/run.js and it skips (exit 0) when Playwright is missing.
//   node tests/mobile-e2e.js            # V6D_SHOTS=<dir> also writes screenshots there
const fs = require('fs');
const http = require('http');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  console.log('skipped: playwright is not installed');
  process.exit(0);
}

const SRC = path.resolve(__dirname, '..'); // serves core/ and mobile/ side by side
const SHOTS = process.env.V6D_SHOTS || '';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

(async () => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(SRC, rel);
    if (!/^(core|mobile)\//.test(rel) || !file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/mobile/index.html`;
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ['camera'], locale: 'vi-VN' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const snap = () => page.evaluate(() => window.__v6d.snapshot());
  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
  const slide = (id, v) => page.$eval('#' + id, (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);

  try {
    console.log('home');
    await page.goto(url);
    await page.waitForFunction(() => !!window.__v6d);
    await page.waitForFunction(() => !document.getElementById('shutter').disabled, null, { timeout: 15000 }).catch(() => {});
    check('camera preview starts (fake device) and enables the shutter', await page.$eval('#shutter', (b) => !b.disabled));
    check('starts in Vietnamese on a Vietnamese device', (await snap()).lang === 'vi' && (await page.textContent('#pick')) === 'Thư viện' && (await page.textContent('#home [data-lang-toggle]')) === 'EN');
    await shot('1-home');

    console.log('body mode');
    await page.click('#demo-person');
    await page.waitForFunction(() => window.__v6d.snapshot().rendering);
    await page.waitForTimeout(500);
    let s = await snap();
    check('a person photo switches to body mode automatically', s.screen === 'viewer' && s.mode === 'body' && s.person.isPerson, JSON.stringify(s));
    check('anatomy built (83 meshes) with three r' + s.three, s.meshes === 83, String(s.meshes));
    check('HUD labels are shown', s.labelsShown >= 12, String(s.labelsShown));
    await shot('2-body');
    await page.click('.label[data-label="heart"]');
    s = await snap();
    check('tapping a label selects the part and opens its info card', s.selected === 'heart' && (await page.isVisible('#info')) && (await page.textContent('#info b')) === 'Tim');
    await shot('3-body-heart');
    console.log('language switch');
    await page.click('#viewer [data-lang-toggle]');
    s = await snap();
    check('one tap switches every control to English', s.lang === 'en' && (await page.textContent('#back')) === '← Retake' && (await page.textContent('#mode-body')) === 'Body' && (await page.textContent('[data-system="skeleton"]')) === 'Bones' && (await page.textContent('#save')) === 'Save');
    check('anatomy labels and the open info card switch too', (await page.textContent('.label[data-label="heart"]')) === 'Heart' && (await page.textContent('#info b')) === 'Heart' && (await page.textContent('#info i')) === 'Tim' && /four-chambered/.test(await page.textContent('#info p')));
    await page.click('[data-tab="axes"]');
    check('axis names switch', /J1 · Turn/.test(await page.textContent('label[for="axis-J1"]')));
    await page.waitForTimeout(150);
    await shot('3b-body-english');
    await page.click('[data-tab="view"]');
    await page.reload();
    await page.waitForFunction(() => !!window.__v6d);
    check('the choice survives a restart', (await snap()).lang === 'en' && (await page.textContent('#pick')) === 'Gallery');
    await page.click('#home [data-lang-toggle]');
    check('and switches back to Vietnamese from the home screen', (await snap()).lang === 'vi' && (await page.textContent('#demo-person')) === 'Ảnh mẫu cơ thể');
    await page.click('#demo-person');
    await page.waitForFunction(() => window.__v6d.snapshot().rendering);
    await page.waitForTimeout(300);
    await slide('explode', 1);
    await page.click('[data-system="organs"]');
    s = await snap();
    check('explode slider and system toggles apply', s.explode === 1 && s.labelsShown < 16 && s.labelsShown > 0, JSON.stringify(s));
    await page.click('[data-tab="axes"]');
    await slide('axis-J1', 55);
    s = await snap();
    check('J1 slider turns the model', s.pose.yaw === 55);
    await page.waitForTimeout(200);
    await shot('4-body-exploded');

    console.log('6D mode');
    await page.click('#back');
    await page.click('#demo-scene');
    await page.waitForFunction(() => window.__v6d.snapshot().mode === 'relief');
    s = await snap();
    check('scene photo opens in 6D relief mode', s.mode === 'relief' && s.reliefVertices > 10000 && s.labelsShown === 0, JSON.stringify(s));
    const box = await page.$eval('#stage', (c) => ({ w: c.clientWidth, h: c.clientHeight }));
    await page.mouse.move(box.w / 2, box.h * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.w / 2 + 70, box.h * 0.4 - 40, { steps: 5 });
    await page.mouse.up();
    s = await snap();
    check('dragging orbits the relief (yaw and pitch change)', s.pose.yaw > 10 && s.pose.pitch < -1, JSON.stringify(s.pose));
    await page.waitForTimeout(200);
    await shot('5-relief');
    await page.click('[data-style="holo"]');
    await slide('explode', 0.8);
    await page.waitForTimeout(200);
    check('hologram style selected', (await snap()).style === 'holo');
    await shot('6-relief-holo');
    const pixels = await page.$eval('#stage', (c) => {
      const t = document.createElement('canvas'); t.width = 64; t.height = 64;
      const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data; let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
      return lit;
    });
    check('WebGL canvas actually drew something', pixels > 100, String(pixels));

    console.log('camera capture');
    await page.click('#back');
    await page.waitForFunction(() => !document.getElementById('shutter').disabled, null, { timeout: 15000 });
    await page.click('#shutter');
    await page.waitForFunction(() => window.__v6d.snapshot().screen === 'viewer');
    check('shutter captures a frame and opens the viewer', (await snap()).reliefVertices > 1000);
    check('Back handler returns to the camera, then reports nothing left to close', (await page.evaluate(() => window.__v6dBack())) === true && (await page.evaluate(() => window.__v6dBack())) === false);
    check('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    fail++;
    console.log('  FAIL crashed → ' + (e && e.stack || e) + (errors.length ? ' | page errors: ' + errors.join(' | ') : ''));
  }
  await browser.close();
  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
