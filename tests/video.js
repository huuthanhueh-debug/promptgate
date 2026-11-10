'use strict';
// PromptGate Video tests: core logic (storyboard, per-tool prompts, timeline, validation), the
// localhost server, APK staging, and (when Playwright is installed) a real render in headless
// Chromium that must produce a playable video file.
// Run directly (node tests/video.js) or through tests/run.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const VID = path.join(ROOT, 'video');
const V = require(path.join(VID, 'src', 'core.js'));
const { createServer } = require(path.join(VID, 'server.js'));
const apk = require(path.join(VID, 'android', 'build.js'));
const I = require(path.join(VID, 'src', 'i18n.js'));

let pass = 0, fail = 0, skip = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
const sum = (a) => a.reduce((x, y) => x + y, 0);
function get(port, p, method) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: method || 'GET' }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('storyboard');
  const brief = 'Bình minh trên biển Vũng Tàu, sóng nhẹ. Lễ tân mỉm cười chào khách!\n- Căn suite hướng biển\n2) Bữa sáng bên hồ bơi\nCảnh 5: Logo khách sạn';
  const parts = V.splitBrief(brief);
  check('splits on sentences and lines, strips bullets and "Cảnh n:"', parts.length === 5 && parts[2] === 'Căn suite hướng biển' && parts[3] === 'Bữa sáng bên hồ bơi' && parts[4] === 'Logo khách sạn', JSON.stringify(parts));
  const p = V.buildStoryboard({ brief, totalSeconds: 30, aspect: '16:9', style: 'hospitality' });
  check('one scene per part, total matches request', p.scenes.length === 5 && V.totalDuration(p) === 30, String(V.totalDuration(p)));
  check('durations are half-second steps, at least 2 s', p.scenes.every((s) => s.duration >= 2 && s.duration * 2 === Math.round(s.duration * 2)));
  check('longer text gets more time', p.scenes[0].duration > p.scenes[4].duration);
  check('shots and camera moves vary', new Set(p.scenes.map((s) => s.shot)).size >= 3 && new Set(p.scenes.map((s) => s.motion)).size >= 3);
  check('scene ids are unique', new Set(p.scenes.map((s) => s.id)).size === 5);
  check('empty brief gives no scenes', V.buildStoryboard({ brief: '  \n ' }).scenes.length === 0);
  const many = V.buildStoryboard({ brief: Array.from({ length: 40 }, (_, i) => `Shot number ${i}.`).join(' '), maxScenes: 6, totalSeconds: 5 });
  check('too many sentences are merged, total raised to fit the minimum', many.scenes.length === 6 && V.totalDuration(many) === 12, many.scenes.length + '/' + V.totalDuration(many));
  check('distribute never loops on impossible totals', sum(V.distribute(['a', 'b'], 100000, 2)) === 120);
  check('long caption is cut at a word with an ellipsis', V.caption('word '.repeat(60)).length <= 90 && V.caption('word '.repeat(60)).endsWith('…'));

  console.log('validation');
  const bad = V.normalizeProject({ title: 5, aspect: '4:3', style: 'nope', scenes: [null, { text: '  a   b ', duration: 'x', shot: 'zzz' }, { id: '<script>', duration: 9999 }, { id: 'same' }, { id: 'same' }] });
  check('bad fields fall back to safe defaults', bad.aspect === '9:16' && bad.style === 'cinematic' && bad.scenes[1].text === 'a b' && bad.scenes[1].duration === 4 && bad.scenes[1].shot === 'medium');
  check('unsafe id replaced, duration clamped, duplicate ids fixed', /^[\w-]+$/.test(bad.scenes[2].id) && bad.scenes[2].duration === V.LIMITS.sceneMax && bad.scenes[3].id !== bad.scenes[4].id);
  check('garbage input still yields a project', V.normalizeProject('x').scenes.length === 0 && V.normalizeProject(null).title === 'Video mới');
  check('scene count is capped', V.normalizeProject({ scenes: Array.from({ length: 99 }, () => ({})) }).scenes.length === V.LIMITS.scenes);
  check('normalising twice changes nothing', JSON.stringify(V.normalizeProject(p)) === JSON.stringify(p));

  console.log('tool profiles + prompts');
  const want = ['veo', 'runway', 'kling', 'heygen', 'synthesia', 'invideo', 'capcut', 'canva', 'sora', 'pika', 'luma'];
  check('all 11 requested tools are present', V.TOOLS.map((t) => t.id).join() === want.join(), V.TOOLS.map((t) => t.id).join());
  check('every profile has name, category, aspects, tips and an https source', V.TOOLS.every((t) => t.name && ['generative', 'avatar', 'editor'].includes(t.category) && t.aspects.length && /^https:\/\//.test(t.url)));
  check('every profile has inputs and two tips in both languages', V.TOOLS.every((t) => ['vi', 'en'].every((l) => t.inputs[l] && t.tips[l].length === 2)));
  check('generative tools define clip lengths and an element order', V.TOOLS.filter((t) => t.category === 'generative').every((t) => (t.clips || t.range) && t.order.includes('subject')));
  for (const id of want) {
    const pack = V.buildPack(id, p);
    const t = pack.tool;
    const n = t.category === 'editor' ? 1 : 5;
    check(`${id}: ${n} prompt(s), all scene text carried`, pack.items.length === n && p.scenes.every((s) => V.packText(pack).includes(s.text.replace(/[.!]$/, ''))), String(pack.items.length));
  }
  const veo = V.buildPack('veo', p);
  check('veo: camera first, audio line present', /^Wide establishing shot, slow push-in\./.test(veo.items[0].text) && /Audio: /.test(veo.items[0].text));
  check('veo: an 8.5 s+ scene is split across generations and warned', veo.items.some((it) => it.count > 1) === p.scenes.some((s) => s.duration > 8) && (!p.scenes.some((s) => s.duration > 8) || veo.warnings.some((w) => /nhiều clip/.test(w))));
  check('luma/pika: no audio line, warned about missing sound', !/Audio: /.test(V.packText(V.buildPack('luma', p))) && V.buildPack('pika', p).warnings.some((w) => /không tạo âm thanh/.test(w)));
  const tall = { ...p, aspect: '9:16' };
  check('canva: 9:16 unsupported → nearest aspect + warning', V.buildPack('canva', tall).aspect === '16:9' && V.buildPack('canva', tall).warnings.some((w) => /9:16/.test(w)));
  check('nearest aspect for 1:1 on a 16:9 / 9:16 tool is one of them', ['16:9', '9:16'].includes(V.nearestAspect(V.tool('veo'), '1:1')));
  check('sora is flagged as discontinued', V.tool('sora').discontinued === true && V.buildPack('sora', p).warnings.some((w) => /ngừng/.test(w)));
  check('fitClip: list, range, overflow', JSON.stringify([V.fitClip(V.tool('veo'), 5), V.fitClip(V.tool('veo'), 20), V.fitClip(V.tool('kling'), 2), V.fitClip(V.tool('kling'), 45)]) === JSON.stringify([{ seconds: 6, count: 1 }, { seconds: 8, count: 3 }, { seconds: 3, count: 1 }, { seconds: 30, count: 2 }]));
  check('consistency note is added to every generative prompt', V.buildPack('kling', { ...p, consistency: 'same red car' }).items.every((it) => it.text.includes('same red car')));
  check('capcut follows direction → actions → final state → format', /^Scene direction:[\s\S]*Actions in order:[\s\S]*Final state:[\s\S]*Format: 16:9/.test(V.buildPack('capcut', p).items[0].text));
  check('heygen: script per scene', V.buildPack('heygen', p).items.every((it) => /^Scene \d+\nScript: /.test(it.text)));
  check('empty project gives no prompts and does not throw', want.every((id) => V.buildPack(id, {}).items.length === 0));
  const enPack = V.buildPack('canva', tall, 'en');
  check('English packs: labels and warnings in English, prompt text unchanged', /^Scene 1 · /.test(enPack.items[0].label) && enPack.warnings.some((w) => /does not support 9:16/.test(w)) && !/[ạảãàáâăđêôơư]/i.test(enPack.warnings.join('') + enPack.items.map((it) => it.label).join('')) && enPack.items[0].text === V.buildPack('canva', tall).items[0].text);
  check('every style, shot, move and transition has a label in both languages', [V.STYLES, V.SHOTS, V.MOTIONS, V.TRANSITIONS].every((m) => Object.values(m).every((e) => V.label(e, 'vi') && V.label(e, 'en') && V.label(e, 'en') !== V.label(e, 'vi'))));
  let threw = false; try { V.buildPack('nope', p); } catch (_) { threw = true; }
  check('unknown tool id throws', threw);

  console.log('timeline + renderer maths');
  const tp = V.normalizeProject({ scenes: [{ text: 'a', duration: 2 }, { text: 'b', duration: 3, transition: 'cut' }] });
  check('sceneAt picks the right scene at boundaries', V.sceneAt(tp, 0).index === 0 && V.sceneAt(tp, 1.99).index === 0 && V.sceneAt(tp, 2).index === 1 && V.sceneAt(tp, 99).index === 1 && V.sceneAt(tp, -5).index === 0);
  check('fade: transparent at the edges, opaque mid-scene; cut: always opaque', V.sceneAt(tp, 0).alpha === 0 && V.sceneAt(tp, 1).alpha === 1 && V.sceneAt(tp, 2).alpha === 1 && V.sceneAt(tp, 4.99).alpha === 1);
  check('sceneAt on an empty project is null', V.sceneAt(V.normalizeProject({}), 1) === null);
  const covers = Object.keys(V.MOTIONS).every((m) => [0, 0.3, 1].every((q) => { const f = V.motionTransform(m, q); return f.scale >= 1 && Math.abs(f.tx) <= (f.scale - 1) / 2 + 1e-9 && Math.abs(f.ty) <= (f.scale - 1) / 2 + 1e-9; }));
  check('camera moves never expose the frame edge', covers);
  check('dims: even numbers, right orientation', JSON.stringify([V.dims('9:16', 720), V.dims('16:9', 1080), V.dims('1:1', 360)]) === JSON.stringify([{ width: 720, height: 1280 }, { width: 1920, height: 1080 }, { width: 360, height: 360 }]));
  const measure = (s) => s.length * 10;
  check('wrapLines wraps, keeps an over-long word, caps lines', JSON.stringify(V.wrapLines('aa bb cc dd', 50, measure)) === '["aa bb","cc dd"]' && V.wrapLines('abcdefghijkl x', 50, measure)[0] === 'abcdefghijkl' && V.wrapLines('a b c d e f g h', 30, measure, 2).length === 2);
  check('pickMime prefers mp4, falls back to webm, survives throwing probes', V.pickMime(() => true).startsWith('video/mp4') && V.pickMime((m) => /webm/.test(m)).startsWith('video/webm') && V.pickMime(() => { throw new Error('x'); }) === '');
  check('SRT has cue numbers and timestamps', V.toSRT(tp).startsWith('1\n00:00:00,000 --> 00:00:02,000\na\n\n2\n00:00:02,000 --> 00:00:05,000\nb'));
  check('file names are ASCII-safe', V.fileName('Bình minh ở Vũng Tàu / Đêm!', 'mp4') === 'Binh-minh-o-Vung-Tau-Dem.mp4' && V.fileName('', 'webm') === 'video.webm');

  console.log('languages');
  const keys = (l) => Object.keys(I.STRINGS[l]).sort().join();
  check('VI and EN dictionaries have the same keys', I.LANGS.join() === 'vi,en' && keys('vi') === keys('en'));
  check('same keys are functions in both, with the same arity', Object.keys(I.STRINGS.vi).every((k) => typeof I.STRINGS.vi[k] === typeof I.STRINGS.en[k] && (typeof I.STRINGS.vi[k] !== 'function' || I.STRINGS.vi[k].length === I.STRINGS.en[k].length)));
  check('translate: plain, with values, unknown key, unknown language', I.translate('en')('tab.export') === 'Export' && I.translate('vi')('scene.n', 3) === 'Cảnh 3' && I.translate('en')('nope') === 'nope' && I.translate('xx')('tab.export') === 'Xuất');
  const usedKeys = [...fs.readFileSync(path.join(VID, 'src', 'app.js'), 'utf8').matchAll(/\bt\('([\w.:]+)'/g)].map((m) => m[1])
    .concat([...fs.readFileSync(path.join(VID, 'src', 'index.html'), 'utf8').matchAll(/data-(?:t|ph)="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...new Set(usedKeys)].filter((k) => !(k in I.STRINGS.vi) && !/\.$/.test(k));
  check(`every key the app uses exists (${new Set(usedKeys).size} keys)`, usedKeys.length > 60 && missing.length === 0, missing.join(', '));
  // render.js rejects with codes; saveFile in app.js throws create / write / save.
  const codes = [...fs.readFileSync(path.join(VID, 'src', 'render.js'), 'utf8').matchAll(/new Error\('(\w+)'\)/g)].map((m) => m[1]).concat(['create', 'write', 'save']);
  check('every error code has a message in both languages', codes.length === 8 && codes.every((c) => 'err.' + c in I.STRINGS.vi && 'err.' + c in I.STRINGS.en), codes.join());
  check('app.js holds no hard-coded Vietnamese outside comments', !fs.readFileSync(path.join(VID, 'src', 'app.js'), 'utf8').split('\n').some((l) => !/^\s*\/\//.test(l) && /[ạảãàáâăđêôơưếệộợữ]/i.test(l)));

  console.log('desktop server');
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const home = await get(port, '/');
  check('serves the app at /', home.status === 200 && /text\/html/.test(home.type) && home.body.includes('PromptGate'));
  check('serves scripts with a JS content type', /javascript/.test((await get(port, '/core.js')).type));
  check('path traversal and unknown files are 404', (await get(port, '/../server.js')).status === 404 && (await get(port, '/%2e%2e/%2e%2e/package.json')).status === 404 && (await get(port, '/nope.js')).status === 404);
  check('non-GET methods are refused', (await get(port, '/', 'POST')).status === 404);

  console.log('app packaging');
  const html = fs.readFileSync(path.join(VID, 'src', 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  check('index.html only loads local files that exist (works offline)', refs.length >= 4 && refs.every((r) => !/^(https?:)?\/\//.test(r) && fs.existsSync(path.join(VID, 'src', r))), refs.join(','));
  check('every loaded file is bundled into the APK', refs.every((r) => apk.WEB_FILES.includes(r)) && apk.WEB_FILES.includes('index.html'));
  const appJs = fs.readFileSync(path.join(VID, 'src', 'app.js'), 'utf8') + fs.readFileSync(path.join(VID, 'src', 'render.js'), 'utf8');
  check('app never uses innerHTML or network calls', !/innerHTML|fetch\(|XMLHttpRequest|WebSocket/.test(appJs));
  const manifest = fs.readFileSync(path.join(VID, 'android', 'AndroidManifest.xml'), 'utf8');
  check('Android manifest requests no permissions', !/uses-permission/.test(manifest) && manifest.includes(`package="${apk.APP_ID}"`));
  const java = fs.readFileSync(path.join(VID, 'android', 'src', 'com', 'promptgate', 'video', 'MainActivity.java'), 'utf8');
  check('Activity package matches the app id and exposes the bridge the app calls', java.includes(`package ${apk.APP_ID};`) && ['beginSave', 'appendSave', 'endSave', 'copy'].every((m) => new RegExp(`public (synchronized )?\\w+ ${m}\\(`).test(java) && appJs.includes('android.' + m + '(')));
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pgv-'));
  const st = apk.stage(TMP);
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  check('stage copies the web app into assets/www', apk.WEB_FILES.every((f) => fs.readFileSync(path.join(st.assets, 'www', f)).equals(fs.readFileSync(path.join(VID, 'src', f)))));
  check('stage generates a launcher icon per density', Object.keys(apk.ICONS).every((d) => fs.readFileSync(path.join(st.res, 'mipmap-' + d, 'ic_launcher.png')).subarray(0, 4).equals(PNG_SIG)));
  let sdkErr = '';
  try { apk.findSdk({}); } catch (e) { sdkErr = e.message; }
  check('building without an SDK fails with a clear message', /ANDROID_HOME/.test(sdkErr));
  fs.rmSync(TMP, { recursive: true, force: true });

  console.log('real render (headless Chromium)');
  let pw = null;
  try { pw = require('playwright'); } catch (_) { /* optional */ }
  if (!pw) { skip++; console.log('  skip Playwright not installed'); } else {
    let browser = null;
    try {
      browser = await pw.chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, acceptDownloads: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const external = [];
      page.on('request', (r) => { if (!/^(http:\/\/127\.0\.0\.1|blob:|data:)/.test(r.url())) external.push(r.url()); });

      await page.goto(`http://127.0.0.1:${port}/`);
      await page.fill('#brief', 'A sunrise over the beach. A guest opens the curtains. Breakfast by the pool.');
      await page.fill('#total', '12');
      await page.click('#make');
      check('UI: brief → 3 scene cards', (await page.locator('#scenes .card').count()) === 3);
      await page.click('nav [data-tab=prompts]');
      check('UI: 11 tool chips, Veo prompts shown', (await page.locator('#tools button').count()) === 11 && (await page.locator('#prompts .card').count()) === 3);
      await page.click('#tools button:has-text("InVideo")');
      check('UI: editor tool shows one whole-video prompt', (await page.locator('#prompts .card').count()) === 1 && /12-second/.test(await page.locator('#prompts pre').innerText()));
      await page.click('nav [data-tab=export]');
      const lit = await page.evaluate(() => { const c = document.getElementById('preview'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 0) n++; return n / (d.length / 4); });
      await page.fill('#seek', '500');
      const mid = await page.evaluate(() => { const c = document.getElementById('preview'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n / (d.length / 4); });
      check('UI: preview draws a frame (black at t=0 fade-in, picture mid-video)', lit < 0.05 && mid > 0.5, `${lit.toFixed(2)} / ${mid.toFixed(2)}`);
      check('UI: starts in Vietnamese', (await page.innerText('nav [data-tab=export]')) === 'Xuất' && (await page.innerText('#export')) === 'Xuất video' && (await page.getAttribute('html', 'lang')) === 'vi');
      await page.click('#lang [data-lang=en]');
      check('UI: EN button switches every static label', (await page.innerText('nav [data-tab=export]')) === 'Export' && (await page.innerText('#export')) === 'Export video' && (await page.innerText('#play')) === '▶ Preview' && (await page.innerText('label[for=quality]')) === 'Quality' && (await page.getAttribute('html', 'lang')) === 'en');
      const blank = await page.evaluate(() => [...document.querySelectorAll('[data-t]')].filter((e) => !e.textContent.trim() || e.textContent === e.dataset.t).map((e) => e.dataset.t));
      check('UI: no label left blank or showing its key', blank.length === 0, blank.join());
      await page.click('nav [data-tab=prompts]');
      await page.click('#tools button:has-text("Canva")');
      const enText = (await page.innerText('#tool-info')) + (await page.innerText('#warnings')) + (await page.innerText('#prompts h3 >> nth=0'));
      check('UI: tool card, warnings and prompt labels are English', /Native audio: yes/.test(enText) && /does not support 9:16/.test(enText) && /Scene 1/.test(enText) && /Copy/.test(enText), enText.slice(0, 200));
      await page.click('nav [data-tab=scenes]');
      check('UI: scene editor is English, selects keep their values', (await page.innerText('#scenes .card h3 >> nth=0')).startsWith('Scene 1') && (await page.locator('#scenes select >> nth=0').inputValue()) === 'wide' && (await page.locator('#scenes select >> nth=0').locator('option:checked').innerText()) === 'Wide');
      await page.reload();
      check('UI: language choice survives a reload', (await page.innerText('nav [data-tab=export]')) === 'Export' && (await page.inputValue('#style')) === 'cinematic' && (await page.locator('#style option:checked').innerText()) === 'Cinematic');
      await page.click('#lang [data-lang=vi]');
      check('UI: VI button switches back', (await page.innerText('nav [data-tab=export]')) === 'Xuất' && (await page.innerText('#scenes .card h3 >> nth=0')).startsWith('Cảnh 1'));
      check('UI: project survives a reload', (await page.locator('#scenes .card').count()) === 3);

      const dl = page.waitForEvent('download', { timeout: 60000 });
      await page.goto(`http://127.0.0.1:${port}/?selftest=1`);
      await page.waitForFunction(() => window.PGV_SELFTEST, null, { timeout: 60000 });
      const r = await page.evaluate(() => window.PGV_SELFTEST);
      check('export: finished without error', r.ok === true, r.error);
      const file = await (await dl).path();
      const buf = fs.readFileSync(file);
      const isWebm = buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
      const isMp4 = buf.subarray(4, 8).toString('latin1') === 'ftyp';
      check(`export: saved file is a real ${r.mime} container (${buf.length} bytes)`, buf.length === r.bytes && buf.length > 5000 && (isWebm || isMp4));
      check('export: 360p portrait frame size', r.width === 360 && r.height === 640);
      // Decode the exported file again: proves it plays and has the expected picture.
      const played = await page.evaluate(async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const v = document.createElement('video');
        v.muted = true;
        v.src = URL.createObjectURL(new Blob([bytes]));
        await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('decode failed')); });
        await v.play();
        await new Promise((res) => setTimeout(res, 1500));
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        const x = c.getContext('2d'); x.drawImage(v, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
        return { w: v.videoWidth, h: v.videoHeight, t: v.currentTime, lit: n / (d.length / 4) };
      }, buf.toString('base64'));
      check('export: file decodes and plays back with picture', played.w === 360 && played.h === 640 && played.t > 0.5 && played.lit > 0.5, JSON.stringify(played));
      check('no page errors, no request leaves localhost', errors.length === 0 && external.length === 0, errors.concat(external).join(' | '));
    } catch (e) {
      check('browser run completed', false, e.message.split('\n')[0]);
    } finally {
      if (browser) await browser.close();
    }
  }

  server.close();
  console.log(`\n${pass} passed, ${fail} failed${skip ? `, ${skip} skipped` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
