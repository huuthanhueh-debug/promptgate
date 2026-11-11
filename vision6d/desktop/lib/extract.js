// Vision 6D extraction core: turns one analysed image (pixels + depth grid) into the data behind
// every exported file. Pure functions over typed arrays, shared by the page and the Node tests.
//
// What the dimensions mean here:
//   3D  a textured relief mesh (x, y, z)
//   4D  that mesh plus time: morph targets animated over a looping timeline
//   6D  the image split into depth layers, each a separate part moved with six degrees of
//       freedom (3 translations + 3 rotations), and a point cloud with six values per point
//       (x, y, z, r, g, b)
import { layerOf } from '../../core/depth.js';
import { poseToTransform } from '../../core/sixdof.js';
import { buildGlb } from './glb.js';

export const FORMAT_VERSION = 1;
export const LIMITS = Object.freeze({ minLayers: 2, maxLayers: 12, minDetail: 32, maxDetail: 512 });

// World size of the image plane: the longest side is `longest` units (glTF units are metres).
export function planeSize(w, h, longest) {
  const L = longest || 1;
  return w >= h ? { w: L, h: (L * h) / w } : { w: (L * w) / h, h: L };
}

// Size of the analysis grid: the longest side gets `detail` samples, both sides at least 2.
export function gridSize(w, h, detail) {
  const d = Math.min(LIMITS.maxDetail, Math.max(LIMITS.minDetail, Math.round(detail) || 256));
  const k = d / Math.max(w, h);
  return { dw: Math.max(2, Math.round(w * k)), dh: Math.max(2, Math.round(h * k)) };
}

function checkDepth(depth, dw, dh) {
  if (!Number.isInteger(dw) || !Number.isInteger(dh) || dw < 2 || dh < 2) throw new RangeError('depth grid must be at least 2x2');
  if (!depth || depth.length !== dw * dh) throw new RangeError('depth must hold dw*dh values');
}

export function invertDepth(depth) {
  const out = new Float32Array(depth.length);
  for (let i = 0; i < depth.length; i++) out[i] = 1 - depth[i];
  return out;
}

// A user-supplied depth map (any greyscale image drawn to the grid) -> depth 0..1, white = near.
export function depthFromGray(rgba, dw, dh) {
  if (!rgba || rgba.length < dw * dh * 4) throw new RangeError('depth image is smaller than the grid');
  const out = new Float32Array(dw * dh);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    const v = (0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2]) / 255;
    out[i] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo;
  if (!(span > 1e-6)) return out.fill(0.5);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / span;
  return out;
}

// Depth -> opaque greyscale RGBA (white = near), one pixel per grid sample.
export function depthToRgba(depth) {
  const out = new Uint8ClampedArray(depth.length * 4);
  for (let i = 0, p = 0; i < depth.length; i++, p += 4) {
    const v = Math.round(Math.min(1, Math.max(0, depth[i])) * 255);
    out[p] = out[p + 1] = out[p + 2] = v;
    out[p + 3] = 255;
  }
  return out;
}

// Slope of the relief at a grid sample, in world units: [dz/dx, dz/dy] with y pointing up.
function slope(depth, dw, dh, x, y, sx, sy, strength) {
  const x0 = Math.max(0, x - 1), x1 = Math.min(dw - 1, x + 1);
  const y0 = Math.max(0, y - 1), y1 = Math.min(dh - 1, y + 1);
  const dzdx = ((depth[y * dw + x1] - depth[y * dw + x0]) * strength) / ((x1 - x0) * sx);
  const dzdy = ((depth[y0 * dw + x] - depth[y1 * dw + x]) * strength) / ((y1 - y0) * sy); // row 0 is the top
  return [dzdx, dzdy];
}

