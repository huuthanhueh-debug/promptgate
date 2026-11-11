// Vision 6D mobile: camera/gallery -> three.js viewer. UI glue only; the image analysis, pose
// math, anatomy data and scene builders live in ../core and are tested under Node.
import * as THREE from '../core/vendor/three.module.min.js';
import { estimateDepth, detectPerson } from '../core/depth.js';
import { AXES, defaultPose, setAxis, applyDrag, applyPinch, orbitPose, poseFromOrientation, poseToTransform } from '../core/sixdof.js';
import { LABELS, SYSTEMS, fitToBBox, explodeOffset, labelForPart } from '../core/anatomy.js';
import { pickLang, otherLang } from '../core/i18n.js';
import { t } from './strings.js';
import { paintScene, paintPerson } from '../core/demo.js';
import { buildRelief, updateRelief, setReliefStyle, buildAnatomy, setExplode, setSystemVisible, highlightPart, animateAnatomy, buildDNA, disposeTree } from '../core/scene.js';

const $ = (id) => document.getElementById(id);
const MAX_TEXTURE = 1536; // longest side of the photo texture, keeps memory sane on phones
const DEPTH_GRID = 160; // longest side of the depth / detection grid
const FOV = 40;

const state = {
  screen: 'home',
  mode: 'relief',
  pose: defaultPose(),
  orbit: false,
  gyro: null, // { beta0, gamma0, beta, gamma } while the gyroscope drives the view
  style: 'photo',
  strength: 0.5,
  explode: 0,
  systems: { skeleton: true, organs: true, vessels: true, photo: true },
  fit: { scale: 1, x: 0, y: 0 },
  selected: null,
  person: null,
  facing: 'environment',
  lang: 'vi',
};
const tr = (key, vars) => t(state.lang, key, vars);

// ---------- small UI helpers ----------
let toastTimer = 0;
function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2600);
}
let noticeKey = '';
function notice(key) {
  noticeKey = key || '';
  const n = $('notice');
  n.textContent = key ? tr(key) : '';
  n.style.display = key ? 'block' : 'none';
}
function showScreen(name) {
  state.screen = name;
  $('home').classList.toggle('active', name === 'home');
  $('viewer').classList.toggle('active', name === 'viewer');
}

// ---------- camera ----------
let stream = null;
function stopCamera() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
  $('preview').srcObject = null;
  $('shutter').disabled = true;
}
async function startCamera() {
  stopCamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    notice('notice.noCamera');
    return;
  }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: state.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    if (state.screen !== 'home' || document.hidden) { for (const t of s.getTracks()) t.stop(); return; }
    stream = s;
    const v = $('preview');
    v.srcObject = s;
    v.style.transform = state.facing === 'user' ? 'scaleX(-1)' : '';
    await v.play().catch(() => {});
    $('shutter').disabled = false;
    notice('');
  } catch (e) {
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    notice(denied ? 'notice.denied' : 'notice.failed');
  }
}
function capture() {
  const v = $('preview');
  if (!v.videoWidth) { toast(tr('toast.cameraNotReady')); return; }
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  loadSource(c, c.width, c.height);
}
async function pickFile(file) {
  if (!file) return;
  try {
    let img;
    if (window.createImageBitmap) img = await createImageBitmap(file);
    else {
      img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
    }
    loadSource(img, img.width, img.height);
    if (img.close) img.close();
  } catch (_) {
    toast(tr('toast.badFile'));
  }
}

// ---------- three.js ----------
let renderer = null, scene = null, camera = null, subject = null;
let relief = null, body = null, backdrop = null, holder = null, anatomy = null, dna = null;
let plane = { w: 1.5, h: 2 }, baseFit = null, raf = 0, glError = false;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

function initThree() {
  if (renderer || glError) return !glError;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('stage'), antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  } catch (_) {
    glError = true;
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x05080d, 1);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xcfefff, 0x0a1a2a, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 2, 3);
  scene.add(key);
  subject = new THREE.Group();
  scene.add(subject);
  return true;
}

