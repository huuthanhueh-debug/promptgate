'use strict';
// Vision 6D mobile tests: the image heuristics, the six-axis pose math, the anatomy data, the
// three.js scene builders (real three.js, no renderer), and the build (web bundle, zip writer,
// icon, Android shell). The APK itself is built and inspected only where an Android SDK is
// installed (CI); elsewhere that block reports "skipped".
// Run directly (node tests/mobile.js) or through tests/run.js (spawned as a child process).
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const throws = (fn) => { try { fn(); return false; } catch (_) { return true; } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);

// Paints a w*h RGBA buffer from a per-pixel colour function.
function image(w, h, fn) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y), p = (y * w + x) * 4;
    d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
  }
  return d;
}
const BLUE = [70, 110, 160], SKIN = [217, 160, 124], SHIRT = [240, 240, 235], PANTS = [35, 45, 70];
// A standing figure on a plain wall: head, torso with arms, legs.
function personImage(w, h) {
  return image(w, h, (x, y) => {
    const u = x / w, v = y / h;
    if (Math.hypot((u - 0.5) / 0.07, (v - 0.14) / 0.07) < 1) return SKIN;
    if (v > 0.2 && v < 0.55 && Math.abs(u - 0.5) < 0.14) return SHIRT;
    if (v > 0.24 && v < 0.6 && Math.abs(u - 0.5) >= 0.14 && Math.abs(u - 0.5) < 0.19) return SKIN;
    if (v >= 0.55 && v < 0.95 && Math.abs(u - 0.5) < 0.12) return PANTS;
    return BLUE;
  });
}

