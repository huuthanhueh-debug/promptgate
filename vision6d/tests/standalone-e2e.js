'use strict';
// Vision 6D standalone test: opens the single-file Vision6D.html straight from disk (file://, no
// server, no Node, no script), extracts real images and inspects what it saves, once through the
// folder picker (File System Access API, replaced here by an in-memory folder) and once through the
// .zip download used where that API is missing. Optional: needs Playwright; skips without it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) {
  console.log('skipped: playwright is not installed');
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.V6D_SHOTS || '';
const HTML = path.join(ROOT, 'Vision6D.html');
const { readZip } = require(path.join(ROOT, 'android', 'zip.js'));
const icon = require(path.join(ROOT, 'android', 'icon.js'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}

// An in-memory stand-in for a user-chosen folder, with the same handle API as the real thing.
const FAKE_FS = `
  (() => {
    const mk = (name) => ({ kind: 'directory', name, dirs: new Map(), files: new Map(),
      async getDirectoryHandle(n, o) { if (!this.dirs.has(n)) { if (!(o && o.create)) throw Object.assign(new Error('nf'), { name: 'NotFoundError' }); this.dirs.set(n, mk(n)); } return this.dirs.get(n); },
      async getFileHandle(n, o) { if (!this.files.has(n)) { if (!(o && o.create)) throw Object.assign(new Error('nf'), { name: 'NotFoundError' }); this.files.set(n, { name: n, data: null }); }
        const f = this.files.get(n); return { name: n, async createWritable() { return { async write(b) { f.data = new Uint8Array(await b.arrayBuffer()); }, async close() {} }; } }; } });
    const root = mk('Anh-6D');
    window.__fakeRoot = root;
    window.__pickerCalls = 0;
    window.showDirectoryPicker = async (o) => { window.__pickerCalls++; window.__pickerOpts = o; return root; };
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };
    window.__dump = () => { const out = {}; const walk = (d, p) => { for (const [n, f] of d.files) out[p + n] = b64(f.data); for (const [n, s] of d.dirs) walk(s, p + n + '/'); }; walk(root, ''); return out; };
    window.__names = () => { const out = []; const walk = (d, p) => { for (const [n] of d.files) out.push(p + n); for (const [n, s] of d.dirs) walk(s, p + n + '/'); }; walk(root, ''); return out; };
  })();`;

(async () => {
  const G = await import(pathToFileURL(path.join(ROOT, 'desktop', 'lib', 'glb.js')).href);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v6d-standalone-'));
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const inputs = [
    { name: 'ảnh gia đình (1).png', mimeType: 'image/png', buffer: icon.png(192) },
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') },
  ];

  async function open(initScript) {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, locale: 'vi-VN', acceptDownloads: true });
    const page = await ctx.newPage();
    if (initScript) await page.addInitScript(initScript);
    const errors = [], requests = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(pathToFileURL(HTML).href);
    await page.waitForFunction(() => !!window.__v6dDesktop);
    return { page, errors, requests, ctx };
  }
  const waitIdle = (page) => page.waitForFunction(() => { const s = window.__v6dDesktop.snapshot(); return !s.busy && !s.items.some((i) => i.status === 'working'); }, null, { timeout: 120000 });

  try {
    console.log('folder picker');
    {
      const { page, errors, requests } = await open(FAKE_FS);
      let s = await page.evaluate(() => window.__v6dDesktop.snapshot());
      check('opens straight from a file, in Vietnamese, with the folder picker as its target', s.sink === 'folder' && s.lang === 'vi' && /Bạn sẽ chọn thư mục/.test(await page.textContent('#outdir')), JSON.stringify(s));
      check('"Open folder" is hidden (a page cannot open the file manager)', await page.isHidden('#open'));
      await page.setInputFiles('#files', inputs);
      await page.waitForFunction(() => window.__v6dDesktop.snapshot().preview);
      check('preview and maps work without any server', (await page.evaluate(() => window.__v6dDesktop.snapshot())).maps >= 3);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, 's1-standalone.png') }); }
      check('nothing is asked of the user until Extract is pressed', (await page.evaluate(() => window.__pickerCalls)) === 0);
      await page.click('#run-all');
      await waitIdle(page);
      s = await page.evaluate(() => window.__v6dDesktop.snapshot());
      check('the picker opened once, read-write; good image done, broken one reported', (await page.evaluate(() => window.__pickerCalls)) === 1 && (await page.evaluate(() => window.__pickerOpts.mode)) === 'readwrite' && s.items[0].status === 'done' && s.items[1].status === 'error', JSON.stringify(s.items));
      check('the chosen folder is shown', /Anh-6D/.test(await page.textContent('#outdir')));
      const dump = await page.evaluate(() => window.__dump());
      const bytesOf = (n) => new Uint8Array(Buffer.from(dump[n], 'base64'));
      const names = Object.keys(dump);
      check('every file landed in a sub-folder named after the image', ['model-3d.glb', 'model-4d.glb', 'model-6d.glb', 'points-6d.ply', 'depth.png', 'normal.png', 'photo.jpg', 'scene.json'].every((f) => names.includes('ảnh gia đình 1/' + f)) && names.some((n) => /^ảnh gia đình 1\/layers\/layer-\d\.png$/.test(n)), names.join());
      check('nothing was written for the broken image', !names.some((n) => n.startsWith('broken')));
      for (const k of ['3d', '4d', '6d']) {
        const c = G.checkGlb(bytesOf(`ảnh gia đình 1/model-${k}.glb`));
        check(`model-${k}.glb saved through the picker is a valid GLB`, c.ok && c.stats.triangles > 1000, c.errors.join('; '));
      }
      await page.click('#run-one');
      await waitIdle(page);
      check('a second extraction does not overwrite: new folder with -2', (await page.evaluate(() => window.__names())).some((n) => n.startsWith('ảnh gia đình 1-2/model-3d.glb')) && (await page.evaluate(() => window.__pickerCalls)) === 1);
      await page.click('#lang');
      check('language button works in the standalone page', (await page.textContent('#run-all')) === 'Extract all' && /Chosen folder: Anh-6D/.test(await page.textContent('#outdir')));
      check('no network: every request is file:, blob: or data:', requests.every((u) => /^(file|blob|data):/.test(u)), requests.filter((u) => !/^(file|blob|data):/.test(u)).join());
      check('no page errors (the CSP blocked nothing)', errors.length === 0, errors.join(' | '));
    }

    console.log('zip fallback');
    {
      const { page, errors } = await open('delete window.showDirectoryPicker;');
      let s = await page.evaluate(() => window.__v6dDesktop.snapshot());
      check('without a folder picker the target is one .zip', s.sink === 'zip' && /Vision6D\.zip/.test(await page.textContent('#outdir')));
      await page.setInputFiles('#files', inputs);
      await page.waitForFunction(() => window.__v6dDesktop.snapshot().preview);
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#run-all')]);
      check('one download named Vision6D.zip', download.suggestedFilename() === 'Vision6D.zip');
      const zipPath = path.join(tmp, 'out.zip');
      await download.saveAs(zipPath);
      await waitIdle(page);
      const entries = readZip(fs.readFileSync(zipPath)); // also verifies every CRC
      const names = entries.map((e) => e.name);
      check('the zip holds the image folder with every file, Vietnamese name intact', ['model-3d.glb', 'model-4d.glb', 'model-6d.glb', 'points-6d.ply', 'depth.png', 'normal.png', 'photo.jpg', 'scene.json'].every((f) => names.includes('ảnh gia đình 1/' + f)) && !names.some((n) => n.startsWith('broken')), names.join());
      for (const k of ['3d', '4d', '6d']) {
        const c = G.checkGlb(entries.find((e) => e.name === `ảnh gia đình 1/model-${k}.glb`).data);
        check(`model-${k}.glb from the zip is a valid GLB`, c.ok, c.errors.join('; '));
      }
      const manifest = JSON.parse(entries.find((e) => e.name.endsWith('scene.json')).data.toString('utf8'));
      check('scene.json inside the zip lists files that are all in the zip', manifest.files.every((f) => f.path === 'scene.json' || names.includes('ảnh gia đình 1/' + f.path)));
      s = await page.evaluate(() => window.__v6dDesktop.snapshot());
      check('batch state is right after the download', s.items[0].status === 'done' && s.items[1].status === 'error' && !s.busy);
      check('no page errors', errors.length === 0, errors.join(' | '));
    }

    console.log('folder picker cancelled');
    {
      const { page } = await open(FAKE_FS + '\nwindow.showDirectoryPicker = async () => { throw Object.assign(new Error("cancelled"), { name: "AbortError" }); };');
      await page.setInputFiles('#files', [inputs[0]]);
      await page.waitForFunction(() => window.__v6dDesktop.snapshot().preview);
      await page.click('#run-all');
      await page.waitForFunction(() => /Đã hủy/.test(document.getElementById('toast').textContent));
      const s = await page.evaluate(() => window.__v6dDesktop.snapshot());
      check('cancelling the picker stops cleanly: nothing extracted, buttons usable again', !s.busy && s.items[0].status === 'queued' && !(await page.isDisabled('#run-all')));
    }
  } catch (e) {
    fail++;
    console.log('  FAIL crashed → ' + (e && e.stack || e));
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
