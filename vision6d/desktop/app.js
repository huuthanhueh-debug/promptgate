// Vision 6D desktop: drop images in, preview them in 3D / 4D / 6D, write the extracted files to
// the output folder through the local server. UI glue; the heavy lifting is in ./lib and ../core.
import * as THREE from '../core/vendor/three.module.min.js';
import { estimateDepth, detectPerson } from '../core/depth.js';
import { defaultPose, applyDrag, clampPose, poseToTransform } from '../core/sixdof.js';
import { fitToBBox } from '../core/anatomy.js';
import { buildRelief, updateRelief, setReliefStyle, buildAnatomy, disposeTree } from '../core/scene.js';
import { pickLang, otherLang } from '../core/i18n.js';
import { paintScene, paintPerson } from '../core/demo.js';
import { t } from './strings.js';
import * as X from './lib/extract.js';
import { checkGlb } from './lib/glb.js';

const $ = (id) => document.getElementById(id);
const MAX_TEXTURE = 2048; // longest side of the exported photo / texture
const FOV = 40;
const TOKEN = new URLSearchParams(location.hash.slice(1)).get('t') || '';

const state = {
  lang: 'vi',
  items: [], // { id, name, source: File | canvas, status, dir, savedPath, count, error, customDepth, analysis, key }
  selected: null,
  view: '3d',
  opts: { detail: 256, strength: 0.3, layers: 5, invert: false, anatomy: 'auto' },
  pose: defaultPose(),
  busy: false,
  outDir: '',
};
const tr = (key, vars) => t(state.lang, key, vars);
let nextId = 1;

// ---------- helpers ----------
let toastTimer = 0;
function toast(msg, bad, ms) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('bad', !!bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms || 4200);
}
async function api(method, path, body) {
  const headers = { 'x-v6d-token': TOKEN };
  let payload = body;
  if (body && !(body instanceof Blob)) { payload = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  let res;
  try { res = await fetch(path, { method, headers, body: payload }); } catch (_) { throw new Error(tr('msg.noServer')); }
  if (!res.ok) throw new Error(res.status === 403 ? tr('msg.noServer') : `${method} ${path}: ${res.status}`);
  return res.json();
}
const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality));
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rgbaCanvas(rgba, w, h) { const c = canvasOf(w, h); c.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0); return c; }
function scaled(src, w, h) {
  const c = canvasOf(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, w, h);
  return c;
}
const selectedItem = () => state.items.find((i) => i.id === state.selected) || null;

// ---------- analysis: pixels -> depth grid ----------
async function decode(source) {
  if (source instanceof HTMLCanvasElement) return source;
  try { return await createImageBitmap(source, { imageOrientation: 'from-image' }); } catch (_) { throw new Error(tr('msg.badImage')); }
}
async function analyze(item) {
  const o = state.opts;
  const key = [o.detail, o.invert, item.depthVersion || 0].join('|');
  if (item.analysis && item.key === key) return item.analysis;
  const src = await decode(item.source);
  if (!src.width || !src.height) throw new Error(tr('msg.badImage'));
  const k = Math.min(1, MAX_TEXTURE / Math.max(src.width, src.height));
  const w = Math.max(2, Math.round(src.width * k)), h = Math.max(2, Math.round(src.height * k));
  const tex = scaled(src, w, h);
  if (src.close) src.close();
  const { dw, dh } = X.gridSize(w, h, o.detail);
  const rgba = scaled(tex, dw, dh).getContext('2d').getImageData(0, 0, dw, dh).data;
  const person = detectPerson(rgba, dw, dh);
  let depth, depthSource = 'estimated';
  if (item.customDepth) {
    depth = X.depthFromGray(scaled(item.customDepth, dw, dh).getContext('2d').getImageData(0, 0, dw, dh).data, dw, dh);
    depthSource = 'supplied';
  } else depth = estimateDepth(rgba, dw, dh);
  if (o.invert) depth = X.invertDepth(depth);
  item.analysis = { tex, w, h, dw, dh, rgba, depth, person, depthSource };
  item.key = key;
  return item.analysis;
}

