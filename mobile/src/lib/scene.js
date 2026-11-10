// three.js scene builders for Vision 6D. Every function takes the THREE namespace as its first
// argument, so the browser passes the vendored build and Node tests pass the same module without
// a renderer. Nothing here touches the DOM.
import { layerOf } from './depth.js';
import { PARTS, SYSTEMS, explodeOffset, matchesPart } from './anatomy.js';

export const RELIEF_STYLES = Object.freeze(['photo', 'mix', 'holo']);

// Photo -> relief. depth is a Float32Array(dw*dh) in 0..1 (1 = near), rows top to bottom.
// Returns a Group holding a textured mesh, a wireframe and a point cloud over one geometry.
export function buildRelief(THREE, opts) {
  const { depth, dw, dh, planeW, planeH, texture } = opts;
  if (!depth || depth.length !== dw * dh) throw new RangeError('depth must hold dw*dh values');
  const geo = new THREE.PlaneGeometry(planeW, planeH, dw - 1, dh - 1);
  const colors = new Float32Array(dw * dh * 3);
  const near = new THREE.Color(0xff4fd8), far = new THREE.Color(0x27d9ff), c = new THREE.Color();
  for (let i = 0; i < depth.length; i++) {
    c.copy(far).lerp(near, depth[i]);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const group = new THREE.Group();
  group.name = 'relief';
  const photo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture || null, side: THREE.DoubleSide }));
  photo.name = 'photo';
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x35e0ff, wireframe: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  wire.name = 'wire';
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: planeH / dh * 0.9, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  points.name = 'points';
  group.add(photo, wire, points);
  group.userData = { depth, dw, dh, geometry: geo, strength: 0, explode: 0 };
  updateRelief(group, { strength: 0.5, explode: 0 });
  setReliefStyle(group, 'photo');
  return group;
}

// Re-displaces the relief. strength = depth scale in world units; explode (0..1) pulls the
// image apart into `layers` terraces along z (the "tách lớp" view).
export function updateRelief(group, opts) {
  const u = group.userData;
  const strength = Number.isFinite(opts.strength) ? opts.strength : u.strength;
  const explode = Number.isFinite(opts.explode) ? Math.min(1, Math.max(0, opts.explode)) : u.explode;
  const layers = Math.max(2, Math.floor(opts.layers || u.layers || 5));
  const pos = u.geometry.attributes.position;
  for (let i = 0; i < u.depth.length; i++) {
    const d = u.depth[i];
    pos.setZ(i, d * strength + (layerOf(d, layers) / (layers - 1)) * explode * 0.9);
  }
  pos.needsUpdate = true;
  u.geometry.computeBoundingSphere();
  u.geometry.computeBoundingBox();
  Object.assign(u, { strength, explode, layers });
}

export function setReliefStyle(group, style) {
  if (!RELIEF_STYLES.includes(style)) style = 'photo';
  group.getObjectByName('photo').visible = style !== 'holo';
  group.getObjectByName('wire').visible = style !== 'photo';
  group.getObjectByName('points').visible = style === 'holo';
  group.userData.style = style;
}

const v3 = (THREE, a) => new THREE.Vector3(a[0], a[1], a[2]);

function partGeometry(THREE, part, unitSphere) {
  if (part.shape === 'sphere') return unitSphere;
  if (part.shape === 'bone') {
    const len = v3(THREE, part.from).distanceTo(v3(THREE, part.to));
    return new THREE.CapsuleGeometry(part.r, Math.max(0.001, len - part.r * 2), 3, 8);
  }
  if (part.shape === 'knot') return new THREE.TorusKnotGeometry(part.r, part.tube, 96, 7, 2, 5);
  if (part.shape === 'ring') {
    const closed = part.arc >= Math.PI * 2 - 1e-6;
    const n = 28, pts = [];
    for (let i = 0; i < (closed ? n : n + 1); i++) {
      const a = -part.arc / 2 + (part.arc * i) / n;
      const z = -part.r[1] * Math.cos(a);
      pts.push(new THREE.Vector3(part.r[0] * Math.sin(a), (part.slope || 0) * (z + part.r[1]), z));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), 40, part.tube, 6, closed);
  }
  if (part.shape === 'tube') {
    const curve = new THREE.CatmullRomCurve3(part.path.map((p) => v3(THREE, p)));
    return new THREE.TubeGeometry(curve, part.path.length * 8, part.r, 6, false);
  }
  throw new Error('unknown shape ' + part.shape);
}

function partMaterial(THREE, part, system) {
  const color = part.color !== undefined ? part.color : system.color;
  if (part.system === 'vessels') return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
  const emissive = new THREE.Color(color).multiplyScalar(part.system === 'skeleton' ? 0.35 : 0.3);
  return new THREE.MeshPhongMaterial({ color, emissive, shininess: 60, transparent: true, opacity: part.system === 'skeleton' ? 0.95 : 0.86 });
}