// Tangent-space normal map of the relief (the usual blue-ish RGB encoding), one pixel per sample.
export function normalMapRgba(depth, dw, dh, opts) {
  checkDepth(depth, dw, dh);
  const o = Object.assign({ planeW: 1, planeH: 1, strength: 0.3 }, opts);
  const sx = o.planeW / (dw - 1), sy = o.planeH / (dh - 1);
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const [gx, gy] = slope(depth, dw, dh, x, y, sx, sy, o.strength);
    const inv = 1 / Math.hypot(gx, gy, 1);
    const p = (y * dw + x) * 4;
    out[p] = Math.round((-gx * inv * 0.5 + 0.5) * 255);
    out[p + 1] = Math.round((-gy * inv * 0.5 + 0.5) * 255);
    out[p + 2] = Math.round((inv * 0.5 + 0.5) * 255);
    out[p + 3] = 255;
  }
  return out;
}

// The relief as an indexed triangle grid: one vertex per sample, row 0 at the top, +z towards
// the viewer, counter-clockwise triangles when seen from the front.
export function reliefGrid(depth, dw, dh, opts) {
  checkDepth(depth, dw, dh);
  const o = Object.assign({ planeW: 1, planeH: 1, strength: 0.3 }, opts);
  const sx = o.planeW / (dw - 1), sy = o.planeH / (dh - 1);
  const positions = new Float32Array(dw * dh * 3), normals = new Float32Array(dw * dh * 3), uvs = new Float32Array(dw * dh * 2);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const i = y * dw + x;
    positions[i * 3] = -o.planeW / 2 + x * sx;
    positions[i * 3 + 1] = o.planeH / 2 - y * sy;
    positions[i * 3 + 2] = depth[i] * o.strength;
    const [gx, gy] = slope(depth, dw, dh, x, y, sx, sy, o.strength);
    const inv = 1 / Math.hypot(gx, gy, 1);
    normals[i * 3] = -gx * inv; normals[i * 3 + 1] = -gy * inv; normals[i * 3 + 2] = inv;
    uvs[i * 2] = x / (dw - 1); uvs[i * 2 + 1] = y / (dh - 1);
  }
  const indices = new Uint32Array((dw - 1) * (dh - 1) * 6);
  let k = 0;
  for (let y = 0; y < dh - 1; y++) for (let x = 0; x < dw - 1; x++) {
    const a = y * dw + x, b = a + dw, c = a + 1, d = b + 1; // a top-left, b bottom-left, c top-right, d bottom-right
    indices[k++] = a; indices[k++] = b; indices[k++] = c;
    indices[k++] = b; indices[k++] = d; indices[k++] = c;
  }
  return { positions, normals, uvs, indices };
}

// Which layer a grid cell belongs to: the nearest of its four corners decides.
function cellLayer(depth, dw, x, y, n) {
  const a = y * dw + x;
  return layerOf(Math.max(depth[a], depth[a + 1], depth[a + dw], depth[a + dw + 1]), n);
}

// The relief cut into n depth layers (0 = farthest). Every grid cell lands in exactly one
// layer, so the layers put back together are the whole relief. Empty layers come back as null.
export function layerGrids(depth, dw, dh, n, opts) {
  const full = reliefGrid(depth, dw, dh, opts);
  n = Math.min(LIMITS.maxLayers, Math.max(LIMITS.minLayers, Math.floor(n) || 5));
  const cells = Array.from({ length: n }, () => []);
  for (let y = 0; y < dh - 1; y++) for (let x = 0; x < dw - 1; x++) cells[cellLayer(depth, dw, x, y, n)].push(y * dw + x);
  return cells.map((list) => {
    if (!list.length) return null;
    const remap = new Map();
    const use = (v) => { let r = remap.get(v); if (r === undefined) { r = remap.size; remap.set(v, r); } return r; };
    const indices = new Uint32Array(list.length * 6);
    let k = 0;
    for (const a of list) {
      const b = a + dw, c = a + 1, d = b + 1;
      indices[k++] = use(a); indices[k++] = use(b); indices[k++] = use(c);
      indices[k++] = use(b); indices[k++] = use(d); indices[k++] = use(c);
    }
    const count = remap.size;
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
    for (const [v, r] of remap) {
      positions.set(full.positions.subarray(v * 3, v * 3 + 3), r * 3);
      normals.set(full.normals.subarray(v * 3, v * 3 + 3), r * 3);
      uvs.set(full.uvs.subarray(v * 2, v * 2 + 2), r * 2);
    }
    return { positions, normals, uvs, indices };
  });
}

