'use strict';
// Vision 6D desktop end-to-end test: starts the real local server on a temp output folder, drives
// the page in headless Chromium, extracts real image files and then inspects what landed on disk.
// Optional: needs Playwright, which this project does not depend on; skips (exit 0) without it.
//   node tests/desktop-e2e.js          # V6D_SHOTS=<dir> also writes screenshots there
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
const { createApp } = require(path.join(ROOT, 'tools', 'server.js'));
const icon = require(path.join(ROOT, 'android', 'icon.js'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

(async () => {
  const G = await import(pathToFileURL(path.join(ROOT, 'desktop', 'lib', 'glb.js')).href);
  const X = await import(pathToFileURL(path.join(ROOT, 'desktop', 'lib', 'extract.js')).href);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v6d-desktop-'));
  const outDir = path.join(tmp, 'out');
  const inDir = path.join(tmp, 'in');
  fs.mkdirSync(inDir);
  const opened = [];
  const app = await createApp({ outDir, opener: (d) => opened.push(d) });
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1, locale: 'vi-VN' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const snap = () => page.evaluate(() => window.__v6dDesktop.snapshot());
  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
  const waitIdle = () => page.waitForFunction(() => { const s = window.__v6dDesktop.snapshot(); return !s.busy && !s.items.some((i) => i.status === 'working'); }, null, { timeout: 120000 });

  try {
    console.log('start');
    await page.goto(app.url);
    await page.waitForFunction(() => !!window.__v6dDesktop && window.__v6dDesktop.snapshot().outDir);
    let s = await snap();
    check('page loads and shows the output folder from the server', s.outDir === outDir && (await page.textContent('#outdir')) === outDir);
    check('starts in Vietnamese, buttons disabled while the list is empty', s.lang === 'vi' && (await page.textContent('#run-all')) === 'Bóc tách tất cả' && (await page.isDisabled('#run-all')) && (await page.isDisabled('#run-one')));

    console.log('real files');
    // Three inputs: a PNG with a Vietnamese name, a JPEG made by the browser, and a file that is not an image.
    // (The Vietnamese-named file is handed over as bytes: headless Chromium under a C locale cannot
    // open non-ASCII paths, which is a quirk of the test machine, not of the app.)
    const png = { name: 'ảnh gia đình (1).png', mimeType: 'image/png', buffer: icon.png(192) };
    const jpgData = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 360;
      const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 640, 360); grad.addColorStop(0, '#203a70'); grad.addColorStop(1, '#f0a050');
      g.fillStyle = grad; g.fillRect(0, 0, 640, 360);
      for (let i = 0; i < 300; i++) { g.fillStyle = `hsl(${i * 7 % 360},70%,${30 + (i % 40)}%)`; g.fillRect(200 + (i * 37) % 240, 120 + (i * 53) % 140, 9, 9); }
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    });
    const jpg = path.join(inDir, 'wide photo.jpg');
    fs.writeFileSync(jpg, Buffer.from(jpgData, 'base64'));
    const broken = path.join(inDir, 'broken.png');
    fs.writeFileSync(broken, Buffer.from('this is not really a png'));
    const notes = path.join(inDir, 'notes.txt');
    fs.writeFileSync(notes, 'hello');
    const asPayload = (f, mimeType) => ({ name: path.basename(f), mimeType, buffer: fs.readFileSync(f) });
    await page.setInputFiles('#files', [png, asPayload(jpg, 'image/jpeg'), asPayload(broken, 'image/png'), asPayload(notes, 'text/plain')]);
    await page.waitForFunction(() => window.__v6dDesktop.snapshot().preview);
    s = await snap();
    check('images are queued, the text file is skipped', s.items.length === 3 && s.items.map((i) => i.name).join('|') === 'ảnh gia đình (1).png|wide photo.jpg|broken.png', JSON.stringify(s.items.map((i) => i.name)));
    check('first image is selected and previewed with its maps', s.selected !== null && s.preview && s.rendering && s.maps >= 3, JSON.stringify(s));
    await page.waitForTimeout(300);
    await shot('d1-3d');

    console.log('views');
    for (const v of ['4d', '6d', 'points']) {
      await page.click(`[data-view="${v}"]`);
      await page.waitForTimeout(350);
      check(`${v} view is selected and shows its readout`, (await snap()).view === v && new RegExp(v === 'points' ? 'x y z r g b' : v.toUpperCase()).test(await page.textContent('#readout')));
      await shot('d2-' + v);
    }
    await page.click('[data-view="3d"]');

    console.log('extract all');
    await page.$eval('#layers', (el) => { el.value = 4; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#run-all');
    await waitIdle();
    s = await snap();
    check('good images finish, the broken one reports an error and does not stop the batch', s.items[0].status === 'done' && s.items[1].status === 'done' && s.items[2].status === 'error' && !!s.items[2].error, JSON.stringify(s.items));
    check('folders keep the Vietnamese name and stay filesystem-safe', s.items[0].dir === 'ảnh gia đình 1' && s.items[1].dir === 'wide photo', JSON.stringify(s.items.map((i) => i.dir)));
    check('nothing was created for the broken image', fs.readdirSync(outDir).sort().join('|') === ['wide photo', 'ảnh gia đình 1'].sort().join('|'), fs.readdirSync(outDir).join('|'));

    const dir = path.join(outDir, 'wide photo');
    const names = fs.readdirSync(dir).sort();
    check('every promised file is on disk', ['depth.png', 'layers', 'model-3d.glb', 'model-4d.glb', 'model-6d.glb', 'normal.png', 'photo.jpg', 'points-6d.ply', 'scene.json'].every((n) => names.includes(n)), names.join());
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'scene.json'), 'utf8'));
    check('scene.json describes the source and settings', manifest.app === 'Vision 6D' && manifest.source.name === 'wide photo.jpg' && manifest.source.width === 640 && manifest.source.height === 360 && manifest.settings.layers === 4 && manifest.settings.grid.join() === '256,144', JSON.stringify(manifest.settings));
    const listed = manifest.files.filter((f) => f.path !== 'scene.json');
    check('scene.json lists exactly the files written, with their sizes', listed.length === s.items[1].count - 1 && listed.every((f) => fs.existsSync(path.join(dir, f.path)) && fs.statSync(path.join(dir, f.path)).size === f.bytes), JSON.stringify(listed.map((f) => f.path)));
    const jpgOut = fs.readFileSync(path.join(dir, 'photo.jpg'));
    check('photo.jpg is a JPEG', jpgOut[0] === 0xff && jpgOut[1] === 0xd8);
    for (const f of ['depth.png', 'normal.png']) {
      const b = fs.readFileSync(path.join(dir, f));
      check(`${f} is a PNG at the photo's size`, b.subarray(0, 8).equals(PNG_SIG) && pngSize(b).join() === '640,360', pngSize(b).join());
    }
    const layers = fs.readdirSync(path.join(dir, 'layers')).sort();
    check('layers are transparent PNGs at the photo size, at most one per layer', layers.length >= 2 && layers.length <= 4 && layers.every((l) => /^layer-[1-4]\.png$/.test(l) && pngSize(fs.readFileSync(path.join(dir, 'layers', l))).join() === '640,360' && fs.readFileSync(path.join(dir, 'layers', l))[25] === 6), layers.join());
    const stats = {};
    for (const kind of ['3d', '4d', '6d']) {
      const bytes = fs.readFileSync(path.join(dir, `model-${kind}.glb`));
      const c = G.checkGlb(bytes);
      stats[kind] = c.stats;
      check(`model-${kind}.glb passes the structural check`, c.ok, c.errors.join('; '));
      const glb = G.parseGlb(bytes);
      const img = glb.json.images[0], view = glb.json.bufferViews[img.bufferView];
      check(`model-${kind}.glb embeds photo.jpg as its texture`, img.mimeType === 'image/jpeg' && Buffer.from(glb.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength)).equals(jpgOut));
    }
    check('3D: one mesh of 256x144 samples', stats['3d'].meshes === 1 && stats['3d'].vertices === 256 * 144 && stats['3d'].triangles === 255 * 143 * 2 && stats['3d'].animations === 0, JSON.stringify(stats['3d']));
    const g4 = G.parseGlb(fs.readFileSync(path.join(dir, 'model-4d.glb'))).json;
    check('4D: two morph targets animated over an 8 s loop', stats['4d'].animations === 1 && g4.meshes[0].primitives[0].targets.length === 2 && g4.meshes[0].extras.targetNames.join() === 'flatten,teardown' && g4.animations[0].channels[0].target.path === 'weights' && g4.accessors[g4.animations[0].samplers[0].input].max[0] === 8);
    const g6 = G.parseGlb(fs.readFileSync(path.join(dir, 'model-6d.glb'))).json;
    const paths6 = g6.animations[0].channels.map((c) => c.target.path);
    check('6D: one node per layer, all triangles kept, rotation + translation tracks', stats['6d'].meshes === layers.length && stats['6d'].nodes === layers.length + 1 && stats['6d'].triangles === stats['3d'].triangles && paths6.includes('rotation') && paths6.filter((p) => p === 'translation').length === layers.length + 1, JSON.stringify(stats['6d']));
    const ply = X.parsePly(fs.readFileSync(path.join(dir, 'points-6d.ply')));
    check('PLY holds one six-value point per sample', ply.count === 256 * 144 && ply.properties.join() === 'x,y,z,red,green,blue');
    check('no anatomy file for a picture without a person', !names.includes('anatomy.glb') && manifest.person.detected === false);
    check('square PNG input also produced a full set', ['model-3d.glb', 'model-4d.glb', 'model-6d.glb', 'points-6d.ply', 'scene.json'].every((n) => fs.existsSync(path.join(outDir, 'ảnh gia đình 1', n))));

    console.log('person, language, folders');
    await page.click('#clear');
    await page.click('#sample');
    await page.waitForFunction(() => window.__v6dDesktop.snapshot().items.length === 2);
    await page.click('#queue li:nth-child(2)');
    await page.waitForFunction(() => /\d+%/.test(document.getElementById('person').textContent));
    check('sample person is recognised', /Có người trong ảnh/.test(await page.textContent('#person')));
    await page.waitForTimeout(300);
    await shot('d3-person');
    await page.click('#lang');
    check('language button switches the whole window to English', (await snap()).lang === 'en' && (await page.textContent('#run-all')) === 'Extract all' && /Person found/.test(await page.textContent('#person')) && (await page.textContent('#queue li:nth-child(2) .st')) === 'Queued');
    await shot('d4-english');
    await page.click('#run-one');
    await waitIdle();
    s = await snap();
    check('"Extract this image" does only the selected one', s.items[0].status === 'queued' && s.items[1].status === 'done', JSON.stringify(s.items));
    const pdir = path.join(outDir, s.items[1].dir);
    const anatomy = G.checkGlb(fs.readFileSync(path.join(pdir, 'anatomy.glb')));
    const aj = G.parseGlb(fs.readFileSync(path.join(pdir, 'anatomy.glb'))).json;
    check('a person photo also gets anatomy.glb: 83 parts under skeleton / organs / vessels', anatomy.ok && anatomy.stats.meshes === 83 && aj.nodes[0].children.map((c) => aj.nodes[c].name).join() === 'skeleton,organs,vessels', anatomy.errors.join('; ') + JSON.stringify(anatomy.stats));
    await page.click('#run-one');
    await waitIdle();
    s = await snap();
    check('extracting the same image again goes to a new folder instead of overwriting', /-2$/.test(s.items[1].dir) && fs.existsSync(pdir), s.items[1].dir);
    await page.click('#open');
    await page.waitForTimeout(200);
    check('"Open folder" asks the server to open that image\'s folder', opened.length === 1 && opened[0] === path.join(outDir, s.items[1].dir), JSON.stringify(opened));
    check('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    fail++;
    console.log('  FAIL crashed → ' + (e && e.stack || e) + (errors.length ? ' | page errors: ' + errors.join(' | ') : ''));
  }
  await browser.close();
  await app.close();
  if (process.env.V6D_KEEP) console.log('kept ' + tmp); else fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