// ---------- extraction: one image -> the list of files ----------
function anatomyParts(a) {
  const plane = X.planeSize(a.w, a.h, 1);
  const fit = fitToBBox(a.person.isPerson ? a.person.bbox : null, plane.w, plane.h);
  const holder = new THREE.Group();
  const figure = buildAnatomy(THREE);
  holder.add(figure);
  holder.scale.setScalar(fit.scale);
  holder.position.set(fit.x, fit.y, state.opts.strength + 0.08 * fit.scale); // just in front of the relief
  holder.updateMatrixWorld(true);
  const parts = [];
  figure.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count;
    const indices = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: count }, (_, i) => i);
    const c = m.material.color;
    parts.push({ name: m.name, system: m.userData.part.system, positions: new Float32Array(g.attributes.position.array), normals: new Float32Array(g.attributes.normal.array), indices, color: [c.r, c.g, c.b] });
    g.dispose();
  });
  disposeTree(figure);
  return parts;
}

async function buildFiles(item, a) {
  const o = state.opts;
  const files = [];
  const add = (path, blob, what) => files.push({ path, blob, what });
  const glb = (path, bytes, what) => {
    const check = checkGlb(bytes);
    if (!check.ok) throw new Error(`${path}: ${check.errors[0]}`);
    add(path, new Blob([bytes], { type: 'model/gltf-binary' }), what);
  };
  const plane = X.planeSize(a.w, a.h, 1);
  const geo = { planeW: plane.w, planeH: plane.h, strength: o.strength };

  const photo = await toBlob(a.tex, 'image/jpeg', 0.92);
  add('photo.jpg', photo, 'source image, resized');
  const input = { name: X.sanitizeName(item.name), width: a.w, height: a.h, depth: a.depth, dw: a.dw, dh: a.dh, textureBytes: new Uint8Array(await photo.arrayBuffer()), textureMime: 'image/jpeg', strength: o.strength, layers: o.layers };

  const depthFull = scaled(rgbaCanvas(X.depthToRgba(a.depth), a.dw, a.dh), a.w, a.h);
  add('depth.png', await toBlob(depthFull, 'image/png'), 'depth map, white = near');
  add('normal.png', await toBlob(scaled(rgbaCanvas(X.normalMapRgba(a.depth, a.dw, a.dh, geo), a.dw, a.dh), a.w, a.h), 'image/png'), 'tangent-space normal map');

  const pixels = a.tex.getContext('2d').getImageData(0, 0, a.w, a.h).data;
  const depthPixels = depthFull.getContext('2d').getImageData(0, 0, a.w, a.h).data;
  for (let i = 0; i < o.layers; i++) {
    const layer = X.layerRgba(pixels, depthPixels, a.w, a.h, o.layers, i);
    if (!layer.pixels) continue; // nothing at this depth
    add(`layers/layer-${i + 1}.png`, await toBlob(rgbaCanvas(layer.rgba, a.w, a.h), 'image/png'), `depth layer ${i + 1} of ${o.layers} (1 = farthest), transparent elsewhere`);
  }

  glb('model-3d.glb', X.build3dGlb(input), '3D relief mesh');
  glb('model-4d.glb', X.build4dGlb(input), '3D + time: animated morph targets');
  glb('model-6d.glb', X.build6dGlb(input), 'layers as separate nodes with six-axis animation');
  add('points-6d.ply', new Blob([X.writePly(X.pointCloud(a.rgba, a.depth, a.dw, a.dh, geo))], { type: 'application/octet-stream' }), 'point cloud: x y z r g b');
  if (o.anatomy === 'on' || (o.anatomy === 'auto' && a.person.isPerson)) glb('anatomy.glb', X.buildAnatomyGlb(anatomyParts(a), 'anatomy'), 'illustrative skeleton, organs and vessels, aligned with model-3d.glb');

  const manifest = X.buildManifest({ sourceName: item.name, width: a.w, height: a.h, dw: a.dw, dh: a.dh, strength: o.strength, layers: o.layers, depthSource: a.depthSource, inverted: o.invert, person: a.person, files: files.map((f) => ({ path: f.path, bytes: f.blob.size, what: f.what })) });
  add('scene.json', new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }), 'this description');
  return files;
}

async function extract(item) {
  item.status = 'working'; item.error = '';
  renderQueue();
  try {
    const a = await analyze(item);
    const files = await buildFiles(item, a);
    const begun = await api('POST', '/api/begin', { name: X.sanitizeName(item.name) });
    for (const f of files) await api('PUT', `/api/file?dir=${encodeURIComponent(begun.dir)}&path=${encodeURIComponent(f.path)}`, f.blob);
    Object.assign(item, { status: 'done', dir: begun.dir, savedPath: begun.path, count: files.length });
  } catch (e) {
    Object.assign(item, { status: 'error', error: String((e && e.message) || e) });
  }
  renderQueue();
  return item.status === 'done';
}
async function run(items) {
  if (state.busy || !items.length) return;
  state.busy = true;
  syncButtons();
  let ok = 0, bad = 0, last = null;
  for (const item of items) { if (await extract(item)) { ok++; last = item; } else bad++; }
  state.busy = false;
  syncButtons();
  if (items.length === 1) toast(ok ? tr('msg.saved', { count: last.count, dir: last.savedPath }) : items[0].error, !ok, 7000);
  else toast(tr('msg.allDone', { ok, bad }), bad > 0, 7000);
}