function layout() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const sheetH = $('sheet').offsetHeight || 0, topH = 52;
  $('viewer').style.setProperty('--sheet-h', sheetH + 'px');
  const availH = Math.max(120, h - sheetH - topH);
  camera.aspect = w / h;
  const t = Math.tan((FOV * Math.PI) / 360);
  const distH = plane.h / 2 / (t * (availH / h));
  const distW = plane.w / 2 / (t * camera.aspect);
  const dist = Math.max(distH, distW) * 1.1;
  // Shift the camera down so the subject sits in the area above the bottom sheet.
  const unitsPerPx = (2 * dist * t) / h;
  camera.position.set(0, -((sheetH - topH) / 2) * unitsPerPx, dist);
  camera.updateProjectionMatrix();
  labelWidths = null;
}

function buildSubject(texCanvas, depth, dw, dh, person) {
  if (relief) { disposeTree(relief); subject.remove(relief); }
  if (body) { disposeTree(body); subject.remove(body); }
  const aspect = texCanvas.width / texCanvas.height;
  plane = aspect >= 1 ? { w: 2, h: 2 / aspect } : { w: 2 * aspect, h: 2 };

  const tex = new THREE.CanvasTexture(texCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  relief = buildRelief(THREE, { depth, dw, dh, planeW: plane.w, planeH: plane.h, texture: tex });
  subject.add(relief);

  body = new THREE.Group();
  backdrop = new THREE.Mesh(new THREE.PlaneGeometry(plane.w, plane.h), new THREE.MeshBasicMaterial({ map: tex, color: 0x76879a, side: THREE.DoubleSide }));
  holder = new THREE.Group();
  anatomy = buildAnatomy(THREE);
  holder.add(anatomy);
  dna = buildDNA(THREE);
  dna.scale.setScalar(plane.h * 0.5);
  dna.position.set(plane.w / 2 - 0.12, plane.h * 0.08, 0.16);
  body.add(backdrop, holder, dna);
  subject.add(body);

  state.person = person;
  baseFit = fitToBBox(person.isPerson ? person.bbox : null, plane.w, plane.h);
  state.fit = { scale: 1, x: 0, y: 0 };
  state.selected = null;
  applyAll();
}

function applyFit() {
  holder.scale.setScalar(baseFit.scale * state.fit.scale);
  holder.position.set(baseFit.x + state.fit.x * plane.w, baseFit.y + state.fit.y * plane.h, 0.05);
}

function applyAll() {
  relief.visible = state.mode === 'relief';
  body.visible = state.mode === 'body';
  updateRelief(relief, { strength: state.strength, explode: state.explode });
  setReliefStyle(relief, state.style);
  setExplode(anatomy, state.explode);
  for (const s of SYSTEMS) setSystemVisible(anatomy, s.id, state.systems[s.id]);
  backdrop.visible = state.systems.photo;
  backdrop.position.z = -0.35 * state.explode;
  applyFit();
  const sel = state.selected && state.systems[state.selected.system] ? state.selected : null;
  highlightPart(anatomy, sel ? sel.part : null);
  syncUI();
}

function currentPose(time) {
  let p = state.pose;
  if (state.orbit) p = orbitPose(time, p);
  if (state.gyro) p = poseFromOrientation(p, state.gyro.beta, state.gyro.gamma, state.gyro.beta0, state.gyro.gamma0);
  return p;
}

let lastReadout = '';
function frame() {
  raf = requestAnimationFrame(frame);
  const time = clock.getElapsedTime();
  const pose = currentPose(time);
  const tf = poseToTransform(pose);
  subject.rotation.order = tf.order;
  subject.rotation.set(tf.rotation[0], tf.rotation[1], tf.rotation[2]);
  subject.position.set(tf.position[0], tf.position[1], tf.position[2]);
  if (state.mode === 'body') {
    animateAnatomy(anatomy, time);
    dna.rotation.y = time * 0.9;
  }
  renderer.render(scene, camera);
  layoutLabels(pose);
  const f = (v, d) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d).padStart(d ? 4 : 3, '0');
  const text = `${state.mode === 'body' ? 'BODY SCAN' : '6D RELIEF'} · ${state.mode === 'body' ? 'FIT ' + Math.round((state.person ? state.person.score : 0) * 100) + '%' : 'DEPTH ' + state.strength.toFixed(2)}\n`
    + `J1 ${f(pose.yaw, 0)}°  J2 ${f(pose.pitch, 0)}°  J3 ${f(pose.roll, 0)}°\n`
    + `J4 ${f(pose.x, 2)}  J5 ${f(pose.y, 2)}  J6 ${f(pose.z, 2)}`;
  if (text !== lastReadout) { $('readout').textContent = text; lastReadout = text; }
}
function startLoop() { if (!raf && renderer) { clock.start(); raf = requestAnimationFrame(frame); } }
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