// One layer of the full-resolution image as RGBA: pixels whose depth falls in layer `index`
// keep their colour and alpha, the rest are fully transparent. depthRgba is the depth map
// scaled to the same w*h (its red channel is read). Returns { rgba, pixels } where pixels is
// how many pixels the layer holds.
export function layerRgba(rgba, depthRgba, w, h, n, index) {
  if (rgba.length < w * h * 4 || depthRgba.length < w * h * 4) throw new RangeError('image and depth map must both be w*h RGBA');
  const out = new Uint8ClampedArray(w * h * 4);
  let pixels = 0;
  for (let p = 0; p < w * h * 4; p += 4) {
    if (layerOf(depthRgba[p] / 255, n) !== index) continue;
    out[p] = rgba[p]; out[p + 1] = rgba[p + 1]; out[p + 2] = rgba[p + 2]; out[p + 3] = rgba[p + 3];
    pixels++;
  }
  return { rgba: out, pixels };
}

// Point cloud: one point per grid sample, six values each (x, y, z as floats; r, g, b as bytes).
export function pointCloud(rgba, depth, dw, dh, opts) {
  checkDepth(depth, dw, dh);
  if (!rgba || rgba.length < dw * dh * 4) throw new RangeError('rgba must hold dw*dh pixels');
  const o = Object.assign({ planeW: 1, planeH: 1, strength: 0.3 }, opts);
  const sx = o.planeW / (dw - 1), sy = o.planeH / (dh - 1);
  const positions = new Float32Array(dw * dh * 3), colors = new Uint8Array(dw * dh * 3);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const i = y * dw + x;
    positions[i * 3] = -o.planeW / 2 + x * sx;
    positions[i * 3 + 1] = o.planeH / 2 - y * sy;
    positions[i * 3 + 2] = depth[i] * o.strength;
    colors[i * 3] = rgba[i * 4]; colors[i * 3 + 1] = rgba[i * 4 + 1]; colors[i * 3 + 2] = rgba[i * 4 + 2];
  }
  return { positions, colors };
}

// Binary little-endian PLY, the format every point-cloud tool reads (MeshLab, CloudCompare, Blender).
export function writePly(cloud, comment) {
  const count = cloud.positions.length / 3;
  if (cloud.colors.length !== count * 3) throw new RangeError('colors do not match positions');
  const header = ['ply', 'format binary_little_endian 1.0', `comment ${String(comment || 'Vision 6D point cloud: x y z r g b').replace(/[\r\n]+/g, ' ')}`,
    `element vertex ${count}`, 'property float x', 'property float y', 'property float z',
    'property uchar red', 'property uchar green', 'property uchar blue', 'end_header', ''].join('\n');
  const head = new TextEncoder().encode(header);
  const out = new Uint8Array(head.length + count * 15);
  out.set(head);
  const dv = new DataView(out.buffer);
  let o = head.length;
  for (let i = 0; i < count; i++) {
    dv.setFloat32(o, cloud.positions[i * 3], true); dv.setFloat32(o + 4, cloud.positions[i * 3 + 1], true); dv.setFloat32(o + 8, cloud.positions[i * 3 + 2], true);
    out[o + 12] = cloud.colors[i * 3]; out[o + 13] = cloud.colors[i * 3 + 1]; out[o + 14] = cloud.colors[i * 3 + 2];
    o += 15;
  }
  return out;
}