// ---------- queue ----------
function addSources(sources) {
  const images = sources.filter((s) => s.source instanceof HTMLCanvasElement || /^image\//.test(s.source.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(s.name));
  if (images.length < sources.length) toast(tr('msg.notImage', { count: sources.length - images.length }), true);
  for (const s of images) state.items.push({ id: nextId++, name: s.name, source: s.source, status: 'queued' });
  if (!selectedItem() && state.items.length) select(state.items[0].id);
  renderQueue();
}
function renderQueue() {
  const ul = $('queue');
  ul.textContent = '';
  for (const item of state.items) {
    const li = document.createElement('li');
    li.dataset.id = item.id;
    li.classList.toggle('sel', item.id === state.selected);
    const name = document.createElement('span');
    name.className = 'name'; name.textContent = item.name; name.title = item.error || item.savedPath || item.name;
    const st = document.createElement('span');
    st.className = 'st ' + item.status; st.textContent = tr('status.' + item.status);
    li.append(name, st);
    li.addEventListener('click', () => select(item.id));
    ul.appendChild(li);
  }
  $('queue-empty').hidden = state.items.length > 0;
  syncButtons();
}
function syncButtons() {
  const item = selectedItem();
  $('run-one').disabled = state.busy || !item;
  $('run-all').disabled = state.busy || !state.items.length;
  $('clear').disabled = state.busy || !state.items.length;
  $('depth-load').disabled = state.busy || !item;
  $('depth-clear').hidden = !(item && item.customDepth);
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
}

// ---------- preview ----------
let renderer = null, scene = null, camera = null, subject = null, relief = null, plane = { w: 2, h: 2 }, glFailed = false, raf = 0;
const clock = new THREE.Clock();
function initThree() {
  if (renderer || glFailed) return !!renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true }); } catch (_) { glFailed = true; toast(tr('msg.noWebGL'), true, 8000); return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x05080d, 1);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 80);
  subject = new THREE.Group();
  scene.add(subject);
  return true;
}
function layout() {
  if (!renderer) return;
  const el = $('view'), w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const tan = Math.tan((FOV * Math.PI) / 360);
  camera.position.set(0, 0, Math.max(plane.h / 2 / tan, plane.w / 2 / (tan * camera.aspect)) * 1.35);
  camera.updateProjectionMatrix();
}
function showMaps(a) {
  const strip = $('maps');
  strip.textContent = '';
  const put = (canvas, label) => { const f = document.createElement('figure'), c = document.createElement('figcaption'); c.textContent = label; f.append(canvas, c); strip.appendChild(f); };
  const geo = Object.assign(X.planeSize(a.w, a.h, 1), {});
  put(rgbaCanvas(X.depthToRgba(a.depth), a.dw, a.dh), tr('maps.depth'));
  put(rgbaCanvas(X.normalMapRgba(a.depth, a.dw, a.dh, { planeW: geo.w, planeH: geo.h, strength: state.opts.strength }), a.dw, a.dh), tr('maps.normal'));
  const depthRgba = X.depthToRgba(a.depth);
  for (let i = 0; i < state.opts.layers; i++) {
    const layer = X.layerRgba(a.rgba, depthRgba, a.dw, a.dh, state.opts.layers, i);
    if (layer.pixels) put(rgbaCanvas(layer.rgba, a.dw, a.dh), tr('maps.layer', { n: i + 1 }));
  }
}
let previewSeq = 0;
async function refreshPreview() {
  const item = selectedItem(), seq = ++previewSeq;
  $('empty').hidden = !!item;
  if (!item) { if (relief) { subject.remove(relief); disposeTree(relief); relief = null; } $('maps').textContent = ''; $('person').textContent = ''; return; }
  let a;
  try { a = await analyze(item); } catch (e) {
    if (seq !== previewSeq) return;
    Object.assign(item, { status: 'error', error: String(e.message || e) });
    renderQueue(); toast(item.error, true);
    return;
  }
  if (seq !== previewSeq) return; // a newer selection won the race
  $('person').textContent = a.person.isPerson ? tr('person.yes', { score: Math.round(a.person.score * 100) }) : tr('person.no');
  showMaps(a);
  if (!initThree()) return;
  if (relief) { subject.remove(relief); disposeTree(relief); }
  plane = X.planeSize(a.w, a.h, 2);
  const tex = new THREE.CanvasTexture(a.tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  relief = buildRelief(THREE, { depth: a.depth, dw: a.dw, dh: a.dh, planeW: plane.w, planeH: plane.h, texture: tex });
  subject.add(relief);
  layout();
  if (!raf) { clock.start(); raf = requestAnimationFrame(frame); }
}
let lastReadout = '';
function frame() {
  raf = requestAnimationFrame(frame);
  if (!relief) { renderer.render(scene, camera); return; }
  const time = clock.getElapsedTime(), o = state.opts;
  const S = o.strength * 2; // the preview plane is 2 units long, exported models are 1
  let pose = state.pose, text = '';
  setReliefStyle(relief, state.view === 'points' ? 'holo' : 'photo');
  if (state.view === '4d') {
    const s = X.state4d(time);
    updateRelief(relief, { strength: S * (1 - s.flatten), explode: s.teardown * 0.7, layers: o.layers });
    text = `4D  t=${(time % X.TIMELINE_4D.duration).toFixed(1)}s\nflatten ${s.flatten.toFixed(2)}  teardown ${s.teardown.toFixed(2)}`;
  } else if (state.view === '6d') {
    const s = X.state6d(time);
    updateRelief(relief, { strength: S, explode: s.spread * 0.7, layers: o.layers });
    pose = clampPose({ yaw: pose.yaw + s.pose.yaw, pitch: pose.pitch + s.pose.pitch, roll: pose.roll + s.pose.roll, x: pose.x + s.pose.x * 2, y: pose.y + s.pose.y * 2, z: pose.z + s.pose.z * 2 });
    const f = (v, d) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d);
    text = `6D  t=${(time % X.TIMELINE_6D.duration).toFixed(1)}s  spread ${s.spread.toFixed(2)}\nJ1 ${f(s.pose.yaw, 0)}°  J2 ${f(s.pose.pitch, 0)}°  J3 ${f(s.pose.roll, 0)}°\nJ4 ${f(s.pose.x, 2)}  J5 ${f(s.pose.y, 2)}  J6 ${f(s.pose.z, 2)}`;
  } else {
    if (relief.userData.strength !== S || relief.userData.explode !== 0 || relief.userData.layers !== o.layers) updateRelief(relief, { strength: S, explode: 0, layers: o.layers });
    text = state.view === 'points' ? `6D POINTS  ${relief.userData.depth.length.toLocaleString('en-US')} × (x y z r g b)` : '3D';
  }
  const tf = poseToTransform(pose);
  subject.rotation.order = tf.order;
  subject.rotation.set(tf.rotation[0], tf.rotation[1], tf.rotation[2]);
  subject.position.set(tf.position[0], tf.position[1], tf.position[2]);
  renderer.render(scene, camera);
  if (text !== lastReadout) { $('readout').textContent = text; lastReadout = text; }
}
function select(id) {
  state.selected = id;
  state.pose = defaultPose();
  renderQueue();
  refreshPreview();
}
function bindView() {
  const el = $('view');
  let drag = null;
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / el.clientWidth, dy = (e.clientY - drag.y) / el.clientHeight;
    state.pose = e.shiftKey ? clampPose(Object.assign({}, state.pose, { x: state.pose.x + dx * 3, y: state.pose.y - dy * 3 })) : applyDrag(state.pose, dx, dy);
    drag = { x: e.clientX, y: e.clientY };
  });
  const end = () => { drag = null; el.style.cursor = 'grab'; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => { e.preventDefault(); state.pose = clampPose(Object.assign({}, state.pose, { z: state.pose.z - Math.sign(e.deltaY) * 0.15 })); }, { passive: false });
}

