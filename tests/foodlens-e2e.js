#!/usr/bin/env node
'use strict';
// FoodLens browser test: loads foodlens/web/index.html from file:// (the way the Android
// WebView does) in Chromium and drives the real UI with the Claude API mocked at the network
// layer. Needs Playwright with a Chromium build; skipped (exit 0) when that is not installed.
// Usage: node tests/foodlens-e2e.js [screenshot-dir]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { console.log('playwright not installed, skipping'); process.exit(0); }

const PAGE = 'file://' + path.resolve(__dirname, '../foodlens/web/index.html');
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null;
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

// A solid-colour PNG built by hand, so the test needs no image fixture.
function png(w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from(rgb)))]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}

const APPLE = {
  is_food: true, dish_name: 'Táo đỏ', cuisine: 'Trái cây tươi', portion_note: '1 trái cỡ vừa, khoảng 180 g, ăn cả vỏ',
  items: [{ name_vi: 'Táo đỏ <img src=x onerror="window.__xss=1">', name_en: 'Red apple', grams: 180, calories: 94, carbs_g: 25, fiber_g: 4.3, sugar_g: 19, added_sugar_g: 0, protein_g: 0.5, fat_g: 0.3, sat_fat_g: 0.1, sodium_mg: 2, gi: 36, nova: 1, confidence: 0.93 }],
  advice_vi: 'Táo có chỉ số đường huyết thấp và nhiều chất xơ hòa tan nên đường huyết lên chậm. Ăn cả vỏ, một trái mỗi lần.',
  swaps_vi: [],
};
const BROKEN_RICE = {
  is_food: true, dish_name: 'Cơm tấm sườn bì chả', cuisine: 'Việt Nam', portion_note: '1 dĩa đầy, cơm khoảng 250 g',
  items: [
    { name_vi: 'Cơm tấm', name_en: 'Broken rice', grams: 250, calories: 325, carbs_g: 71, fiber_g: 1, sugar_g: 0.3, added_sugar_g: 0, protein_g: 6.5, fat_g: 0.8, sat_fat_g: 0.2, sodium_mg: 5, gi: 73, nova: 1, confidence: 0.9 },
    { name_vi: 'Sườn nướng', name_en: 'Grilled pork chop', grams: 110, calories: 290, carbs_g: 6, fiber_g: 0, sugar_g: 5, added_sugar_g: 5, protein_g: 26, fat_g: 18, sat_fat_g: 6.5, sodium_mg: 620, gi: 60, nova: 3, confidence: 0.85 },
    { name_vi: 'Chả trứng', name_en: 'Steamed egg meatloaf', grams: 50, calories: 95, carbs_g: 3, fiber_g: 0.2, sugar_g: 0.5, added_sugar_g: 0, protein_g: 6, fat_g: 6.5, sat_fat_g: 2, sodium_mg: 260, gi: 40, nova: 3, confidence: 0.7 },
    { name_vi: 'Nước mắm pha', name_en: 'Sweet fish sauce', grams: 30, calories: 28, carbs_g: 6.5, fiber_g: 0, sugar_g: 6, added_sugar_g: 6, protein_g: 0.8, fat_g: 0, sat_fat_g: 0, sodium_mg: 900, gi: 65, nova: 3, confidence: 0.6 },
  ],
  advice_vi: 'Phần cơm lớn làm đường huyết tăng nhanh. Ăn nửa phần cơm, ăn rau và sườn trước.',
  swaps_vi: ['Nửa phần cơm tấm, thêm dưa leo và cà chua', 'Chan ít nước mắm pha'],
};
const reply = (obj) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(obj) }], stop_reason: 'end_turn' }) });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: SHOTS ? 2 : 1, locale: 'vi-VN' });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 40[01]/.test(m.text())) consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  const calls = [];
  let next = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
    calls.push({ headers: r.headers(), body: JSON.parse(r.postData()) });
    return route.fulfill(next.shift() || { status: 500, body: '{}' });
  });
  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
  const upload = (rgb) => page.setInputFiles('#gal', { name: 'food.png', mimeType: 'image/png', buffer: png(64, 48, rgb) });

  console.log('first run (no key)');
  await page.goto(PAGE);
  check('page loads from file:// with scripts and styles under the CSP', await page.evaluate(() => !!window.FoodLensCore && getComputedStyle(document.querySelector('.tabs')).position === 'fixed'));
  check('missing-key notice shown, analyse button disabled', await page.isVisible('#need-key') && await page.isDisabled('#analyze'));
  await upload([200, 40, 40]);
  await page.waitForSelector('#preview img');
  check('picked photo is previewed and enables the button', await page.isEnabled('#analyze'));
  await page.click('#analyze');
  check('analysing without a key explains what to do, no network call', /API key/.test(await page.textContent('#scan-error')) && calls.length === 0);
  await shot('1-first-run');

  console.log('offline lookup');
  await page.click('[data-tab="lookup"]');
  await page.fill('#q', 'tao');
  check('accent-insensitive search finds Táo', (await page.textContent('#food-list')).includes('Táo'));
  await page.click('#food-list .food');
  await page.waitForSelector('#lookup-detail .res-head');
  check('lookup result works with no key and no network', await page.getAttribute('#lookup-detail .res-head', 'data-level') === 'green' && calls.length === 0);
  const kcal180 = await page.textContent('#lookup-detail .t-kcal b');
  await page.fill('#grams', '360');
  check('changing grams recalculates', kcal180 === '93,6' && await page.textContent('#lookup-detail .t-kcal b') === '187', kcal180);
  await shot('2-lookup-apple');

  console.log('settings');
  await page.click('[data-tab="settings"]');
  await page.fill('#set-key', '  sk-ant-test-123  ');
  await page.selectOption('#set-model', 'claude-sonnet-5-5');
  await page.fill('#set-carb', '45');
  await page.click('#set-save');
  check('settings saved and trimmed', await page.isVisible('#set-msg') && await page.evaluate(() => JSON.parse(localStorage.getItem('fl.settings')).apiKey) === 'sk-ant-test-123');
  await shot('3-settings');

  console.log('photo analysis');
  await page.click('[data-tab="scan"]');
  check('key notice gone after saving a key', !(await page.isVisible('#need-key')));
  await upload([200, 40, 40]);
  await page.waitForSelector('#preview img');
  await page.fill('#note', '1 trái táo');
  next = [reply(APPLE)];
  await page.click('#analyze');
  await page.waitForSelector('#scan-result .res-head');
  const sent = calls[0];
  check('request carries key, chosen model, JPEG image and the note', sent && sent.headers['x-api-key'] === 'sk-ant-test-123' && sent.body.model === 'claude-sonnet-5-5' &&
    sent.body.messages[0].content[0].source.media_type === 'image/jpeg' && sent.body.messages[0].content[0].source.data.length > 100 && /1 trái táo/.test(sent.body.messages[0].content[1].text));
  check('apple: green verdict, 94 kcal, 20,7 g net carbs', await page.getAttribute('#scan-result .res-head', 'data-level') === 'green' &&
    await page.textContent('#scan-result .t-kcal b') === '94' && await page.textContent('#scan-result .t-carb b') === '20,7 g');
  check('model text is escaped, not executed', await page.evaluate(() => !window.__xss && !document.querySelector('#scan-result img')) && (await page.textContent('#scan-result .items')).includes('<img src=x'));
  check('GL pin positioned on the meter', await page.evaluate(() => parseFloat(document.querySelector('#scan-result .pin').style.left) > 15));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('4-result-apple');

  await upload([230, 200, 150]);
  await page.waitForSelector('#preview img');
  next = [{ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":{"message":"output_config: unknown field"}}' }, reply(BROKEN_RICE)];
  await page.click('#analyze');
  await page.waitForSelector('#scan-result .res-head');
  check('a 400 is retried once with the bare request', calls.length === 3 && !!calls[1].body.output_config && !calls[2].body.output_config);
  check('cơm tấm: red verdict with tips and swaps', await page.getAttribute('#scan-result .res-head', 'data-level') === 'red' &&
    (await page.textContent('#scan-result .tips')).includes('tinh bột') && (await page.locator('#scan-result .swap').count()) === 2);
  check('four components listed', (await page.locator('#scan-result .items tr').count()) === 4);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('5-result-com-tam');

  console.log('errors');
  next = [{ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":{"message":"invalid x-api-key"}}' }];
  await page.click('#analyze');
  await page.waitForSelector('#scan-error:not([hidden])');
  check('401 shows the key message and clears the old result', /API key không hợp lệ/.test(await page.textContent('#scan-error')) && (await page.innerHTML('#scan-result')) === '');
  next = [reply({ is_food: false, dish_name: '', cuisine: '', portion_note: '', items: [], advice_vi: 'Ảnh chụp một bàn phím.', swaps_vi: [] })];
  await page.click('#analyze');
  await page.waitForFunction(() => /Không thấy món ăn/.test(document.getElementById('scan-error').textContent));
  check('non-food photo is reported, nothing saved', (await page.textContent('#scan-error')).includes('bàn phím') && await page.evaluate(() => JSON.parse(localStorage.getItem('fl.diary')).length) === 2);
  next = [{ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: 'xin lỗi' }], stop_reason: 'end_turn' }) }];
  await page.click('#analyze');
  await page.waitForFunction(() => /Không đọc được kết quả/.test(document.getElementById('scan-error').textContent));
  check('malformed model output is reported and the button comes back', await page.isEnabled('#analyze') && !(await page.isVisible('#loading')));

  console.log('diary');
  await page.click('[data-tab="diary"]');
  check('today shows both meals summed', (await page.textContent('#diary-today')).includes('2 món') && (await page.textContent('#diary-today .sum b')) === '832');
  check('entries newest first with thumbnails', (await page.locator('#diary-list .entry').count()) === 2 && (await page.textContent('#diary-list .entry b')) === 'Cơm tấm sườn bì chả' && (await page.locator('#diary-list img').count()) === 2);
  await shot('6-diary');
  await page.click('#diary-list .entry >> nth=1');
  await page.waitForSelector('#diary-result .res-head');
  check('a saved entry reopens', await page.getAttribute('#diary-result .res-head', 'data-level') === 'green');
  check('back button leaves the detail, then the tab, then lets the app close', await page.evaluate(() => window.__flBack()) === true && (await page.locator('#diary-list .entry').count()) === 2 &&
    await page.evaluate(() => window.__flBack()) === true && await page.isVisible('#view-scan') && await page.evaluate(() => window.__flBack()) === false);
  await page.reload();
  await page.click('[data-tab="diary"]');
  check('diary and settings survive a restart', (await page.locator('#diary-list .entry').count()) === 2);
  page.once('dialog', (d) => d.accept());
  await page.click('#diary-clear');
  check('clearing the diary empties it', (await page.locator('#diary-list .entry').count()) === 0);

  console.log('native bridge path');
  await page.evaluate(() => { window.FoodLensNative = { post: (id, url, headers, body) => { window.__bridge = { url, headers: JSON.parse(headers), body: JSON.parse(body) }; setTimeout(() => window.__flNative(id, 200, window.__bridgeReply), 10); } }; });
  await page.evaluate((r) => { window.__bridgeReply = r; }, reply(APPLE).body);
  await page.click('[data-tab="scan"]');
  await upload([200, 40, 40]);
  await page.waitForSelector('#preview img');
  const before = calls.length;
  await page.click('#analyze');
  await page.waitForSelector('#scan-result .res-head');
  check('inside the Android app the call goes through the bridge, not fetch', calls.length === before && await page.evaluate(() => window.__bridge.url === 'https://api.anthropic.com/v1/messages' && window.__bridge.headers['x-api-key'] === 'sk-ant-test-123'));

  check('no console errors or CSP violations', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