// Reads back a PLY written by writePly(). Used by the tests and the self-check.
export function parsePly(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const marker = new TextEncoder().encode('end_header\n');
  let end = -1;
  for (let i = 0; i + marker.length <= Math.min(u8.length, 4096) && end < 0; i++) {
    let hit = true;
    for (let k = 0; k < marker.length; k++) if (u8[i + k] !== marker[k]) { hit = false; break; }
    if (hit) end = i + marker.length;
  }
  if (end < 0) throw new Error('not a PLY: no end_header');
  const header = new TextDecoder().decode(u8.subarray(0, end));
  if (!header.startsWith('ply\n') || !header.includes('format binary_little_endian 1.0')) throw new Error('not a binary little-endian PLY');
  const count = Number((/element vertex (\d+)/.exec(header) || [])[1]);
  if (!Number.isInteger(count) || end + count * 15 !== u8.length) throw new Error('PLY vertex count does not match the file size');
  const properties = [...header.matchAll(/^property \w+ (\w+)$/gm)].map((m) => m[1]);
  const positions = new Float32Array(count * 3), colors = new Uint8Array(count * 3);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  for (let i = 0, o = end; i < count; i++, o += 15) {
    positions[i * 3] = dv.getFloat32(o, true); positions[i * 3 + 1] = dv.getFloat32(o + 4, true); positions[i * 3 + 2] = dv.getFloat32(o + 8, true);
    colors[i * 3] = u8[o + 12]; colors[i * 3 + 1] = u8[o + 13]; colors[i * 3 + 2] = u8[o + 14];
  }
  return { count, properties, positions, colors };
}

// ---------- timelines (the preview plays exactly what the files contain) ----------
export const TIMELINE_4D = Object.freeze({ duration: 8, times: [0, 2, 4, 6, 8], flatten: [1, 0, 0, 0, 1], teardown: [0, 0, 1, 0, 0] });
export const TIMELINE_6D = Object.freeze({ duration: 18, step: 0.25, spreadIn: 3, tourEnd: 15 });

function lerpKeys(times, values, t) {
  if (t <= times[0]) return values[0];
  for (let i = 1; i < times.length; i++) if (t <= times[i]) return values[i - 1] + ((values[i] - values[i - 1]) * (t - times[i - 1])) / (times[i] - times[i - 1]);
  return values[values.length - 1];
}

// 4D state at time t (seconds, loops): morph weights { flatten, teardown } in 0..1.
export function state4d(t) {
  const u = ((t % TIMELINE_4D.duration) + TIMELINE_4D.duration) % TIMELINE_4D.duration;
  return { flatten: lerpKeys(TIMELINE_4D.times, TIMELINE_4D.flatten, u), teardown: lerpKeys(TIMELINE_4D.times, TIMELINE_4D.teardown, u) };
}

// 6D state at time t (seconds, loops): how far the layers are spread (0..1) and the six-axis
// pose of the whole stack. Each axis is exercised alone for two seconds: J1 yaw, J2 pitch,
// J3 roll, J4 x, J5 y, J6 z.
export function state6d(t) {
  const T = TIMELINE_6D;
  const u = ((t % T.duration) + T.duration) % T.duration;
  const spread = u < T.spreadIn ? u / T.spreadIn : u <= T.tourEnd ? 1 : (T.duration - u) / (T.duration - T.tourEnd);
  const pose = { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: 0 };
  if (u >= T.spreadIn && u < T.tourEnd) {
    const k = (u - T.spreadIn) / 2, axis = Math.min(5, Math.floor(k)), swing = Math.sin((k - axis) * Math.PI * 2);
    const amp = [28, 16, 12, 0.12, 0.1, 0.18][axis];
    pose[['yaw', 'pitch', 'roll', 'x', 'y', 'z'][axis]] = swing * amp;
  }
  return { spread, pose };
}

// Euler angles (radians, YXZ order as three.js uses for the viewer) -> unit quaternion [x, y, z, w].
export function quatFromEulerYXZ(x, y, z) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3];
}

// ---------- the three models ----------
function photoMaterial(input) {
  return {
    images: [{ bytes: input.textureBytes, mime: input.textureMime || 'image/jpeg' }],
    materials: [{ name: 'photo', image: 0, unlit: true, doubleSided: true }],
  };
}
function geometryOptions(input) {
  const plane = planeSize(input.width, input.height, 1);
  return { planeW: plane.w, planeH: plane.h, strength: input.strength === undefined ? 0.3 : input.strength };
}
const layerCount = (input) => Math.min(LIMITS.maxLayers, Math.max(LIMITS.minLayers, Math.floor(input.layers) || 5));
const layerGap = (input) => 0.9 / (layerCount(input) - 1) * 0.35; // spacing between spread layers, in metres