// ---------- controls ----------
function optionsChanged(reanalyse) {
  if (reanalyse) for (const item of state.items) item.key = null;
  refreshPreview();
}
function bindControls() {
  const range = (id, key, digits) => {
    const input = $(id), out = input.parentElement.querySelector('output');
    const show = () => { out.textContent = Number(input.value).toFixed(digits); };
    input.addEventListener('input', () => { state.opts[key] = Number(input.value); show(); optionsChanged(false); });
    show();
  };
  range('strength', 'strength', 2);
  range('layers', 'layers', 0);
  $('detail').addEventListener('change', (e) => { state.opts.detail = Number(e.target.value); optionsChanged(true); });
  $('invert').addEventListener('change', (e) => { state.opts.invert = e.target.checked; optionsChanged(true); });
  $('anatomy').addEventListener('change', (e) => { state.opts.anatomy = e.target.value; });
  for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => { state.view = b.dataset.view; syncButtons(); });
  $('reset').addEventListener('click', () => { state.pose = defaultPose(); });

  const drop = $('drop'), files = $('files');
  const take = (list) => addSources([...list].map((f) => ({ name: f.name, source: f })));
  drop.addEventListener('click', () => files.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); files.click(); } });
  files.addEventListener('change', () => { take(files.files); files.value = ''; });
  window.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) drop.classList.remove('over'); });
  window.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files.length) take(e.dataTransfer.files); });
  $('sample').addEventListener('click', () => addSources([
    { name: state.lang === 'en' ? 'sample-landscape.png' : 'mẫu-phong-cảnh.png', source: paintScene(document.createElement('canvas')) },
    { name: state.lang === 'en' ? 'sample-person.png' : 'mẫu-người.png', source: paintPerson(document.createElement('canvas')) },
  ]));
  $('clear').addEventListener('click', () => { state.items = []; state.selected = null; renderQueue(); refreshPreview(); });

  $('depth-load').addEventListener('click', () => $('depth-file').click());
  $('depth-file').addEventListener('change', async (e) => {
    const item = selectedItem(), file = e.target.files[0];
    e.target.value = '';
    if (!item || !file) return;
    try {
      const img = await decode(file);
      item.customDepth = scaled(img, Math.min(img.width, 1024), Math.max(1, Math.round((Math.min(img.width, 1024) / img.width) * img.height)));
      if (img.close) img.close();
      item.depthVersion = (item.depthVersion || 0) + 1;
      toast(tr('msg.depthLoaded'));
      syncButtons(); refreshPreview();
    } catch (err) { toast(String(err.message || err), true); }
  });
  $('depth-clear').addEventListener('click', () => { const item = selectedItem(); if (!item) return; item.customDepth = null; item.depthVersion = (item.depthVersion || 0) + 1; syncButtons(); refreshPreview(); });

  $('run-one').addEventListener('click', () => { const item = selectedItem(); if (item) run([item]); });
  $('run-all').addEventListener('click', () => run(state.items.slice()));
  $('open').addEventListener('click', () => { const item = selectedItem(); api('POST', '/api/open', { dir: item && item.dir }).catch((e) => toast(e.message, true)); });
}

