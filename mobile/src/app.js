// Vision 6D: camera/gallery -> three.js viewer. UI glue only; the image analysis, pose math,
// anatomy data and scene builders live in ./lib and are tested under Node.
import * as THREE from './vendor/three.module.min.js';
import { estimateDepth, detectPerson } from './lib/depth.js';
import { AXES, defaultPose, setAxis, applyDrag, applyPinch, orbitPose, poseFromOrientation, poseToTransform } from './lib/sixdof.js';
import { LABELS, SYSTEMS, fitToBBox, explodeOffset, labelForPart } from './lib/anatomy.js';
import { buildRelief, updateRelief, setReliefStyle, buildAnatomy, setExplode, setSystemVisible, highlightPart, animateAnatomy, buildDNA, disposeTree } from './lib/scene.js';

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
};

// ---------- small UI helpers ----------
let toastTimer = 0;
function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2600);
}
function notice(msg) {
  const n = $('notice');
  n.textContent = msg || '';
  n.style.display = msg ? 'block' : 'none';
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
    notice('Thiết bị không hỗ trợ camera trong ứng dụng. Hãy chọn ảnh từ Thư viện hoặc dùng ảnh mẫu.');
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
    notice(denied
      ? 'Chưa có quyền dùng camera. Hãy cấp quyền trong Cài đặt, hoặc chọn ảnh từ Thư viện / ảnh mẫu.'
      : 'Không mở được camera. Hãy chọn ảnh từ Thư viện hoặc dùng ảnh mẫu.');
  }
}
function capture() {
  const v = $('preview');
  if (!v.videoWidth) { toast('Camera chưa sẵn sàng'); return; }
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
    toast('Không đọc được ảnh này. Hãy thử ảnh JPG hoặc PNG khác.');
  }
}

// ---------- demo images (so the app is usable without a camera) ----------
function demoScene() {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 960;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 620);
  sky.addColorStop(0, '#16224a'); sky.addColorStop(1, '#f2a65a');
  g.fillStyle = sky; g.fillRect(0, 0, 720, 960);
  g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(520, 330, 64, 0, 7); g.fill();
  const ridge = (y, amp, color, seed) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(0, 960);
    for (let x = 0; x <= 720; x += 12) g.lineTo(x, y + Math.sin(x * 0.011 + seed) * amp + Math.sin(x * 0.037 + seed * 2) * amp * 0.35);
    g.lineTo(720, 960); g.fill();
  };
  ridge(520, 70, '#4b3f72', 1); ridge(610, 50, '#2f3d5c', 4); ridge(720, 30, '#1d3b2f', 7);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const y = 760 + rnd() * 200;
    g.fillStyle = `hsl(${90 + rnd() * 50}, 55%, ${18 + rnd() * 38}%)`;
    g.fillRect(rnd() * 720, y, 3 + rnd() * 5, 6 + rnd() * 14);
  }
  g.fillStyle = '#c9643f'; g.fillRect(250, 640, 170, 150);
  g.fillStyle = '#7d2f24'; g.beginPath(); g.moveTo(230, 640); g.lineTo(335, 560); g.lineTo(440, 640); g.fill();
  g.fillStyle = '#ffe9b0'; g.fillRect(280, 690, 40, 46); g.fillRect(350, 690, 40, 100);
  return c;
}
function demoPerson() {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 960;
  const g = c.getContext('2d');
  g.fillStyle = '#5f7f9c'; g.fillRect(0, 0, 720, 960);
  const skin = '#d9a07c', shirt = '#f3f1ea', pants = '#27324a';
  const cx = 360, top = 70, H = 830; // figure box
  const y = (f) => top + (1 - f) * H; // f = height fraction, 1 = top of head
  const limb = (x0, f0, x1, f1, w, color) => { g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + x0, y(f0)); g.lineTo(cx + x1, y(f1)); g.stroke(); };
  limb(-45, 0.5, -50, 0.06, 62, pants); limb(45, 0.5, 50, 0.06, 62, pants);
  limb(-50, 0.03, -62, 0.02, 40, '#1b1b1b'); limb(50, 0.03, 62, 0.02, 40, '#1b1b1b');
  limb(-92, 0.8, -140, 0.63, 44, shirt); limb(92, 0.8, 140, 0.63, 44, shirt);
  limb(-140, 0.63, -172, 0.47, 34, skin); limb(140, 0.63, 172, 0.47, 34, skin);
  g.fillStyle = shirt; g.beginPath(); g.roundRect(cx - 100, y(0.835), 200, y(0.5) - y(0.835) + 20, 36); g.fill();
  limb(0, 0.87, 0, 0.84, 46, skin);
  g.fillStyle = skin; g.beginPath(); g.ellipse(cx, y(0.935), 50, 58, 0, 0, 7); g.fill();
  g.fillStyle = '#2a1c14'; g.beginPath(); g.ellipse(cx, y(0.972), 52, 30, 0, Math.PI, 0); g.fill();
  return c;
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
    b.textContent = l.vi;
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
    info.querySelector('b').textContent = label.vi;
    info.querySelector('i').textContent = label.en;
    info.querySelector('p').textContent = label.info;
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
    label.textContent = `${a.id} · ${a.vi}`;
    label.htmlFor = 'axis-' + a.id;
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', id: 'axis-' + a.id, min: a.min, max: a.max, step: a.step });
    const out = document.createElement('output');
    input.addEventListener('input', () => { state.pose = setAxis(state.pose, a.id, Number(input.value)); syncAxes(); });
    row.append(label, input, out);
    axes.appendChild(row);
    axisInputs[a.key] = { input, out, a };
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
  if (!('DeviceOrientationEvent' in window)) return toast('Thiết bị không có cảm biến con quay.');
  setGyro(true);
  setTimeout(() => { if (state.gyro && !Number.isFinite(state.gyro.beta)) { setGyro(false); toast('Không nhận được dữ liệu con quay trên thiết bị này.'); } }, 1500);
}