// ---------- HUD labels ----------
const labelEls = new Map();
let labelWidths = null;
const SVG_NS = 'http://www.w3.org/2000/svg';
function buildLabels() {
  const hud = $('hud'), svg = $('lines');
  for (const l of LABELS) {
    const b = document.createElement('button');
    b.className = 'label';
    b.dataset.label = l.id;
    b.addEventListener('click', () => select(state.selected && state.selected.id === l.id ? null : l));
    hud.appendChild(b);
    const line = document.createElementNS(SVG_NS, 'line');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '2.5');
    svg.append(line, dot);
    labelEls.set(l.id, { b, line, dot });
  }
}
const tmp = new THREE.Vector3();
function layoutLabels(pose) {
  const show = state.mode === 'body';
  const w = window.innerWidth, h = window.innerHeight;
  if (!labelWidths && show) {
    labelWidths = {};
    for (const [id, e] of labelEls) { e.b.style.display = ''; labelWidths[id] = e.b.offsetWidth; }
  }
  const flipped = Math.cos((pose.yaw * Math.PI) / 180) < 0;
  const sides = { left: [], right: [] };
  for (const l of LABELS) {
    const e = labelEls.get(l.id);
    let visible = show && state.systems[l.system];
    if (visible) {
      tmp.set(l.at[0], l.at[1], l.at[2] + explodeOffset(l.system, state.explode));
      anatomy.localToWorld(tmp).project(camera);
      visible = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
    }
    const d = visible ? '' : 'none';
    if (e.b.style.display !== d) { e.b.style.display = d; e.line.style.display = d; e.dot.style.display = d; }
    if (!visible) continue;
    const side = (l.side === 'left') !== flipped ? 'left' : 'right';
    sides[side].push({ l, e, ax: (tmp.x + 1) / 2 * w, ay: (1 - tmp.y) / 2 * h });
  }
  const minY = 104, maxY = h - ($('sheet').offsetHeight || 0) - 30, gap = 27;
  for (const side of ['left', 'right']) {
    const list = sides[side].sort((a, b) => a.ay - b.ay);
    let y = minY;
    for (const it of list) { it.y = Math.max(y, it.ay - 12); y = it.y + gap; }
    let cap = maxY;
    for (let i = list.length - 1; i >= 0; i--) { if (list[i].y > cap) list[i].y = cap; cap = list[i].y - gap; }
    for (const it of list) {
      const lw = labelWidths[it.l.id] || 80;
      const x = side === 'left' ? 6 : w - 6 - lw;
      it.e.b.style.transform = `translate(${x}px, ${it.y}px)`;
      it.e.line.setAttribute('x1', side === 'left' ? x + lw : x);
      it.e.line.setAttribute('y1', it.y + 12);
      it.e.line.setAttribute('x2', it.ax);
      it.e.line.setAttribute('y2', it.ay);
      it.e.dot.setAttribute('cx', it.ax);
      it.e.dot.setAttribute('cy', it.ay);
    }
  }
}
function select(label) {
  state.selected = label;
  highlightPart(anatomy, label ? label.part : null);
  for (const [id, e] of labelEls) e.b.classList.toggle('sel', !!label && id === label.id);
  const info = $('info');
  info.style.display = label ? 'block' : 'none';
  if (label) {
    const en = state.lang === 'en';
    info.querySelector('b').textContent = en ? label.en : label.vi;
    info.querySelector('i').textContent = en ? label.vi : label.en;
    info.querySelector('p').textContent = en ? label.infoEn : label.info;
  }
}
function tapAt(x, y) {
  if (state.mode !== 'body') return;
  const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, 1 - (y / window.innerHeight) * 2);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(anatomy, true).find((i) => i.object.parent.visible);
  select(hit ? labelForPart(hit.object.userData.part) : null);
}