// input = { name, width, height (texture pixels), depth, dw, dh, textureBytes, textureMime, strength, layers }
export function build3dGlb(input) {
  const grid = reliefGrid(input.depth, input.dw, input.dh, geometryOptions(input));
  return buildGlb(Object.assign(photoMaterial(input), {
    generator: 'Vision 6D',
    extras: { vision6d: { kind: '3d', format: FORMAT_VERSION } },
    meshes: [Object.assign({ name: 'relief', material: 0 }, grid)],
    nodes: [{ name: input.name || 'image', mesh: 0 }],
    roots: [0],
  }));
}

// 3D + time: the relief with two morph targets ("flatten" presses it back into the flat photo,
// "teardown" pulls its depth layers apart) and a looping animation of their weights.
export function build4dGlb(input) {
  const o = geometryOptions(input);
  const grid = reliefGrid(input.depth, input.dw, input.dh, o);
  const n = layerCount(input), gap = layerGap(input);
  const flatten = new Float32Array(grid.positions.length), teardown = new Float32Array(grid.positions.length);
  for (let i = 0; i < input.depth.length; i++) {
    flatten[i * 3 + 2] = -grid.positions[i * 3 + 2];
    teardown[i * 3 + 2] = layerOf(input.depth[i], n) * gap;
  }
  const T = TIMELINE_4D;
  const values = new Float32Array(T.times.length * 2);
  T.times.forEach((_, i) => { values[i * 2] = T.flatten[i]; values[i * 2 + 1] = T.teardown[i]; });
  return buildGlb(Object.assign(photoMaterial(input), {
    generator: 'Vision 6D',
    extras: { vision6d: { kind: '4d', format: FORMAT_VERSION, duration: T.duration, targets: ['flatten', 'teardown'] } },
    meshes: [Object.assign({ name: 'relief', material: 0, targets: [{ name: 'flatten', positions: flatten }, { name: 'teardown', positions: teardown }], weights: [T.flatten[0], T.teardown[0]] }, grid)],
    nodes: [{ name: input.name || 'image', mesh: 0 }],
    roots: [0],
    animations: [{ name: '4D: emerge and tear down', channels: [{ node: 0, path: 'weights', times: new Float32Array(T.times), values }] }],
  }));
}

// Six degrees of freedom: every depth layer is its own node under a "stack" node. The animation
// spreads the layers along z, then drives the stack through each of the six axes in turn.
export function build6dGlb(input) {
  const n = layerCount(input), gap = layerGap(input);
  const grids = layerGrids(input.depth, input.dw, input.dh, n, geometryOptions(input));
  const meshes = [], nodes = [{ name: input.name || 'image', children: [] }], layerNodes = [];
  grids.forEach((g, i) => {
    if (!g) return;
    meshes.push(Object.assign({ name: `layer-${i + 1}`, material: 0 }, g));
    nodes.push({ name: `layer-${i + 1}`, mesh: meshes.length - 1, extras: { layer: i + 1, of: n } });
    nodes[0].children.push(nodes.length - 1);
    layerNodes.push({ node: nodes.length - 1, layer: i });
  });
  const T = TIMELINE_6D;
  const keys = Math.round(T.duration / T.step) + 1;
  const times = new Float32Array(keys), rot = new Float32Array(keys * 4), pos = new Float32Array(keys * 3);
  const layerPos = layerNodes.map(() => new Float32Array(keys * 3));
  for (let k = 0; k < keys; k++) {
    const t = Math.min(T.duration, k * T.step);
    times[k] = t;
    const s = state6d(t === T.duration ? 0 : t); // the last key equals the first, so the loop is seamless
    const tf = poseToTransform(s.pose);
    rot.set(quatFromEulerYXZ(tf.rotation[0], tf.rotation[1], tf.rotation[2]), k * 4);
    pos.set(tf.position, k * 3);
    layerNodes.forEach((ln, j) => { layerPos[j][k * 3 + 2] = ln.layer * gap * s.spread; });
  }
  const channels = [{ node: 0, path: 'rotation', times, values: rot }, { node: 0, path: 'translation', times, values: pos }];
  layerNodes.forEach((ln, j) => channels.push({ node: ln.node, path: 'translation', times, values: layerPos[j] }));
  return buildGlb(Object.assign(photoMaterial(input), {
    generator: 'Vision 6D',
    extras: { vision6d: { kind: '6d', format: FORMAT_VERSION, duration: T.duration, layers: n, axes: ['J1 yaw', 'J2 pitch', 'J3 roll', 'J4 x', 'J5 y', 'J6 z'] } },
    meshes, nodes, roots: [0],
    animations: [{ name: '6D: spread layers, then six-axis tour', channels }],
  }));
}