// ---------- save ----------
function saveImage() {
  renderer.render(scene, camera);
  const url = $('stage').toDataURL('image/png');
  try {
    if (window.AndroidBridge && window.AndroidBridge.saveImage) {
      toast(window.AndroidBridge.saveImage(url.slice(url.indexOf(',') + 1)));
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `vision6d-${Date.now()}.png`;
    a.click();
    toast('Đã lưu ảnh');
  } catch (_) {
    toast('Không lưu được ảnh trên thiết bị này.');
  }
}

// ---------- pipeline ----------
function loadSource(src, sw, sh, forceMode) {
  if (!sw || !sh) { toast('Ảnh không hợp lệ'); return; }
  if (!initThree()) { toast('Thiết bị không hỗ trợ WebGL nên không dựng được 3D.', 5000); return; }
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
  if (!forceMode) toast(person.isPerson ? 'Phát hiện người trong ảnh → chế độ Cơ thể' : 'Không thấy người trong ảnh → chế độ 6D');
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
$('shutter').addEventListener('click', capture);
$('flip').addEventListener('click', () => { state.facing = state.facing === 'user' ? 'environment' : 'user'; startCamera(); });
$('pick').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', (e) => { pickFile(e.target.files[0]); e.target.value = ''; });
$('demo-scene').addEventListener('click', () => { const c = demoScene(); loadSource(c, c.width, c.height, 'relief'); });
$('demo-person').addEventListener('click', () => { const c = demoPerson(); loadSource(c, c.width, c.height); });
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
    screen: state.screen, mode: state.mode, pose: { ...state.pose }, explode: state.explode, style: state.style,
    person: state.person && { isPerson: state.person.isPerson, score: state.person.score },
    selected: state.selected && state.selected.id,
    three: THREE.REVISION, rendering: !!raf,
    meshes: anatomy ? anatomy.getObjectsByProperty('isMesh', true).length : 0,
    reliefVertices: relief ? relief.userData.depth.length : 0,
    labelsShown: [...labelEls.values()].filter((e) => e.b.style.display !== 'none').length,
  }),
};
startCamera();
