// Minimal glTF 2.0 binary (.glb) writer, reader and structural checker. Pure JS over typed
// arrays: runs in the browser and under Node, no dependencies.
//
// Covers what Vision 6D exports: indexed triangle meshes with normals and UVs, embedded PNG/JPEG
// textures, flat-colour and unlit materials, morph targets, a node tree, and keyframe animation
// of translation / rotation / scale / morph weights.

const FLOAT = 5126, UINT = 5125;
const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963;
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const PATH_TYPE = { translation: 'VEC3', scale: 'VEC3', rotation: 'VEC4', weights: 'SCALAR' };
const MAGIC = 0x46546c67, JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;

function minMax(arr, comps) {
  const min = new Array(comps).fill(Infinity), max = new Array(comps).fill(-Infinity);
  for (let i = 0; i < arr.length; i++) {
    const c = i % comps, v = arr[i];
    if (v < min[c]) min[c] = v;
    if (v > max[c]) max[c] = v;
  }
  return { min, max };
}

// doc = {
//   generator, extras,
//   images:    [{ bytes: Uint8Array, mime: 'image/jpeg' | 'image/png' }],
//   materials: [{ name, color: [r,g,b,a], image: index, unlit, doubleSided, emissive: [r,g,b], alphaMode }],
//   meshes:    [{ name, positions, normals?, uvs?, indices, material?, targets?: [{ name, positions }], weights? }],
//   nodes:     [{ name, mesh?, translation?, rotation?, scale?, children?, extras? }],
//   roots:     [node index, ...],
//   animations:[{ name, channels: [{ node, path, times, values, interpolation? }] }],
// }
// positions/normals/uvs/times/values are Float32Array, indices Uint32Array. Returns Uint8Array.
export function buildGlb(doc) {
  const chunks = [];
  let length = 0;
  const bufferViews = [], accessors = [];
  const pad = () => { const p = (4 - (length % 4)) % 4; if (p) { chunks.push(new Uint8Array(p)); length += p; } };
  const addView = (bytes, target) => {
    pad();
    const view = { buffer: 0, byteOffset: length, byteLength: bytes.byteLength };
    if (target) view.target = target;
    bufferViews.push(view);
    chunks.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    length += bytes.byteLength;
    return bufferViews.length - 1;
  };
  const addAccessor = (arr, type, opts) => {
    const comps = COMPONENTS[type];
    if (arr.length % comps) throw new RangeError(`accessor data length ${arr.length} is not a multiple of ${comps}`);
    const index = arr instanceof Uint32Array;
    if (!index && !(arr instanceof Float32Array)) throw new TypeError('accessor data must be Float32Array or Uint32Array');
    const acc = { bufferView: addView(arr, opts && opts.target), componentType: index ? UINT : FLOAT, count: arr.length / comps, type };
    if (opts && opts.bounds) Object.assign(acc, minMax(arr, comps));
    accessors.push(acc);
    return accessors.length - 1;
  };

  const json = { asset: { version: '2.0', generator: doc.generator || 'Vision 6D' } };
  const extUsed = new Set();

  const images = doc.images || [];
  if (images.length) {
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
    json.images = images.map((im) => {
      if (!/^image\/(png|jpeg)$/.test(im.mime)) throw new Error('glTF images must be PNG or JPEG, got ' + im.mime);
      return { bufferView: addView(im.bytes), mimeType: im.mime };
    });
    json.textures = images.map((_, i) => ({ sampler: 0, source: i }));
  }

  const materials = doc.materials || [];
  if (materials.length) {
    json.materials = materials.map((m) => {
      const pbr = { baseColorFactor: m.color || [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 };
      if (m.image !== undefined) {
        if (!(m.image >= 0 && m.image < images.length)) throw new RangeError('material refers to a missing image');
        pbr.baseColorTexture = { index: m.image };
      }
      const out = { name: m.name || 'material', pbrMetallicRoughness: pbr, doubleSided: !!m.doubleSided };
      if (m.emissive) out.emissiveFactor = m.emissive;
      if (m.alphaMode) out.alphaMode = m.alphaMode;
      if (m.unlit) { out.extensions = { KHR_materials_unlit: {} }; extUsed.add('KHR_materials_unlit'); }
      return out;
    });
  }

  json.meshes = (doc.meshes || []).map((m) => {
    const vertices = m.positions.length / 3;
    const attributes = { POSITION: addAccessor(m.positions, 'VEC3', { target: ARRAY_BUFFER, bounds: true }) };
    if (m.normals) {
      if (m.normals.length !== m.positions.length) throw new RangeError(`mesh ${m.name}: normals do not match positions`);
      attributes.NORMAL = addAccessor(m.normals, 'VEC3', { target: ARRAY_BUFFER });
    }
    if (m.uvs) {
      if (m.uvs.length !== vertices * 2) throw new RangeError(`mesh ${m.name}: uvs do not match positions`);
      attributes.TEXCOORD_0 = addAccessor(m.uvs, 'VEC2', { target: ARRAY_BUFFER });
    }
    if (m.indices.length % 3) throw new RangeError(`mesh ${m.name}: index count is not a multiple of 3`);
    const prim = { attributes, indices: addAccessor(m.indices, 'SCALAR', { target: ELEMENT_ARRAY_BUFFER }), mode: 4 };
    if (m.material !== undefined) {
      if (!(m.material >= 0 && m.material < materials.length)) throw new RangeError(`mesh ${m.name}: missing material`);
      prim.material = m.material;
    }
    const out = { name: m.name || 'mesh', primitives: [prim] };
    if (m.targets && m.targets.length) {
      prim.targets = m.targets.map((t) => {
        if (t.positions.length !== m.positions.length) throw new RangeError(`mesh ${m.name}: morph target ${t.name} does not match positions`);
        return { POSITION: addAccessor(t.positions, 'VEC3', { target: ARRAY_BUFFER, bounds: true }) };
      });
      out.weights = m.weights || m.targets.map(() => 0);
      out.extras = { targetNames: m.targets.map((t) => t.name) };
    }
    return out;
  });

  const nodes = doc.nodes || [];
  json.nodes = nodes.map((n) => {
    const out = { name: n.name || 'node' };
    for (const k of ['mesh', 'translation', 'rotation', 'scale', 'extras']) if (n[k] !== undefined) out[k] = n[k];
    if (n.children && n.children.length) out.children = n.children;
    return out;
  });
  const scene = { nodes: doc.roots || [] };
  if (doc.extras) scene.extras = doc.extras;
  json.scenes = [scene];
  json.scene = 0;

  if (doc.animations && doc.animations.length) {
    const timeAccessors = new Map(); // one accessor per shared time track
    json.animations = doc.animations.map((a) => {
      const samplers = [], channels = [];
      for (const c of a.channels) {
        const type = PATH_TYPE[c.path];
        if (!type) throw new Error('unknown animation path ' + c.path);
        if (!(c.node >= 0 && c.node < nodes.length)) throw new RangeError('animation targets a missing node');
        if (!timeAccessors.has(c.times)) timeAccessors.set(c.times, addAccessor(c.times, 'SCALAR', { bounds: true }));
        samplers.push({ input: timeAccessors.get(c.times), output: addAccessor(c.values, type), interpolation: c.interpolation || 'LINEAR' });
        channels.push({ sampler: samplers.length - 1, target: { node: c.node, path: c.path } });
      }
      return { name: a.name || 'animation', samplers, channels };
    });
  }

  pad();
  json.buffers = [{ byteLength: length }];
  json.bufferViews = bufferViews;
  json.accessors = accessors;
  if (extUsed.size) json.extensionsUsed = [...extUsed];

  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPad) { const p = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20); p.set(jsonBytes); jsonBytes = p; }

  const total = 12 + 8 + jsonBytes.length + 8 + length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, JSON_CHUNK, true);
  out.set(jsonBytes, 20);
  let o = 20 + jsonBytes.length;
  dv.setUint32(o, length, true); dv.setUint32(o + 4, BIN_CHUNK, true);
  o += 8;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// Splits a .glb into its JSON document and binary chunk. Throws on a malformed container.