// ---------- gestures: 1 finger orbits, 2 fingers pinch / twist / pan ----------
const pointers = new Map();
let gesture = null, tapStart = null;
function twoFinger() {
  const [a, b] = [...pointers.values()];
  return { dist: Math.hypot(b.x - a.x, b.y - a.y) || 1, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
}
function bindGestures() {
  const el = $('stage');
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tapStart = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    gesture = pointers.size === 2 ? twoFinger() : null;
  });
  el.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const w = window.innerWidth, h = window.innerHeight;
    if (pointers.size === 1) {
      state.pose = applyDrag(state.pose, (e.clientX - p.x) / w, (e.clientY - p.y) / h);
      p.x = e.clientX; p.y = e.clientY;
    } else if (pointers.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const g = twoFinger();
      if (gesture) {
        let da = g.angle - gesture.angle;
        if (da > 180) da -= 360; else if (da < -180) da += 360;
        state.pose = applyPinch(state.pose, g.dist / gesture.dist, da, (g.cx - gesture.cx) / w, (g.cy - gesture.cy) / h);
      }
      gesture = g;
    }
    syncAxes();
  });
  const up = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    gesture = null;
    if (tapStart && e.type === 'pointerup' && performance.now() - tapStart.t < 350 && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 8) tapAt(e.clientX, e.clientY);
    tapStart = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

// ---------- controls ----------
function bindRange(id, get, set) {
  const input = $(id), out = input.parentElement.querySelector('output');
  const show = () => { out.textContent = Number(input.value).toFixed(2); };
  input.addEventListener('input', () => { set(Number(input.value)); show(); });
  return () => { input.value = get(); show(); };
}
const syncers = [];
const axisInputs = {};
function buildControls() {
  syncers.push(
    bindRange('strength', () => state.strength, (v) => { state.strength = v; updateRelief(relief, { strength: v }); }),
    bindRange('explode', () => state.explode, (v) => { state.explode = v; applyAll(); }),
    bindRange('fit-scale', () => state.fit.scale, (v) => { state.fit.scale = v; applyFit(); }),
    bindRange('fit-x', () => state.fit.x, (v) => { state.fit.x = v; applyFit(); }),
    bindRange('fit-y', () => state.fit.y, (v) => { state.fit.y = v; applyFit(); }),
  );
  const axes = $('axes');
  for (const a of AXES) {
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('label');
    label.htmlFor = 'axis-' + a.id;
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', id: 'axis-' + a.id, min: a.min, max: a.max, step: a.step });
    const out = document.createElement('output');
    input.addEventListener('input', () => { state.pose = setAxis(state.pose, a.id, Number(input.value)); syncAxes(); });
    row.append(label, input, out);
    axes.appendChild(row);
    axisInputs[a.key] = { input, out, a, label };
  }
  for (const b of document.querySelectorAll('.tabs button')) {
    b.addEventListener('click', () => {
      for (const o of document.querySelectorAll('.tabs button')) o.classList.toggle('on', o === b);
      for (const p of document.querySelectorAll('.pane')) p.classList.toggle('active', p.dataset.pane === b.dataset.tab);
      layout();
    });
  }
  for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
  for (const b of document.querySelectorAll('[data-style]')) b.addEventListener('click', () => { state.style = b.dataset.style; applyAll(); });
  for (const b of document.querySelectorAll('[data-system]')) {
    b.addEventListener('click', () => {
      state.systems[b.dataset.system] = !state.systems[b.dataset.system];
      if (state.selected && !state.systems[state.selected.system]) select(null);
      applyAll();
    });
  }
  $('orbit').addEventListener('click', () => { state.orbit = !state.orbit; syncUI(); });
  $('gyro').addEventListener('click', toggleGyro);
  $('reset').addEventListener('click', () => {
    Object.assign(state, { pose: defaultPose(), orbit: false, strength: 0.5, explode: 0, fit: { scale: 1, x: 0, y: 0 } });
    setGyro(false);
    select(null);
    applyAll();
  });
  $('save').addEventListener('click', saveImage);
  $('back').addEventListener('click', goHome);
}
function syncAxes() {
  for (const key in axisInputs) {
    const { input, out, a } = axisInputs[key];
    input.value = state.pose[key];
    out.textContent = a.unit ? Math.round(state.pose[key]) + a.unit : state.pose[key].toFixed(2);
  }
}
function syncUI() {
  for (const s of syncers) s();
  syncAxes();
  const bodyMode = state.mode === 'body';
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  for (const b of document.querySelectorAll('[data-style]')) b.setAttribute('aria-pressed', String(b.dataset.style === state.style));
  for (const b of document.querySelectorAll('[data-system]')) b.setAttribute('aria-pressed', String(!!state.systems[b.dataset.system]));
  $('orbit').setAttribute('aria-pressed', String(state.orbit));
  $('gyro').setAttribute('aria-pressed', String(!!state.gyro));
  $('relief-opts').hidden = bodyMode;
  $('body-opts').hidden = !bodyMode;
  $('disclaimer').hidden = !bodyMode;
  $('tab-align').hidden = !bodyMode;
  if (!bodyMode && document.querySelector('.tabs .on') === $('tab-align')) document.querySelector('[data-tab="view"]').click();
}
function setMode(mode) {
  state.mode = mode === 'body' ? 'body' : 'relief';
  if (state.mode !== 'body') select(null);
  applyAll();
  layout();
}