// Anatomy overlay. parts = [{ name, system, positions, normals, indices, color: [r,g,b] }] already
// in the same coordinate space as the relief; one node per part under one node per system.
export function buildAnatomyGlb(parts, name) {
  const systems = [...new Set(parts.map((p) => p.system))];
  const colorKey = (c) => c.map((v) => v.toFixed(3)).join();
  const materials = [], matIndex = new Map();
  const nodes = [{ name: name || 'anatomy', children: [] }];
  const sysNode = new Map();
  for (const s of systems) { nodes.push({ name: s, children: [] }); nodes[0].children.push(nodes.length - 1); sysNode.set(s, nodes.length - 1); }
  const meshes = parts.map((p) => {
    const key = colorKey(p.color);
    if (!matIndex.has(key)) { materials.push({ name: 'colour-' + (materials.length + 1), color: [p.color[0], p.color[1], p.color[2], 1], emissive: p.color.map((v) => v * 0.25) }); matIndex.set(key, materials.length - 1); }
    return { name: p.name, positions: p.positions, normals: p.normals, indices: p.indices, material: matIndex.get(key) };
  });
  parts.forEach((p, i) => { nodes.push({ name: p.name, mesh: i }); nodes[sysNode.get(p.system)].children.push(nodes.length - 1); });
  return buildGlb({ generator: 'Vision 6D', extras: { vision6d: { kind: 'anatomy', format: FORMAT_VERSION, note: 'Generic illustrative model, not derived from the person in the photo.' } }, materials, meshes, nodes, roots: [0] });
}

// Folder / file name that is safe on Windows, macOS and Linux and keeps Vietnamese letters.
export function sanitizeName(name) {
  let s = String(name || '').normalize('NFC').replace(/\.[A-Za-z0-9]{1,5}$/, '');
  s = s.replace(/[^\p{L}\p{N} ._-]+/gu, ' ').replace(/\s+/g, ' ').replace(/^[ .]+|[ .]+$/g, '').slice(0, 80).replace(/[ .]+$/g, '');
  if (!s) s = 'image';
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(s)) s = '_' + s;
  return s;
}

// scene.json: what was made, from what, and what each file is.
export function buildManifest(info) {
  return {
    app: 'Vision 6D', format: FORMAT_VERSION, created: info.created || new Date().toISOString(),
    source: { name: info.sourceName, width: info.width, height: info.height },
    settings: { detail: Math.max(info.dw, info.dh), grid: [info.dw, info.dh], strength: info.strength, layers: info.layers, depth: info.depthSource || 'estimated', inverted: !!info.inverted },
    person: info.person ? { detected: !!info.person.isPerson, score: Number(info.person.score.toFixed(2)) } : null,
    definitions: {
      '3d': 'Textured relief mesh.',
      '4d': '3D plus time: morph targets "flatten" and "teardown" animated on a looping timeline.',
      '6d': 'Six degrees of freedom: each depth layer is a separate node; the animation spreads them and moves the stack on J1 yaw, J2 pitch, J3 roll, J4 x, J5 y, J6 z. The point cloud stores six values per point: x y z r g b.',
      depth: 'Depth is estimated from a single image (or taken from a supplied depth map), white = near.',
    },
    files: info.files,
  };
}