export function parseGlb(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 20) throw new Error('not a GLB: too short');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('not a GLB: bad magic');
  if (dv.getUint32(4, true) !== 2) throw new Error('unsupported GLB version');
  if (dv.getUint32(8, true) !== u8.length) throw new Error('GLB length field does not match the file size');
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== JSON_CHUNK || 20 + jsonLen > u8.length) throw new Error('GLB has no JSON chunk');
  const json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jsonLen)));
  let bin = new Uint8Array(0);
  const b = 20 + jsonLen;
  if (b + 8 <= u8.length) {
    const binLen = dv.getUint32(b, true);
    if (dv.getUint32(b + 4, true) !== BIN_CHUNK || b + 8 + binLen > u8.length) throw new Error('GLB has a bad BIN chunk');
    bin = u8.subarray(b + 8, b + 8 + binLen);
  }
  return { json, bin };
}

// Reads an accessor back as a typed array (copies, so alignment never matters).
export function readAccessor(glb, index) {
  const acc = glb.json.accessors[index];
  const view = glb.json.bufferViews[acc.bufferView];
  const n = acc.count * COMPONENTS[acc.type];
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
  // Uint8Array's own slice always copies; Node's Buffer.slice would hand back a view instead.
  const copy = Uint8Array.prototype.slice.call(glb.bin, start, start + n * 4);
  return acc.componentType === UINT ? new Uint32Array(copy.buffer, 0, n) : new Float32Array(copy.buffer, 0, n);
}