(async () => {
  const D = await load('core/depth.js');
  const S = await load('core/sixdof.js');
  const A = await load('core/anatomy.js');
  const SC = await load('core/scene.js');
  const L = await load('core/i18n.js');
  const M = await load('mobile/strings.js');
  const I = Object.assign({}, L, M);
  const THREE = await load('core/vendor/three.module.min.js');

  console.log('depth');
  {
    const w = 48, h = 64;
    const flat = image(w, h, () => [120, 120, 120]);
    const lum = D.luminance(image(2, 2, (x) => (x ? [255, 255, 255] : [0, 0, 0])), 2, 2);
    check('luminance maps black to 0 and white to 1', lum[0] === 0 && near(lum[1], 1, 1e-5));
    const ramp = Float32Array.from({ length: w * h }, (_, i) => (i % w) / w);
    const blurred = D.boxBlur(ramp, w, h, 3);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    check('boxBlur keeps a constant image constant', D.boxBlur(new Float32Array(w * h).fill(0.3), w, h, 5).every((v) => near(v, 0.3, 1e-5)));
    check('boxBlur smooths without changing the middle of a ramp', near(blurred[10 * w + 24], ramp[10 * w + 24], 1e-5) && near(mean(blurred), mean(ramp), 0.02));
    const dFlat = D.estimateDepth(flat, w, h);
    check('depth has one value per pixel, all within 0..1', dFlat.length === w * h && dFlat.every((v) => v >= 0 && v <= 1));
    check('a featureless image still gets depth from position (bottom nearer than top)', dFlat[(h - 2) * w + w / 2] > dFlat[1 * w + w / 2]);
    // A detailed checker patch on a smooth background should come forward.
    const patch = image(w, h, (x, y) => (x > 30 && x < 44 && y > 6 && y < 20 ? ((x + y) % 2 ? [230, 230, 230] : [20, 20, 20]) : [120, 120, 120]));
    const dPatch = D.estimateDepth(patch, w, h);
    check('sharp detail reads as nearer than the same spot without it', dPatch[13 * w + 37] > dFlat[13 * w + 37] + 0.1, `${dPatch[13 * w + 37]} vs ${dFlat[13 * w + 37]}`);
    check('weights that cancel every cue give a flat 0.5 map', D.estimateDepth(flat, w, h, { focus: 0, vertical: 0, center: 0, light: 0 }).every((v) => v === 0.5));
    check('rejects images that are too small or buffers that are too short', throws(() => D.estimateDepth(flat, 1, 1)) && throws(() => D.estimateDepth(new Uint8ClampedArray(8), 4, 4)) && throws(() => D.detectPerson(flat, 0, 5)));
    check('layerOf splits 0..1 into n layers and clamps', D.layerOf(0, 4) === 0 && D.layerOf(0.49, 4) === 1 && D.layerOf(1, 4) === 3 && D.layerOf(-1, 4) === 0 && D.layerOf(NaN, 4) === 0);
  }

  console.log('person detection');
  {
    const w = 90, h = 120;
    check('isSkin accepts light, medium and dark skin tones', D.isSkin(241, 194, 167) && D.isSkin(198, 134, 94) && D.isSkin(120, 76, 50));
    check('isSkin rejects blue, green, white and grey', !D.isSkin(40, 80, 200) && !D.isSkin(40, 160, 60) && !D.isSkin(250, 250, 250) && !D.isSkin(128, 128, 128));
    const p = D.detectPerson(personImage(w, h), w, h);
    check('a standing figure is detected as a person', p.isPerson && p.score >= 0.65, JSON.stringify(p));
    check('its bounding box hugs the figure', near(p.bbox.x0, 0.31, 0.05) && near(p.bbox.x1, 0.69, 0.05) && near(p.bbox.y0, 0.07, 0.05) && near(p.bbox.y1, 0.95, 0.05), JSON.stringify(p.bbox));
    const land = D.detectPerson(image(w, h, (x, y) => (y < 60 ? [90, 150, 230] : [50, 140, 60])), w, h);
    check('a landscape with no skin tones is not a person', !land.isPerson && land.skinRatio === 0, JSON.stringify(land));
    const sand = D.detectPerson(image(120, 60, (x, y) => (y > 30 ? SKIN : [90, 150, 230])), 120, 60);
    check('a wide skin-coloured band (sand, wood) is not a person', !sand.isPerson, JSON.stringify(sand));
    const blank = D.detectPerson(image(w, h, () => [128, 128, 128]), w, h);
    check('a blank image is not a person and falls back to a centred box', !blank.isPerson && blank.bbox.x0 === 0.2 && blank.bbox.y1 === 0.98);
  }

  console.log('six axes');
  {
    check('six axes J1..J6: three rotations then three translations', S.AXES.length === 6 && S.AXES.map((a) => a.id).join() === 'J1,J2,J3,J4,J5,J6' && S.AXES.slice(0, 3).every((a) => a.unit === '°') && S.AXES.slice(3).every((a) => a.unit === ''));
    const p0 = S.defaultPose();
    check('default pose is all zeros', Object.values(p0).every((v) => v === 0) && Object.keys(p0).length === 6);
    const c = S.clampPose({ yaw: 190, pitch: 200, roll: -540, x: 9, y: -9, z: 99 });
    check('clampPose wraps yaw/roll and clamps the rest', c.yaw === -170 && c.pitch === 85 && Math.abs(c.roll) === 180, JSON.stringify(c));
    check('clampPose limits translations', c.x === 1.5 && c.y === -1.5 && c.z === 1.2);
    check('bad input resets to zero instead of producing NaN', Object.values(S.clampPose({ yaw: NaN, x: 'abc', z: Infinity })).every((v) => v === 0) && Object.values(S.clampPose(null)).every((v) => v === 0));
    check('setAxis works by id and by key, ignores unknown axes', S.setAxis(p0, 'J4', 0.5).x === 0.5 && S.setAxis(p0, 'pitch', -30).pitch === -30 && JSON.stringify(S.setAxis(p0, 'J9', 5)) === JSON.stringify(p0));
    check('setAxis does not mutate its input', p0.x === 0);
    const d = S.applyDrag(p0, 0.25, -0.1);
    check('a drag orbits: right turns yaw, up tilts pitch', d.yaw === 45 && near(d.pitch, -12) && d.x === 0);
    const pin = S.applyPinch(p0, 2, 15, 0.1, 0.2);
    check('pinch out moves closer, twist rolls, two-finger pan slides', pin.z > 0.9 && pin.roll === -15 && near(pin.x, 0.2) && near(pin.y, -0.4));
    check('pinch ignores a zero or negative scale', S.applyPinch(p0, 0, 0, 0, 0).z === 0 && S.applyPinch(p0, -3, NaN, 0, 0).roll === 0);
    const l = S.lerpPose({ yaw: 170 }, { yaw: -170 }, 0.5);
    check('lerpPose turns the short way across ±180°', Math.abs(l.yaw) === 180, String(l.yaw));
    check('lerpPose hits both ends', S.lerpPose({ x: 1 }, { x: -1 }, 0).x === 1 && S.lerpPose({ x: 1 }, { x: -1 }, 1).x === -1 && S.lerpPose({ x: 1 }, { x: -1 }, 5).x === -1);
    const o = S.orbitPose(1.3, { x: 0.4 });
    check('orbitPose sways rotation only', o.x === 0.4 && o.yaw !== 0 && Math.abs(o.yaw) <= 24 && Math.abs(o.pitch) <= 8);
    const g = S.poseFromOrientation(p0, 70, 20, 40, 5);
    check('gyro tilt is relative to the starting attitude and limited', g.yaw === 15 && g.pitch === 30 && S.poseFromOrientation(p0, 400, 400, 0, 0).yaw === 45);
    check('gyro ignores missing sensor values', S.poseFromOrientation({ yaw: 10 }, NaN, 3, 0, 0).yaw === 10);
    const t = S.poseToTransform({ yaw: 90, pitch: -45, roll: 180, x: 1, y: -1, z: 0.5 });
    check('poseToTransform gives radians in YXZ order and a position', t.order === 'YXZ' && near(t.rotation[1], Math.PI / 2) && near(t.rotation[0], -Math.PI / 4) && near(Math.abs(t.rotation[2]), Math.PI) && t.position.join() === '1,-1,0.5');
  }

  console.log('anatomy data');
  {
    const ids = A.PARTS.map((p) => p.id);
    check('part ids are unique', new Set(ids).size === ids.length);
    check('three systems, each with parts', A.SYSTEMS.map((s) => s.id).join() === 'skeleton,organs,vessels' && A.SYSTEMS.every((s) => A.partsOf(s.id).length > 5));
    const pts = (p) => (p.shape === 'tube' ? p.path : p.shape === 'bone' ? [p.from, p.to] : [p.at]);
    const out = A.PARTS.filter((p) => pts(p).some((q) => q.length !== 3 || !q.every(Number.isFinite) || q[1] < 0 || q[1] > 1 || Math.abs(q[0]) > 0.25 || Math.abs(q[2]) > 0.12));
    check('every part sits inside the unit figure', out.length === 0, out.map((p) => p.id).join());
    const left = ids.filter((i) => /L$/.test(i)), right = new Set(ids.filter((i) => /R$/.test(i)));
    check('paired parts exist on both sides', left.length >= 15 && left.every((i) => right.has(i.replace(/L$/, 'R'))));
    const fem = A.PARTS.find((p) => p.id === 'femurL'), femR = A.PARTS.find((p) => p.id === 'femurR');
    check('left and right limbs mirror each other', fem.from[0] === -femR.from[0] && fem.to[1] === femR.to[1]);
    check('24 vertebrae and 10 rib pairs', A.PARTS.filter((p) => p.group === 'spine').length === 24 && A.PARTS.filter((p) => p.group === 'ribs').length === 10);
    const organs = A.partsOf('organs').map((p) => p.id);
    check('main organs present', ['brain', 'heart', 'lungL', 'lungR', 'liver', 'stomach', 'kidneyL', 'kidneyR', 'intestines'].every((o) => organs.includes(o)));
    const heart = A.PARTS.find((p) => p.id === 'heart'), liver = A.PARTS.find((p) => p.id === 'liver'), brain = A.PARTS.find((p) => p.id === 'brain');
    check('heart sits left of the midline, liver on the right, brain in the head', heart.at[0] > 0 && liver.at[0] < 0 && brain.at[1] > 0.9);
    const badLabels = A.LABELS.filter((l) => !A.PARTS.some((p) => A.matchesPart(p, l.part) && p.system === l.system) || !l.vi || !l.en || !l.info || !['left', 'right'].includes(l.side));
    check('every label points at a real part and has vi/en/info text', A.LABELS.length >= 14 && badLabels.length === 0, badLabels.map((l) => l.id).join());
    check('label ids are unique', new Set(A.LABELS.map((l) => l.id)).size === A.LABELS.length);
    check('labelForPart finds the label for either side and for grouped parts', A.labelForPart(femR).vi === 'Xương đùi' && A.labelForPart(A.PARTS.find((p) => p.id === 'vertebra7')).id === 'spine' && A.labelForPart(A.PARTS.find((p) => p.id === 'lungR')).id === 'lungs' && A.labelForPart(null) === null);
    check('parts without a label return null', A.labelForPart(A.PARTS.find((p) => p.id === 'jaw')) === null);
    const f = A.fitToBBox({ x0: 0.25, y0: 0.1, x1: 0.75, y1: 0.9 }, 1.5, 2);
    check('fitToBBox scales the figure to the subject and stands it on the box bottom', near(f.scale, 1.6) && near(f.x, 0) && near(f.y, -0.8));
    const f2 = A.fitToBBox({ x0: 0.6, y0: 0.5, x1: 0.8, y1: 0.6 }, 2, 2);
    check('a tiny box is not allowed to shrink the figure below 30%', near(f2.scale, 0.6) && near(f2.x, 0.4));
    const fd = A.fitToBBox(null, 1.5, 2), fbad = A.fitToBBox({ x0: 1, y0: 1, x1: 0, y1: NaN }, 1.5, 2);
    check('a missing or invalid box falls back to a centred figure', near(fd.scale, 1.8) && near(fd.x, 0) && fbad.scale === fd.scale);
    check('explodeOffset: skeleton stays, organs and vessels step forward, input clamped', A.explodeOffset('skeleton', 1) === 0 && A.explodeOffset('organs', 1) > 0 && A.explodeOffset('vessels', 1) > A.explodeOffset('organs', 1) && A.explodeOffset('vessels', 9) === A.explodeOffset('vessels', 1) && A.explodeOffset('nope', 1) === 0 && A.explodeOffset('organs', NaN) === 0);
  }

  console.log('languages (vi / en)');
  {
    const vi = Object.keys(I.STRINGS.vi).sort(), en = Object.keys(I.STRINGS.en).sort();
    check('Vietnamese and English tables have the same keys', vi.join() === en.join() && vi.length > 40, vi.filter((k) => !en.includes(k)).concat(en.filter((k) => !vi.includes(k))).join());
    check('no string is empty', I.LANGS.every((l) => Object.values(I.STRINGS[l]).every((v) => typeof v === 'string' && v.trim())));
    const VI_CHARS = /[\u00c0-\u1ef9]/;
    const leaked = Object.entries(I.STRINGS.en).filter(([k, v]) => k !== 'lang.switchLabel' && VI_CHARS.test(v.replace(/[→←₂]/g, '')));
    check('English strings contain no Vietnamese text', leaked.length === 0, leaked.map(([k]) => k).join());
    const same = vi.filter((k) => I.STRINGS.vi[k] === I.STRINGS.en[k] && !['mode.relief', 'style.holo'].includes(k));
    check('every string is actually translated', same.length === 0, same.join());
    check('the toggle shows the language you would switch to', I.t('vi', 'lang.switch') === 'EN' && I.t('en', 'lang.switch') === 'VI' && I.otherLang('vi') === 'en' && I.otherLang('en') === 'vi' && I.otherLang('xx') === 'en');
    check('pickLang: stored choice, then device language, then Vietnamese', I.pickLang('en', 'vi-VN') === 'en' && I.pickLang(null, 'en-US') === 'en' && I.pickLang(null, 'vi-VN') === 'vi' && I.pickLang('zz', 'fr-FR') === 'vi' && I.pickLang(undefined, undefined) === 'vi');
    check('t() fills placeholders and falls back safely', I.t('en', 'toast.savedTo', { where: 'Pictures' }) === 'Saved to: Pictures' && I.t('vi', 'toast.savedTo', { where: 'X' }) === 'Đã lưu vào: X' && I.t('fr', 'home.pick') === 'Thư viện' && I.t('en', 'no.such.key') === 'no.such.key');
    const html = fs.readFileSync(path.join(ROOT, 'mobile', 'index.html'), 'utf8');
    const keys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);
    check('every data-i18n key in the page exists in both tables', keys.length > 25 && keys.every((k) => k in I.STRINGS.vi && k in I.STRINGS.en), keys.filter((k) => !(k in I.STRINGS.vi)).join());
    const body = html.slice(html.indexOf('<body>'));
    check('the page hard-codes no Vietnamese text (all of it comes from the tables)', !VI_CHARS.test(body));
    check('both screens carry a language button', (html.match(/data-lang-toggle/g) || []).length === 2);
    const app = fs.readFileSync(path.join(ROOT, 'mobile', 'app.js'), 'utf8');
    const usedKeys = [...app.matchAll(/(?:tr|notice)\('([a-zA-Z]+\.[a-zA-Z.]+)'/g)].map((m) => m[1]).concat([...app.matchAll(/'((?:toast|notice)\.[a-zA-Z]+)'/g)].map((m) => m[1]));
    check('every string key the script uses exists', usedKeys.length > 12 && usedKeys.every((k) => k in I.STRINGS.en), usedKeys.filter((k) => !(k in I.STRINGS.en)).join());
    check('the script itself holds no Vietnamese literals', !app.split('\n').some((l) => !l.trim().startsWith('//') && VI_CHARS.test(l)));
    check('axes are named in both languages', S.AXES.every((a) => a.vi && a.en && a.vi !== a.en));
    check('body systems are named in both languages', A.SYSTEMS.every((x) => x.vi && x.en));
    check('every anatomy label has an English description', A.LABELS.every((l) => l.infoEn && l.infoEn !== l.info && !VI_CHARS.test(l.infoEn.replace('₂', ''))));
  }

  console.log('three.js scene');
  {
    check('vendored three.js is r170', THREE.REVISION === '170', THREE.REVISION);
    const dw = 12, dh = 16;
    const depth = Float32Array.from({ length: dw * dh }, (_, i) => Math.floor(i / dw) / (dh - 1)); // top far, bottom near
    const relief = SC.buildRelief(THREE, { depth, dw, dh, planeW: 1.5, planeH: 2, texture: null });
    const pos = relief.userData.geometry.attributes.position;
    check('relief has one vertex per depth sample', pos.count === dw * dh);
    check('relief keeps the photo plane size', near(pos.getX(0), -0.75) && near(pos.getY(0), 1) && near(pos.getX(dw - 1), 0.75) && near(pos.getY(dw * dh - 1), -1));
    check('vertices are displaced by depth (top row flat, bottom row forward)', pos.getZ(0) === 0 && near(pos.getZ(dw * dh - 1), 0.5));
    SC.updateRelief(relief, { strength: 1 });
    check('updateRelief rescales the displacement', near(pos.getZ(dw * dh - 1), 1));
    SC.updateRelief(relief, { explode: 1, layers: 4 });
    const zs = new Set(); for (let r = 0; r < dh; r++) zs.add(Math.round((pos.getZ(r * dw) - depth[r * dw]) * 1000));
    check('explode pulls the image apart into the requested number of layers', zs.size === 4 && near(pos.getZ(dw * dh - 1), 1.9), [...zs].join());
    check('explode leaves the far layer in place', pos.getZ(0) === 0);
    SC.updateRelief(relief, { explode: 7 });
    check('explode is clamped to 0..1', relief.userData.explode === 1);
    const vis = () => ['photo', 'wire', 'points'].map((n) => +relief.getObjectByName(n).visible).join('');
    SC.setReliefStyle(relief, 'photo'); const v1 = vis();
    SC.setReliefStyle(relief, 'mix'); const v2 = vis();
    SC.setReliefStyle(relief, 'holo'); const v3 = vis();
    SC.setReliefStyle(relief, 'bogus'); const v4 = vis();
    check('styles: photo, mix (photo + wire), holo (wire + points); unknown falls back to photo', v1 === '100' && v2 === '110' && v3 === '011' && v4 === '100', [v1, v2, v3, v4].join());
    check('relief carries per-vertex colours for the hologram', relief.userData.geometry.attributes.color.count === dw * dh);
    check('buildRelief rejects a depth map of the wrong size', throws(() => SC.buildRelief(THREE, { depth: new Float32Array(5), dw, dh, planeW: 1, planeH: 1 })));

    const body = SC.buildAnatomy(THREE);
    const meshes = body.getObjectsByProperty('isMesh', true);
    check('anatomy has one mesh per part, grouped by system', meshes.length === A.PARTS.length && A.SYSTEMS.every((s) => body.getObjectByName(s.id).children.length === A.partsOf(s.id).length));
    body.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body);
    check('the figure stands from the floor to height 1 and is centred', box.min.y > -0.02 && box.min.y < 0.03 && box.max.y > 0.97 && box.max.y < 1.03 && near(box.min.x, -box.max.x, 0.02), JSON.stringify(box));
    const bad = meshes.filter((m) => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (!Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) return true; return p.count === 0; });
    check('every part geometry is non-empty and finite', bad.length === 0, bad.map((m) => m.name).join());
    const femur = body.getObjectByName('femurL');
    const fb = new THREE.Box3().setFromObject(femur);
    check('a bone spans its two joints', near(fb.max.y, A.JOINTS.hipL[1], 0.02) && near(fb.min.y, A.JOINTS.kneeL[1], 0.02));
    check('highlightPart lights a single part and dims the others', SC.highlightPart(body, 'heart') === 1 && body.getObjectByName('heart').material.opacity === 1 && body.getObjectByName('liver').material.opacity < 0.5);
    check('highlightPart accepts a group (the whole spine)', SC.highlightPart(body, 'spine') === 24 && body.userData.selected === 'spine');
    check('highlightPart(null) restores every material', SC.highlightPart(body, null) === 0 && meshes.every((m) => m.material.opacity === m.userData.baseOpacity) && body.userData.selected === null);
    check('an unknown part highlights nothing', SC.highlightPart(body, 'tail') === 0 && body.userData.selected === null);
    SC.highlightPart(body, null);
    SC.setExplode(body, 1);
    check('setExplode separates the systems along z', body.getObjectByName('skeleton').position.z === 0 && body.getObjectByName('organs').position.z > 0 && body.getObjectByName('vessels').position.z > body.getObjectByName('organs').position.z);
    SC.setExplode(body, 0);
    SC.setSystemVisible(body, 'organs', false);
    check('setSystemVisible hides one system only', !body.getObjectByName('organs').visible && body.getObjectByName('skeleton').visible);
    const heart = body.getObjectByName('heart'), s0 = heart.scale.x;
    SC.animateAnatomy(body, 0);
    const beat = heart.scale.x;
    SC.animateAnatomy(body, 0.6);
    check('the heart beats: bigger at the start of a beat, near rest later', beat > s0 * 1.1 && heart.scale.x < s0 * 1.03);
    const dna = SC.buildDNA(THREE);
    const db = new THREE.Box3().setFromObject(dna);
    check('DNA helix: two strands plus rungs, height 1', dna.children.length === 3 && near(db.max.y - db.min.y, 1, 0.05));
    check('disposeTree releases geometries and materials', SC.disposeTree(body) > 100 && SC.disposeTree(relief) >= 4);
  }

  console.log('build');
  {
    const B = require(path.join(ROOT, 'tools', 'build.js'));
    const zip = require(path.join(ROOT, 'android', 'zip.js'));
    const icon = require(path.join(ROOT, 'android', 'icon.js'));
    const www = B.buildWeb({ quiet: true });
    for (const f of ['mobile/index.html', 'mobile/app.js', 'mobile/strings.js', 'core/depth.js', 'core/sixdof.js', 'core/anatomy.js', 'core/scene.js', 'core/i18n.js', 'core/vendor/three.module.min.js', 'core/vendor/THREE-LICENSE']) {
      check(`dist/www/${f} exists`, fs.existsSync(path.join(www, f)));
    }
    check('the Node-only package.json files are not shipped', !fs.existsSync(path.join(www, 'core', 'package.json')) && !fs.existsSync(path.join(www, 'mobile', 'package.json')));
    check('desktop code is not shipped in the mobile bundle', !fs.existsSync(path.join(www, 'desktop')));
    const html = fs.readFileSync(path.join(www, 'mobile', 'index.html'), 'utf8');
    const csp = (/Content-Security-Policy" content="([^"]+)"/.exec(html) || [])[1] || '';
    check('page has a CSP that allows no remote origin', csp.includes("default-src 'self'") && !/https?:|\*/.test(csp), csp);
    const own = ['mobile/index.html', 'mobile/app.js', 'mobile/strings.js', 'core/depth.js', 'core/sixdof.js', 'core/anatomy.js', 'core/scene.js', 'core/i18n.js'].map((f) => fs.readFileSync(path.join(www, f), 'utf8')).join('\n');
    const remote = (own.match(/https?:\/\/[^\s'"`)]+/g) || []).filter((u) => !u.startsWith('http://www.w3.org/'));
    check('our code references no remote URL (works offline)', remote.length === 0, remote.join());
    check('our code never calls fetch/XHR/WebSocket/sendBeacon', !/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(own));
    check('three.js is imported from the vendored file', /from '\.\.\/core\/vendor\/three\.module\.min\.js'/.test(own));
    check('three.js licence ships with the bundle', /MIT License/.test(fs.readFileSync(path.join(www, 'core', 'vendor', 'THREE-LICENSE'), 'utf8')));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const used = [...new Set([...own.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]))];
    check('every element id the script looks up exists in the page', used.length > 20 && used.every((i) => ids.includes(i)), used.filter((i) => !ids.includes(i)).join());

    const manifest = fs.readFileSync(path.join(ROOT, 'android', 'AndroidManifest.xml'), 'utf8');
    const perms = [...manifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map((m) => m[1]);
    check('Android manifest asks for CAMERA only (no INTERNET, no storage)', perms.join() === 'android.permission.CAMERA', perms.join());
    check('manifest package matches app.json and backups are off', manifest.includes(`package="${B.APP.id}"`) && manifest.includes('android:allowBackup="false"') && manifest.includes('android:usesCleartextTraffic="false"'));
    const java = fs.readFileSync(path.join(ROOT, 'android', 'src', ...B.APP.id.split('.'), 'MainActivity.java'), 'utf8');
    check('shell declares the package from app.json', java.includes(`package ${B.APP.id};`));
    check('shell blocks file access, path traversal and foreign origins', java.includes('setAllowFileAccess(false)') && java.includes('path.contains("..")') && java.includes('!HOST.equals(request.getOrigin().getHost())'));
    check('shell exposes exactly one bridge method', (java.match(/@JavascriptInterface/g) || []).length === 1);
    const bridgeReturns = [...java.slice(java.indexOf('class Bridge')).matchAll(/return ("[^"]*")/g)].map((m) => m[1]);
    check('bridge answers with language-neutral codes the page translates', bridgeReturns.length >= 6 && bridgeReturns.every((r) => r === '"error"' || r.startsWith('"ok:')), bridgeReturns.join());

    const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const png = icon.png(48);
    check('launcher icon is a valid 48px RGBA PNG', png.subarray(0, 8).equals(PNG_SIG) && png.readUInt32BE(16) === 48 && png.readUInt32BE(20) === 48 && png[25] === 6);
    check('icons cover mdpi..xxxhdpi', Object.keys(icon.DENSITIES).join() === 'mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi' && icon.DENSITIES.xxxhdpi === 192);

    const big = Buffer.from('vision6d '.repeat(500));
    const entries = [{ name: 'AndroidManifest.xml', data: big }, { name: 'a', data: Buffer.from('x') }, { name: 'resources.arsc', data: Buffer.from([1, 2, 3, 4, 5]), store: true }, { name: 'assets/www/tên.js', data: Buffer.from('ok') }, { name: 'res/i.png', data: png, store: true }, { name: 'empty', data: Buffer.alloc(0) }];
    const z = zip.writeZip(entries);
    const back = zip.readZip(z);
    check('zip round-trips names (UTF-8) and bytes', back.length === entries.length && back.every((e, i) => e.name === entries[i].name && e.data.equals(entries[i].data)));
    check('zip compresses by default and stores when asked', !back[0].stored && z.length < big.length && back[2].stored && back[4].stored);
    check('stored entries start on a 4-byte boundary (what zipalign does)', back.filter((e) => e.stored).every((e) => e.dataOffset % 4 === 0), back.map((e) => e.dataOffset).join());
    check('zip output is deterministic', zip.writeZip(entries).equals(z));
    check('zip rejects duplicate, absolute and traversal names', throws(() => zip.writeZip([entries[1], entries[1]])) && throws(() => zip.writeZip([{ name: '/etc/x', data: big }])) && throws(() => zip.writeZip([{ name: 'a/../../x', data: big }])));
    check('readZip rejects non-zip data', throws(() => zip.readZip(Buffer.from('not a zip at all, sorry........'))));
    check('crc32 matches the standard check value', zip.crc32(Buffer.from('123456789')) === 0xcbf43926);

    const none = B.findTools({ ANDROID_HOME: path.join(ROOT, 'no-such-sdk') });
    check('findTools reports what is missing when there is no SDK', !none.ok && ['aapt2', 'androidJar', 'r8Jar', 'apksignerJar'].every((k) => none.missing.includes(k)));

    const tools = B.findTools();
    if (!tools.ok) {
      console.log('  skip APK build (no Android SDK here; missing: ' + tools.missing.join(', ') + ')');
    } else {
      let apk = null, err = '';
      try { apk = B.buildApk({ quiet: true }); } catch (e) { err = e.message.replace(/\s*\r?\n\s*/g, ' ⏎ '); } // one line, so tests/run.js relays the whole tool error
      check('APK builds and its signature verifies', !!apk && fs.existsSync(apk), err);
      if (apk) {
        const files = zip.readZip(fs.readFileSync(apk));
        const names = files.map((f) => f.name);
        check('APK holds manifest, dex, resources and the web app', ['AndroidManifest.xml', 'classes.dex', 'resources.arsc', 'assets/www/mobile/index.html', 'assets/www/mobile/app.js', 'assets/www/core/scene.js', 'assets/www/core/vendor/three.module.min.js'].every((n) => names.includes(n)), names.join());
        const arsc = files.find((f) => f.name === 'resources.arsc');
        check('resources.arsc is stored and 4-byte aligned after signing', arsc.stored && arsc.dataOffset % 4 === 0);
        check('launcher icons are packaged at five densities', names.filter((n) => /^res\/.*\.png$/.test(n)).length === 5, names.filter((n) => n.startsWith('res/')).join());
        check('dex is a DEX file and names the activity', files.find((f) => f.name === 'classes.dex').data.subarray(0, 4).toString('latin1') === 'dex\n' && files.find((f) => f.name === 'classes.dex').data.includes(Buffer.from('L' + B.APP.id.split('.').join('/') + '/MainActivity;')));
        check('the packaged web app matches the build', files.find((f) => f.name === 'assets/www/mobile/app.js').data.equals(fs.readFileSync(path.join(www, 'mobile', 'app.js'))));
        check('APK carries a v2+ signing block', fs.readFileSync(apk).includes(Buffer.from('APK Sig Block 42')));
      }
    }
    check('end-to-end browser test is present', fs.existsSync(path.join(ROOT, 'tests', 'mobile-e2e.js')));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('  FAIL crashed → ' + (e && e.stack || e));
  console.log(`\n${pass} passed, ${fail + 1} failed`);
  process.exit(1);
});