// The whole figure, height 1, soles at y = 0. One sub-group per system (named by system id),
// one mesh per part (named by part id).
export function buildAnatomy(THREE) {
  const root = new THREE.Group();
  root.name = 'anatomy';
  const unitSphere = new THREE.SphereGeometry(1, 20, 14);
  const up = new THREE.Vector3(0, 1, 0);
  const groups = {};
  for (const s of SYSTEMS) {
    const g = new THREE.Group();
    g.name = s.id;
    groups[s.id] = g;
    root.add(g);
  }
  for (const part of PARTS) {
    const system = SYSTEMS.find((s) => s.id === part.system);
    const mesh = new THREE.Mesh(partGeometry(THREE, part, unitSphere), partMaterial(THREE, part, system));
    mesh.name = part.id;
    if (part.shape === 'sphere') {
      mesh.position.copy(v3(THREE, part.at));
      mesh.scale.set(part.r[0], part.r[1], part.r[2]);
    } else if (part.shape === 'bone') {
      const a = v3(THREE, part.from), b = v3(THREE, part.to);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(up, b.sub(a).normalize());
    } else if (part.shape === 'knot') {
      mesh.position.copy(v3(THREE, part.at));
      mesh.scale.set(part.squash[0], part.squash[1], part.squash[2]);
    } else if (part.shape === 'ring') {
      mesh.position.copy(v3(THREE, part.at));
    }
    mesh.userData = { part, baseOpacity: mesh.material.opacity, baseScale: mesh.scale.clone(), baseEmissive: mesh.material.emissive ? mesh.material.emissive.clone() : null, baseColor: mesh.material.color.clone() };
    groups[part.system].add(mesh);
  }
  root.userData = { systems: groups, explode: 0, selected: null };
  return root;
}

export function setExplode(anatomy, t) {
  for (const s of SYSTEMS) anatomy.userData.systems[s.id].position.z = explodeOffset(s.id, t);
  anatomy.userData.explode = Math.min(1, Math.max(0, Number(t) || 0));
}

export function setSystemVisible(anatomy, systemId, on) {
  const g = anatomy.userData.systems[systemId];
  if (g) g.visible = !!on;
}

// Highlights the meshes covered by partRef (a part id or group) and dims the rest.
// Pass null to clear. Returns how many meshes were highlighted.
export function highlightPart(anatomy, partRef) {
  let hits = 0;
  anatomy.traverse((m) => {
    if (!m.isMesh) return;
    const u = m.userData, mat = m.material;
    const hit = partRef != null && matchesPart(u.part, partRef);
    if (hit) hits++;
    mat.opacity = partRef == null ? u.baseOpacity : hit ? 1 : u.baseOpacity * 0.28;
    if (mat.emissive) { if (hit) mat.emissive.setRGB(0.55, 0.95, 1); else mat.emissive.copy(u.baseEmissive); }
    else { if (hit) mat.color.setRGB(1, 1, 1); else mat.color.copy(u.baseColor); }
  });
  anatomy.userData.selected = hits ? partRef : null;
  return hits;
}

// Per-frame life signs: the heart beats at ~66 bpm.
export function animateAnatomy(anatomy, time) {
  const heart = anatomy.getObjectByName('heart');
  if (!heart) return;
  const beat = (time * 1.1) % 1;
  const k = 1 + 0.16 * Math.exp(-beat * 9) + 0.08 * Math.exp(-Math.abs(beat - 0.28) * 14);
  heart.scale.copy(heart.userData.baseScale).multiplyScalar(k);
}

// Decorative double helix (height 1, centred on the origin), like the reference HUD.
export function buildDNA(THREE, opts) {
  const o = Object.assign({ turns: 2.5, radius: 0.09, pairs: 34 }, opts);
  const g = new THREE.Group();
  g.name = 'dna';
  const strand = (phase) => {
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, a = t * o.turns * Math.PI * 2 + phase;
      pts.push(new THREE.Vector3(Math.cos(a) * o.radius, t - 0.5, Math.sin(a) * o.radius));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const mat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const a = strand(0), b = strand(Math.PI);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(a, 160, 0.008, 6), mat(0x35e0ff)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(b, 160, 0.008, 6), mat(0xff4fd8)));
  const rungs = [];
  for (let i = 0; i < o.pairs; i++) {
    const t = (i + 0.5) / o.pairs;
    const p = a.getPoint(t), q = b.getPoint(t);
    rungs.push(p.x, p.y, p.z, q.x, q.y, q.z);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rungs, 3));
  g.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.6 })));
  return g;
}

// Frees GPU resources held by an object tree (geometries, materials, textures).
export function disposeTree(obj) {
  const seen = new Set();
  obj.traverse((o) => {
    for (const r of [o.geometry, ...(Array.isArray(o.material) ? o.material : [o.material])]) {
      if (!r || seen.has(r)) continue;
      seen.add(r);
      if (r.map) r.map.dispose();
      r.dispose();
    }
  });
  return seen.size;
}