// ---------- language ----------
function applyLang() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.dataset.i18n);
  for (const b of document.querySelectorAll('[data-lang-toggle]')) { b.textContent = tr('lang.switch'); b.setAttribute('aria-label', tr('lang.switchLabel')); }
  renderQueue();
  const item = selectedItem();
  if (item && item.analysis) { const a = item.analysis; $('person').textContent = a.person.isPerson ? tr('person.yes', { score: Math.round(a.person.score * 100) }) : tr('person.no'); showMaps(a); }
}

// ---------- boot ----------
let stored = null;
try { stored = localStorage.getItem('v6d.lang'); } catch (_) { /* storage unavailable */ }
state.lang = pickLang(stored, navigator.language);
bindControls();
bindView();
applyLang();
$('lang').addEventListener('click', () => {
  state.lang = otherLang(state.lang);
  try { localStorage.setItem('v6d.lang', state.lang); } catch (_) { /* keep it for this session only */ }
  applyLang();
});
window.addEventListener('resize', layout);
window.addEventListener('pagehide', () => { if (navigator.sendBeacon) navigator.sendBeacon('/api/bye?t=' + encodeURIComponent(TOKEN)); });
api('GET', '/api/info').then((info) => { state.outDir = info.outDir; $('outdir').textContent = info.outDir; }).catch((e) => { $('outdir').textContent = '—'; toast(e.message, true, 10000); });

// Read-only snapshot for the end-to-end test.
window.__v6dDesktop = {
  snapshot: () => ({
    lang: state.lang, view: state.view, busy: state.busy, outDir: state.outDir, selected: state.selected, three: THREE.REVISION,
    preview: !!relief, rendering: !!raf, maps: $('maps').children.length,
    items: state.items.map((i) => ({ name: i.name, status: i.status, dir: i.dir || null, count: i.count || 0, error: i.error || '', person: i.analysis ? i.analysis.person.isPerson : null })),
  }),
};