// ---------- language ----------
function applyLang() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', tr(el.dataset.i18nAria));
  for (const b of document.querySelectorAll('[data-lang-toggle]')) { b.textContent = tr('lang.switch'); b.setAttribute('aria-label', tr('lang.switchLabel')); }
  for (const l of LABELS) labelEls.get(l.id).b.textContent = state.lang === 'en' ? l.en : l.vi;
  for (const key in axisInputs) { const { a, label } = axisInputs[key]; label.textContent = `${a.id} · ${state.lang === 'en' ? a.en : a.vi}`; }
  labelWidths = null; // label text changed, so their widths did too
  if (noticeKey) notice(noticeKey);
  if (state.selected) select(state.selected);
  if (renderer) layout();
}
function setLang(lang) {
  state.lang = pickLang(lang, null);
  try { localStorage.setItem('v6d.lang', state.lang); } catch (_) { /* private mode: keep it for this session only */ }
  applyLang();
}

// ---------- gyroscope ----------
function onOrientation(e) {
  if (!state.gyro || e.beta == null || e.gamma == null) return;
  if (state.gyro.beta0 == null) { state.gyro.beta0 = e.beta; state.gyro.gamma0 = e.gamma; }
  state.gyro.beta = e.beta; state.gyro.gamma = e.gamma;
}
function setGyro(on) {
  window.removeEventListener('deviceorientation', onOrientation);
  state.gyro = on ? { beta0: null, gamma0: null, beta: NaN, gamma: NaN } : null;
  if (on) window.addEventListener('deviceorientation', onOrientation);
  syncUI();
}
function toggleGyro() {
  if (state.gyro) return setGyro(false);
  if (!('DeviceOrientationEvent' in window)) return toast(tr('toast.noGyro'));
  setGyro(true);
  setTimeout(() => { if (state.gyro && !Number.isFinite(state.gyro.beta)) { setGyro(false); toast(tr('toast.gyroSilent')); } }, 1500);
}