// Structural check of a .glb: every reference resolves, every range fits, indices stay inside
// their vertex buffers, animation tracks have matching key counts and unit quaternions.
// Returns { ok, errors: [...], stats: { meshes, nodes, vertices, triangles, animations, images } }.
export function checkGlb(bytes) {
  const errors = [];
  const stats = { meshes: 0, nodes: 0, vertices: 0, triangles: 0, animations: 0, images: 0 };
  let glb;
  try { glb = parseGlb(bytes); } catch (e) { return { ok: false, errors: [e.message], stats }; }
  const { json, bin } = glb;
  const err = (m) => errors.push(m);
  const has = (list, i) => Array.isArray(list) && Number.isInteger(i) && i >= 0 && i < list.length;

  if (!json.asset || json.asset.version !== '2.0') err('asset.version must be "2.0"');
  if (!json.buffers || json.buffers.length !== 1 || json.buffers[0].byteLength > bin.length) err('buffer 0 is larger than the BIN chunk');
  const views = json.bufferViews || [], accs = json.accessors || [];
  views.forEach((v, i) => {
    if ((v.byteOffset || 0) + v.byteLength > bin.length) err(`bufferView ${i} runs past the buffer`);
    if ((v.byteOffset || 0) % 4) err(`bufferView ${i} is not 4-byte aligned`);
  });
  accs.forEach((a, i) => {
    if (!has(views, a.bufferView)) return err(`accessor ${i} has no bufferView`);
    if (!COMPONENTS[a.type] || (a.componentType !== FLOAT && a.componentType !== UINT)) return err(`accessor ${i} has an unsupported type`);
    if ((a.byteOffset || 0) + a.count * COMPONENTS[a.type] * 4 > views[a.bufferView].byteLength) err(`accessor ${i} runs past its bufferView`);
    if (a.componentType === FLOAT && has(views, a.bufferView)) {
      const d = readAccessor(glb, i);
      for (let k = 0; k < d.length; k++) if (!Number.isFinite(d[k])) { err(`accessor ${i} holds a non-finite number`); break; }
    }
  });
  if (errors.length) return { ok: false, errors, stats };

  (json.images || []).forEach((im, i) => {
    stats.images++;
    if (!has(views, im.bufferView)) err(`image ${i} has no bufferView`);
    if (!/^image\/(png|jpeg)$/.test(im.mimeType || '')) err(`image ${i} has a bad mimeType`);
  });
  (json.textures || []).forEach((t, i) => { if (!has(json.images, t.source)) err(`texture ${i} has no image`); });
  (json.materials || []).forEach((m, i) => {
    const tex = m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture;
    if (tex && !has(json.textures, tex.index)) err(`material ${i} has no texture`);
  });
  for (const ext of json.extensionsUsed || []) {
    if (!(json.materials || []).some((m) => m.extensions && ext in m.extensions)) err(`extension ${ext} is declared but unused`);
  }

  const targetCounts = [];
  (json.meshes || []).forEach((m, mi) => {
    stats.meshes++;
    targetCounts[mi] = 0;
    for (const p of m.primitives || []) {
      const pos = p.attributes && p.attributes.POSITION;
      if (!has(accs, pos)) { err(`mesh ${mi} has no POSITION`); continue; }
      const count = accs[pos].count;
      if (accs[pos].type !== 'VEC3' || !accs[pos].min || !accs[pos].max) err(`mesh ${mi} POSITION needs VEC3 with min/max`);
      for (const [name, ai] of Object.entries(p.attributes)) {
        if (!has(accs, ai)) err(`mesh ${mi} ${name} is missing`);
        else if (accs[ai].count !== count) err(`mesh ${mi} ${name} count differs from POSITION`);
      }
      if (!has(accs, p.indices)) { err(`mesh ${mi} has no indices`); continue; }
      const idx = readAccessor(glb, p.indices);
      if (idx.length % 3) err(`mesh ${mi} index count is not a multiple of 3`);
      for (let k = 0; k < idx.length; k++) if (idx[k] >= count) { err(`mesh ${mi} has an index outside its vertices`); break; }
      if (p.material !== undefined && !has(json.materials, p.material)) err(`mesh ${mi} has no material`);
      for (const t of p.targets || []) {
        if (!has(accs, t.POSITION) || accs[t.POSITION].count !== count) err(`mesh ${mi} has a morph target of the wrong size`);
      }
      targetCounts[mi] = (p.targets || []).length;
      if (m.weights && m.weights.length !== targetCounts[mi]) err(`mesh ${mi} weights do not match its morph targets`);
      stats.vertices += count;
      stats.triangles += idx.length / 3;
    }
  });

  const nodes = json.nodes || [];
  const parents = new Array(nodes.length).fill(0);
  nodes.forEach((n, i) => {
    stats.nodes++;
    if (n.mesh !== undefined && !has(json.meshes, n.mesh)) err(`node ${i} has no mesh`);
    for (const c of n.children || []) { if (!has(nodes, c) || c === i) err(`node ${i} has a bad child`); else parents[c]++; }
    if (n.rotation && Math.abs(Math.hypot(...n.rotation) - 1) > 1e-3) err(`node ${i} rotation is not a unit quaternion`);
  });
  if (parents.some((p) => p > 1)) err('a node has more than one parent');
  const scene = (json.scenes || [])[json.scene || 0];
  if (!scene || !scene.nodes || !scene.nodes.length) err('scene has no root nodes');
  else for (const r of scene.nodes) if (!has(nodes, r) || parents[r]) err('scene root is not a root node');

  (json.animations || []).forEach((a, ai) => {
    stats.animations++;
    for (const c of a.channels || []) {
      const s = (a.samplers || [])[c.sampler];
      if (!s || !has(accs, s.input) || !has(accs, s.output)) { err(`animation ${ai} has a broken sampler`); continue; }
      if (!c.target || !has(nodes, c.target.node)) { err(`animation ${ai} targets a missing node`); continue; }
      const type = PATH_TYPE[c.target.path];
      if (!type) { err(`animation ${ai} has an unknown path`); continue; }
      const input = accs[s.input], output = accs[s.output];
      if (!input.min || !input.max) err(`animation ${ai} time track needs min/max`);
      const times = readAccessor(glb, s.input);
      for (let k = 1; k < times.length; k++) if (!(times[k] > times[k - 1])) { err(`animation ${ai} times are not increasing`); break; }
      let per = 1;
      if (c.target.path === 'weights') {
        per = targetCounts[nodes[c.target.node].mesh] || 0;
        if (!per) err(`animation ${ai} animates weights on a node without morph targets`);
      }
      if (output.type !== type || output.count !== input.count * per) err(`animation ${ai} ${c.target.path} has the wrong number of keys`);
      if (c.target.path === 'rotation') {
        const q = readAccessor(glb, s.output);
        for (let k = 0; k < q.length; k += 4) if (Math.abs(Math.hypot(q[k], q[k + 1], q[k + 2], q[k + 3]) - 1) > 1e-3) { err(`animation ${ai} has a non-unit quaternion`); break; }
      }
    }
  });
  return { ok: errors.length === 0, errors, stats };
}