// ---------- save ----------
function saveImage() {
  renderer.render(scene, camera);
  const url = $('stage').toDataURL('image/png');
  try {
    if (window.AndroidBridge && window.AndroidBridge.saveImage) {
      // The shell answers "ok:<folder>" or "error".
      const res = String(window.AndroidBridge.saveImage(url.slice(url.indexOf(',') + 1)));
      toast(res.startsWith('ok:') ? tr('toast.savedTo', { where: res.slice(3) }) : tr('toast.saveFailed'));
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `vision6d-${Date.now()}.png`;
    a.click();
    toast(tr('toast.saved'));
  } catch (_) {
    toast(tr('toast.saveFailed'));
  }
}

// ---------- pipeline ----------
function loadSource(src, sw, sh, forceMode) {
  if (!sw || !sh) { toast(tr('toast.badImage')); return; }
  if (!initThree()) { toast(tr('toast.noWebGL'), 5000); return; }
  const k = Math.min(1, MAX_TEXTURE / Math.max(sw, sh));
  const tex = document.createElement('canvas');
  tex.width = Math.max(2, Math.round(sw * k)); tex.height = Math.max(2, Math.round(sh * k));
  tex.getContext('2d').drawImage(src, 0, 0, tex.width, tex.height);
  const g = DEPTH_GRID / Math.max(sw, sh);
  const dw = Math.max(2, Math.round(sw * g)), dh = Math.max(2, Math.round(sh * g));
  const small = document.createElement('canvas');
  small.width = dw; small.height = dh;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(tex, 0, 0, dw, dh);
  const rgba = sctx.getImageData(0, 0, dw, dh).data;
  const person = detectPerson(rgba, dw, dh);
  const depth = estimateDepth(rgba, dw, dh);

  stopCamera();
  showScreen('viewer');
  Object.assign(state, { pose: defaultPose(), orbit: false, explode: 0, strength: 0.5, style: 'photo', systems: { skeleton: true, organs: true, vessels: true, photo: true } });
  setGyro(false);
  state.mode = forceMode || (person.isPerson ? 'body' : 'relief');
  buildSubject(tex, depth, dw, dh, person);
  select(null);
  document.querySelector('[data-tab="view"]').click(); // also re-runs layout()
  startLoop();
  if (!forceMode) toast(tr(person.isPerson ? 'toast.person' : 'toast.noPerson'));
}
function goHome() {
  if (state.screen !== 'viewer') return false;
  stopLoop();
  setGyro(false);
  showScreen('home');
  startCamera();
  return true;
}

// ---------- boot ----------
buildLabels();
buildControls();
bindGestures();
let storedLang = null;
try { storedLang = localStorage.getItem('v6d.lang'); } catch (_) { /* storage unavailable */ }
state.lang = pickLang(storedLang, navigator.language);
applyLang();
for (const b of document.querySelectorAll('[data-lang-toggle]')) b.addEventListener('click', () => setLang(otherLang(state.lang)));
$('shutter').addEventListener('click', capture);
$('flip').addEventListener('click', () => { state.facing = state.facing === 'user' ? 'environment' : 'user'; startCamera(); });
$('pick').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', (e) => { pickFile(e.target.files[0]); e.target.value = ''; });
$('demo-scene').addEventListener('click', () => { const c = paintScene(document.createElement('canvas')); loadSource(c, c.width, c.height, 'relief'); });
$('demo-person').addEventListener('click', () => { const c = paintPerson(document.createElement('canvas')); loadSource(c, c.width, c.height); });
window.addEventListener('resize', layout);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopCamera(); stopLoop(); }
  else if (state.screen === 'home') startCamera();
  else startLoop();
});
// The Android shell calls this on the system Back button; false means "let the app close".
window.__v6dBack = goHome;
// Read-only snapshot for the end-to-end test.
window.__v6d = {
  snapshot: () => ({
    screen: state.screen, lang: state.lang, mode: state.mode, pose: { ...state.pose }, explode: state.explode, style: state.style,
    person: state.person && { isPerson: state.person.isPerson, score: state.person.score },
    selected: state.selected && state.selected.id,
    three: THREE.REVISION, rendering: !!raf,
    meshes: anatomy ? anatomy.getObjectsByProperty('isMesh', true).length : 0,
    reliefVertices: relief ? relief.userData.depth.length : 0,
    labelsShown: [...labelEls.values()].filter((e) => e.b.style.display !== 'none').length,
  }),
};
startCamera();
