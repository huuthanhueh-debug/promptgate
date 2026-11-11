'use strict';
// Vision 6D desktop tests: the GLB writer and checker, the extraction core (maps, layers, meshes,
// point cloud, timelines, the 3D / 4D / 6D models), the interface strings, the local server's
// file-writing rules and its defences, and the launcher. No browser needed.
// Run directly (node tests/desktop.js) or through tests/run.js (spawned as a child process).
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const throws = (fn) => { try { fn(); return false; } catch (_) { return true; } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-5);

(async () => {
  const G = await load('desktop/lib/glb.js');
  const X = await load('desktop/lib/extract.js');
  const STR = await load('desktop/strings.js');
  const SC = await load('core/scene.js');
  const THREE = await load('core/vendor/three.module.min.js');
  const icon = require(path.join(ROOT, 'android', 'icon.js'));
  const texture = new Uint8Array(icon.png(48));

  console.log('glb writer');
  {
    const tri = { name: 'tri', positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), uvs: new Float32Array([0, 1, 1, 1, 0, 0]), indices: new Uint32Array([0, 1, 2]), material: 0 };
    const sharedTimes = new Float32Array([0, 1]);
    const doc = {
      images: [{ bytes: texture, mime: 'image/png' }], materials: [{ name: 'photo', image: 0, unlit: true, doubleSided: true }],
      meshes: [Object.assign({}, tri, { targets: [{ name: 'up', positions: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]) }] })],
      nodes: [{ name: 'root', children: [1] }, { name: 'child', mesh: 0, translation: [0, 0, 0] }], roots: [0],
      animations: [{ name: 'a', channels: [
        { node: 1, path: 'weights', times: sharedTimes, values: new Float32Array([0, 1]) },
        { node: 0, path: 'rotation', times: sharedTimes, values: new Float32Array([0, 0, 0, 1, 0, 1, 0, 0]) },
      ] }],
      extras: { hello: 'xin chào' },
    };
    const bytes = G.buildGlb(doc);
    const dv = new DataView(bytes.buffer);
    check('GLB header: magic "glTF", version 2, length = file size', dv.getUint32(0, true) === 0x46546c67 && dv.getUint32(4, true) === 2 && dv.getUint32(8, true) === bytes.length);
    check('both chunks are 4-byte aligned', dv.getUint32(12, true) % 4 === 0 && bytes.length % 4 === 0);
    const glb = G.parseGlb(bytes);
    const j = glb.json;
    check('JSON round-trips, including non-ASCII extras', j.asset.version === '2.0' && j.scenes[0].extras.hello === 'xin chào' && j.nodes[0].children[0] === 1);
    check('POSITION carries min/max', j.accessors[j.meshes[0].primitives[0].attributes.POSITION].min.join() === '0,0,0' && j.accessors[j.meshes[0].primitives[0].attributes.POSITION].max.join() === '1,1,0');
    check('vertex data round-trips bit for bit', Array.from(G.readAccessor(glb, j.meshes[0].primitives[0].attributes.TEXCOORD_0)).join() === Array.from(tri.uvs).join() && Array.from(G.readAccessor(glb, j.meshes[0].primitives[0].indices)).join() === '0,1,2');
    const imgView = j.bufferViews[j.images[0].bufferView];
    check('the texture is embedded unchanged', Buffer.from(glb.bin.subarray(imgView.byteOffset, imgView.byteOffset + imgView.byteLength)).equals(Buffer.from(texture)) && j.images[0].mimeType === 'image/png');
    check('unlit material declares its extension', j.extensionsUsed.join() === 'KHR_materials_unlit' && 'KHR_materials_unlit' in j.materials[0].extensions && j.materials[0].doubleSided === true);
    check('morph target and weights are written', j.meshes[0].primitives[0].targets.length === 1 && j.meshes[0].weights.join() === '0' && j.meshes[0].extras.targetNames.join() === 'up');
    check('channels sharing a time track share one accessor', j.animations[0].samplers[0].input === j.animations[0].samplers[1].input);
    const c = G.checkGlb(bytes);
    check('checkGlb accepts it and counts it', c.ok && c.stats.meshes === 1 && c.stats.nodes === 2 && c.stats.triangles === 1 && c.stats.animations === 1 && c.stats.images === 1, c.errors.join('; '));
    check('reading works when the file comes in as a Node Buffer', G.checkGlb(Buffer.from(bytes)).ok && G.checkGlb(Buffer.concat([Buffer.alloc(3), Buffer.from(bytes)]).subarray(3)).ok);
    check('checkGlb rejects truncated, padded and non-GLB data', !G.checkGlb(bytes.subarray(0, bytes.length - 8)).ok && !G.checkGlb(new Uint8Array(40)).ok && !G.checkGlb(Buffer.from('hello world, definitely not a glb')).ok);
    const badIndex = G.buildGlb(Object.assign({}, doc, { meshes: [Object.assign({}, tri, { indices: new Uint32Array([0, 1, 7]) })], animations: [] }));
    check('checkGlb catches an index outside the vertex buffer', G.checkGlb(badIndex).errors.some((e) => /index outside/.test(e)));
    const badQuat = G.buildGlb(Object.assign({}, doc, { animations: [{ channels: [{ node: 0, path: 'rotation', times: new Float32Array([0, 1]), values: new Float32Array([0, 0, 0, 1, 0, 2, 0, 0]) }] }] }));
    check('checkGlb catches a non-unit quaternion', G.checkGlb(badQuat).errors.some((e) => /quaternion/.test(e)));
    const badTimes = G.buildGlb(Object.assign({}, doc, { animations: [{ channels: [{ node: 0, path: 'translation', times: new Float32Array([1, 1]), values: new Float32Array(6) }] }] }));
    check('checkGlb catches time keys that do not increase', G.checkGlb(badTimes).errors.some((e) => /increasing/.test(e)));
    const nan = G.buildGlb(Object.assign({}, doc, { meshes: [Object.assign({}, tri, { positions: new Float32Array([0, 0, 0, NaN, 0, 0, 0, 1, 0]) })], animations: [] }));
    check('checkGlb catches NaN coordinates', !G.checkGlb(nan).ok);
    check('buildGlb refuses mismatched inputs', throws(() => G.buildGlb({ meshes: [Object.assign({}, tri, { normals: new Float32Array(6) })] })) && throws(() => G.buildGlb({ meshes: [Object.assign({}, tri, { indices: new Uint32Array([0, 1]) })], materials: [{}] })) && throws(() => G.buildGlb({ meshes: [tri] })) && throws(() => G.buildGlb({ images: [{ bytes: texture, mime: 'image/gif' }] })) && throws(() => G.buildGlb({ materials: [{}], meshes: [tri], nodes: [{}], roots: [0], animations: [{ channels: [{ node: 5, path: 'translation', times: new Float32Array(1), values: new Float32Array(3) }] }] })));
  }

  console.log('maps and geometry');
  const dw = 24, dh = 18;
  const ramp = Float32Array.from({ length: dw * dh }, (_, i) => (i % dw) / (dw - 1)); // far on the left, near on the right
  {
    check('planeSize keeps the aspect with the longest side at 1', JSON.stringify(X.planeSize(400, 200)) === '{"w":1,"h":0.5}' && JSON.stringify(X.planeSize(200, 400, 2)) === '{"w":1,"h":2}');
    check('gridSize puts `detail` samples on the long side and clamps', JSON.stringify(X.gridSize(640, 360, 256)) === '{"dw":256,"dh":144}' && X.gridSize(100, 100, 9999).dw === 512 && X.gridSize(100, 100, 1).dw === 32 && X.gridSize(4000, 2, 64).dh === 2);
    const inv = X.invertDepth(ramp);
    check('invertDepth flips near and far without touching the input', near(inv[0], 1) && near(inv[dw - 1], 0) && ramp[0] === 0);
    const gray = new Uint8ClampedArray(4 * 4 * 4); for (let i = 0; i < 16; i++) { gray[i * 4] = gray[i * 4 + 1] = gray[i * 4 + 2] = 50 + i * 10; gray[i * 4 + 3] = 255; }
    const fromGray = X.depthFromGray(gray, 4, 4);
    check('a supplied depth image is stretched to the full 0..1 range', near(fromGray[0], 0) && near(fromGray[15], 1) && fromGray[5] > fromGray[4]);
    check('a flat supplied depth image becomes 0.5 everywhere', X.depthFromGray(new Uint8ClampedArray(64).fill(90), 4, 4).every((v) => v === 0.5) && throws(() => X.depthFromGray(new Uint8ClampedArray(8), 4, 4)));
    const dr = X.depthToRgba(ramp);
    check('depthToRgba: opaque grey, black far, white near', dr[0] === 0 && dr[3] === 255 && dr[(dw - 1) * 4] === 255 && dr[(dw - 1) * 4 + 1] === 255);
    const flatN = X.normalMapRgba(new Float32Array(dw * dh).fill(0.4), dw, dh);
    check('normal map of a flat surface is the neutral (128,128,255)', flatN[0] === 128 && flatN[1] === 128 && flatN[2] === 255 && flatN[3] === 255);
    const rampN = X.normalMapRgba(ramp, dw, dh, { planeW: 1, planeH: 0.75, strength: 0.5 });
    const mid = (9 * dw + 12) * 4;
    check('a surface rising to the right tilts normals to the left (red below 128), not up or down', rampN[mid] < 110 && rampN[mid + 1] === 128 && rampN[mid + 2] > 128);

    const g = X.reliefGrid(ramp, dw, dh, { planeW: 1, planeH: 0.75, strength: 0.5 });
    check('grid: one vertex per sample, two triangles per cell', g.positions.length === dw * dh * 3 && g.indices.length === (dw - 1) * (dh - 1) * 6);
    const last = (dw * dh - 1) * 3;
    check('grid spans the plane, top-left first, z = depth * strength', near(g.positions[0], -0.5) && near(g.positions[1], 0.375) && g.positions[2] === 0 && near(g.positions[last], 0.5) && near(g.positions[last + 1], -0.375) && near(g.positions[last + 2], 0.5));
    check('uv (0,0) is the top-left corner of the photo', g.uvs[0] === 0 && g.uvs[1] === 0 && g.uvs[(dw * dh - 1) * 2] === 1 && g.uvs[(dw * dh - 1) * 2 + 1] === 1);
    const P = (i) => g.positions.subarray(i * 3, i * 3 + 3);
    let ccw = true;
    for (let t = 0; t < g.indices.length; t += 3) {
      const a = P(g.indices[t]), b = P(g.indices[t + 1]), c = P(g.indices[t + 2]);
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 0) { ccw = false; break; }
    }
    check('every triangle is counter-clockwise seen from the front', ccw);
    let unit = true, facing = true;
    for (let i = 0; i < dw * dh; i++) { const n = g.normals.subarray(i * 3, i * 3 + 3); if (!near(Math.hypot(n[0], n[1], n[2]), 1, 1e-4)) unit = false; if (n[2] <= 0) facing = false; }
    check('normals are unit length and face the viewer', unit && facing);
    check('normals lean away from the rising side', g.normals[(9 * dw + 12) * 3] < -0.2 && near(g.normals[(9 * dw + 12) * 3 + 1], 0));
    check('geometry rejects a depth map of the wrong size', throws(() => X.reliefGrid(new Float32Array(7), dw, dh)) && throws(() => X.reliefGrid(ramp, 1, dh)) && throws(() => X.pointCloud(new Uint8ClampedArray(4), ramp, dw, dh)));
  }

  console.log('layers');
  {
    const n = 4;
    const layers = X.layerGrids(ramp, dw, dh, n, { planeW: 1, planeH: 0.75, strength: 0.5 });
    const tris = layers.reduce((s, l) => s + (l ? l.indices.length / 3 : 0), 0);
    check('the layers together hold every triangle of the relief exactly once', layers.length === n && tris === (dw - 1) * (dh - 1) * 2);
    const zRange = layers.map((l) => { let lo = Infinity, hi = -Infinity; for (let i = 2; i < l.positions.length; i += 3) { lo = Math.min(lo, l.positions[i]); hi = Math.max(hi, l.positions[i]); } return [lo, hi]; });
    check('layers are ordered far to near', zRange.every((r, i) => i === 0 || r[1] > zRange[i - 1][1]) && zRange[0][0] === 0 && near(zRange[n - 1][1], 0.5), JSON.stringify(zRange));
    check('each layer mesh is self-contained (indices stay inside its own vertices)', layers.every((l) => l.indices.every((v) => v < l.positions.length / 3) && l.uvs.length / 2 === l.positions.length / 3));
    const two = X.layerGrids(new Float32Array(dw * dh).fill(0.1), dw, dh, 5);
    check('depths that are never used give null layers, not empty meshes', two[0] !== null && two.slice(1).every((l) => l === null));
    check('layer count is clamped to 2..12', X.layerGrids(ramp, dw, dh, 1).length === 2 && X.layerGrids(ramp, dw, dh, 99).length === 12);

    const w = 8, h = 4, img = new Uint8ClampedArray(w * h * 4), dep = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { img.set([10 + i, 20, 30, i === 5 ? 128 : 255], i * 4); dep.set([Math.round(((i % w) / (w - 1)) * 255), 0, 0, 255], i * 4); }
    const parts = [0, 1, 2, 3].map((i) => X.layerRgba(img, dep, w, h, 4, i));
    check('every pixel lands in exactly one layer', parts.reduce((s, p) => s + p.pixels, 0) === w * h && parts.every((p) => p.pixels === 8));
    let exact = true;
    for (let i = 0; i < w * h; i++) {
      const owners = parts.filter((p) => p.rgba[i * 4 + 3] !== 0);
      if (owners.length !== 1 || owners[0].rgba[i * 4] !== img[i * 4] || owners[0].rgba[i * 4 + 3] !== img[i * 4 + 3]) exact = false;
    }
    check('layers keep colour and alpha where they own a pixel and are transparent elsewhere', exact && parts[0].rgba[(w - 1) * 4 + 3] === 0);
    check('layerRgba rejects mismatched buffers', throws(() => X.layerRgba(img, new Uint8ClampedArray(4), w, h, 4, 0)));
  }

  console.log('point cloud');
  {
    const rgba = new Uint8ClampedArray(dw * dh * 4); for (let i = 0; i < dw * dh; i++) rgba.set([i % 256, (i * 3) % 256, 200, 255], i * 4);
    const cloud = X.pointCloud(rgba, ramp, dw, dh, { planeW: 1, planeH: 0.75, strength: 0.5 });
    const ply = X.writePly(cloud);
    const text = Buffer.from(ply.subarray(0, 220)).toString('latin1');
    check('PLY header declares six properties per vertex', text.startsWith('ply\nformat binary_little_endian 1.0\n') && /element vertex 432\n/.test(text) && ['float x', 'float y', 'float z', 'uchar red', 'uchar green', 'uchar blue'].every((p) => text.includes('property ' + p)));
    const back = X.parsePly(ply);
    check('PLY round-trips positions and colours', back.count === dw * dh && back.properties.join() === 'x,y,z,red,green,blue' && back.positions.every((v, i) => v === cloud.positions[i]) && back.colors.every((v, i) => v === cloud.colors[i]));
    check('points sit on the relief and carry the pixel colour', near(back.positions[2], 0) && near(back.positions[(dw - 1) * 3 + 2], 0.5) && back.colors[3] === 1 && back.colors[4] === 3 && back.colors[5] === 200);
    check('PLY works from a Node Buffer and rejects damage', X.parsePly(Buffer.from(ply)).count === dw * dh && throws(() => X.parsePly(ply.subarray(0, ply.length - 1))) && throws(() => X.parsePly(Buffer.from('nope'))) && throws(() => X.writePly({ positions: new Float32Array(6), colors: new Uint8Array(3) })));
    check('a comment cannot break out of the header', !Buffer.from(X.writePly(cloud, 'a\nend_header\nb')).subarray(0, 120).toString('latin1').includes('a\nend_header'));
  }

  console.log('timelines');
  {
    const a = X.state4d(0), b = X.state4d(2), c = X.state4d(4), d = X.state4d(1);
    check('4D: starts flat, emerges, tears down', a.flatten === 1 && a.teardown === 0 && b.flatten === 0 && b.teardown === 0 && c.teardown === 1 && near(d.flatten, 0.5));
    check('4D loops every 8 seconds (also for negative time)', near(X.state4d(9).flatten, X.state4d(1).flatten) && near(X.state4d(-7).flatten, X.state4d(1).flatten) && X.state4d(8).flatten === 1);
    check('6D: layers spread over 3 s, stay spread during the tour, close at the end', X.state6d(0).spread === 0 && near(X.state6d(1.5).spread, 0.5) && X.state6d(9).spread === 1 && near(X.state6d(16.5).spread, 0.5));
    const axes = ['yaw', 'pitch', 'roll', 'x', 'y', 'z'];
    const used = axes.map((_, i) => { const p = X.state6d(3 + i * 2 + 0.5).pose; return axes.filter((k) => Math.abs(p[k]) > 1e-9); });
    check('6D: each of the six axes is exercised alone, in order J1..J6', used.every((u, i) => u.length === 1 && u[0] === axes[i]), JSON.stringify(used));
    check('6D: the pose is neutral before and after the tour', axes.every((k) => X.state6d(1).pose[k] === 0 && X.state6d(16).pose[k] === 0));
    const q = X.quatFromEulerYXZ(0.3, -1.1, 0.7);
    const ref = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -1.1, 0.7, 'YXZ'));
    check('quaternion maths matches three.js (YXZ order)', near(q[0], ref.x) && near(q[1], ref.y) && near(q[2], ref.z) && near(q[3], ref.w) && near(Math.hypot(...q), 1));
  }

  console.log('3D / 4D / 6D models');
  const input = { name: 'ảnh', width: 400, height: 300, depth: ramp, dw, dh, textureBytes: texture, textureMime: 'image/png', strength: 0.5, layers: 4 };
  {
    const b3 = X.build3dGlb(input), c3 = G.checkGlb(b3), j3 = G.parseGlb(b3).json;
    check('3D model is valid: one textured mesh, no animation', c3.ok && c3.stats.meshes === 1 && c3.stats.vertices === dw * dh && c3.stats.animations === 0 && c3.stats.images === 1 && j3.nodes[0].name === 'ảnh' && j3.scenes[0].extras.vision6d.kind === '3d', c3.errors.join('; '));
    const pos3 = j3.accessors[j3.meshes[0].primitives[0].attributes.POSITION];
    check('3D model: longest side is 1 unit, depth up to the chosen strength', near(pos3.max[0] - pos3.min[0], 1) && near(pos3.max[1] - pos3.min[1], 0.75) && near(pos3.max[2], 0.5) && pos3.min[2] === 0);

    const b4 = X.build4dGlb(input), c4 = G.checkGlb(b4), g4 = G.parseGlb(b4), j4 = g4.json;
    check('4D model is valid and animated', c4.ok && c4.stats.animations === 1, c4.errors.join('; '));
    const prim = j4.meshes[0].primitives[0];
    const base = G.readAccessor(g4, prim.attributes.POSITION), flat = G.readAccessor(g4, prim.targets[0].POSITION), tear = G.readAccessor(g4, prim.targets[1].POSITION);
    let flatOk = true, tearOk = true, steps = new Set();
    for (let i = 0; i < dw * dh; i++) {
      if (!near(base[i * 3 + 2] + flat[i * 3 + 2], 0) || flat[i * 3] !== 0 || flat[i * 3 + 1] !== 0) flatOk = false;
      if (tear[i * 3] !== 0 || tear[i * 3 + 1] !== 0 || tear[i * 3 + 2] < 0) tearOk = false;
      steps.add(tear[i * 3 + 2].toFixed(4));
    }
    check('4D "flatten" at weight 1 presses the relief back into the flat photo', flatOk);
    check('4D "teardown" moves the four layers to four z offsets', tearOk && steps.size === 4, [...steps].join());
    const s4 = j4.animations[0].samplers[0];
    check('4D weights track: 5 keys x 2 targets, 0..8 s, first key = last key', Array.from(G.readAccessor(g4, s4.input)).join() === '0,2,4,6,8' && Array.from(G.readAccessor(g4, s4.output)).join() === '1,0,0,0,0,1,0,0,1,0' && j4.meshes[0].weights.join() === '1,0');

    const b6 = X.build6dGlb(input), c6 = G.checkGlb(b6), g6 = G.parseGlb(b6), j6 = g6.json;
    check('6D model is valid: 4 layer nodes under one stack node, all triangles kept', c6.ok && c6.stats.meshes === 4 && c6.stats.nodes === 5 && c6.stats.triangles === c3.stats.triangles && j6.nodes[0].children.length === 4 && j6.nodes.slice(1).map((n) => n.name).join() === 'layer-1,layer-2,layer-3,layer-4', c6.errors.join('; '));
    const ch = j6.animations[0].channels, sm = j6.animations[0].samplers;
    const track = (node, p) => G.readAccessor(g6, sm[ch.find((c) => c.target.node === node && c.target.path === p).sampler].output);
    const times = G.readAccessor(g6, sm[0].input);
    check('6D timeline: 73 keys from 0 to 18 s', times.length === 73 && times[0] === 0 && times[72] === 18);
    const rot = track(0, 'rotation'), tra = track(0, 'translation');
    let rotMoved = false, traAxes = [false, false, false];
    for (let k = 0; k < 73; k++) { if (Math.abs(rot[k * 4 + 3]) < 0.999) rotMoved = true; for (let a = 0; a < 3; a++) if (Math.abs(tra[k * 3 + a]) > 0.05) traAxes[a] = true; }
    check('6D stack really rotates and really translates on x, y and z', rotMoved && traAxes.every(Boolean), JSON.stringify(traAxes));
    check('6D animation loops seamlessly (last key = first key)', [0, 1, 2, 3].every((i) => rot[72 * 4 + i] === rot[i]) && [0, 1, 2].every((i) => tra[72 * 3 + i] === tra[i]));
    const zAt = (node, k) => track(node, 'translation')[k * 3 + 2];
    check('6D layers spread in order, the far layer stays put, and they close again', zAt(1, 36) === 0 && zAt(2, 36) > 0 && zAt(3, 36) > zAt(2, 36) && zAt(4, 36) > zAt(3, 36) && [1, 2, 3, 4].every((nd) => zAt(nd, 0) === 0 && zAt(nd, 72) === 0));
    check('6D declares its six axes', j6.scenes[0].extras.vision6d.axes.join() === 'J1 yaw,J2 pitch,J3 roll,J4 x,J5 y,J6 z');

    // Anatomy: real three.js geometry, converted the way the app does it.
    const figure = SC.buildAnatomy(THREE);
    figure.updateMatrixWorld(true);
    const parts = [];
    figure.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      parts.push({ name: m.name, system: m.userData.part.system, positions: new Float32Array(g.attributes.position.array), normals: new Float32Array(g.attributes.normal.array), indices: Uint32Array.from(g.index.array), color: [m.material.color.r, m.material.color.g, m.material.color.b] });
    });
    const ba = X.buildAnatomyGlb(parts, 'anatomy'), ca = G.checkGlb(ba), ja = G.parseGlb(ba).json;
    check('anatomy model is valid: 83 parts grouped under skeleton / organs / vessels', ca.ok && ca.stats.meshes === 83 && ja.nodes[0].children.map((c) => ja.nodes[c].name).join() === 'skeleton,organs,vessels' && ja.nodes.some((n) => n.name === 'heart') && ja.nodes.some((n) => n.name === 'femurL'), ca.errors.join('; '));
    check('anatomy parts share materials by colour and carry no texture', ja.materials.length < 20 && !ja.images && ca.stats.images === 0);
  }

  console.log('names and manifest');
  {
    const cases = [['ảnh gia đình (1).png', 'ảnh gia đình 1'], ['../../etc/passwd', 'etc passwd'], ['a<b>:c|d?.jpeg', 'a b c d'], ['   ..hidden..  ', 'hidden'], ['CON.png', '_CON'], ['', 'image'], ['???.png', 'image'], ['x'.repeat(200) + '.png', 'x'.repeat(80)], ['photo.final.v2.webp', 'photo.final.v2']];
    const got = cases.map(([a]) => X.sanitizeName(a));
    check('names are made filesystem-safe and keep Vietnamese letters', cases.every(([, want], i) => got[i] === want), JSON.stringify(got));
    check('no sanitised name can leave its folder', got.every((g) => !/[\\/:*?"<>|]/.test(g) && !g.startsWith('.') && !g.endsWith('.') && !g.endsWith(' ')));
    const m = X.buildManifest({ sourceName: 'a.jpg', width: 400, height: 300, dw, dh, strength: 0.5, layers: 4, person: { isPerson: true, score: 0.9 }, files: [{ path: 'model-3d.glb', bytes: 10, what: '3D' }], created: '2026-01-01T00:00:00.000Z' });
    check('manifest records source, settings, person, files and what 4D / 6D mean', m.app === 'Vision 6D' && m.source.width === 400 && m.settings.grid.join() === '24,18' && m.settings.detail === 24 && m.person.detected === true && m.files.length === 1 && /time/.test(m.definitions['4d']) && /Six degrees of freedom/.test(m.definitions['6d']) && m.created === '2026-01-01T00:00:00.000Z');
  }

  console.log('languages (vi / en)');
  {
    const vi = Object.keys(STR.STRINGS.vi).sort(), en = Object.keys(STR.STRINGS.en).sort();
    const VI_CHARS = /[\u00c0-\u1ef9]/;
    check('Vietnamese and English tables have the same keys', vi.join() === en.join() && vi.length > 50);
    check('no string is empty', ['vi', 'en'].every((l) => Object.values(STR.STRINGS[l]).every((v) => typeof v === 'string' && v.trim())));
    const leaked = Object.entries(STR.STRINGS.en).filter(([k, v]) => k !== 'lang.switchLabel' && VI_CHARS.test(v.replace(/—/g, '')));
    check('English strings contain no Vietnamese text', leaked.length === 0, leaked.map(([k]) => k).join());
    const same = vi.filter((k) => STR.STRINGS.vi[k] === STR.STRINGS.en[k] && !/^view\.(3d|4d|6d)$|^maps\.(depth|normal)$/.test(k));
    check('every string is actually translated', same.length === 0, same.join());
    check('t() fills placeholders in both languages', STR.t('vi', 'maps.layer', { n: 3 }) === 'Lớp 3' && STR.t('en', 'maps.layer', { n: 3 }) === 'Layer 3' && STR.t('en', 'msg.saved', { count: 12, dir: 'D:\\out' }) === 'Saved 12 files to D:\\out');
    const html = fs.readFileSync(path.join(ROOT, 'desktop', 'index.html'), 'utf8');
    const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
    check('every data-i18n key in the window exists in both tables', keys.length > 35 && keys.every((k) => k in STR.STRINGS.vi && k in STR.STRINGS.en), keys.filter((k) => !(k in STR.STRINGS.vi)).join());
    check('the window hard-codes no Vietnamese text', !VI_CHARS.test(html.slice(html.indexOf('<body>'))));
    const app = fs.readFileSync(path.join(ROOT, 'desktop', 'app.js'), 'utf8');
    const used = [...app.matchAll(/tr\('([a-z]+\.[A-Za-z0-9.]+)'/g)].map((m) => m[1]);
    check('every string key the script uses exists', used.length > 10 && used.every((k) => k in STR.STRINGS.en), used.filter((k) => !(k in STR.STRINGS.en)).join());
    check('status keys exist for every item state', ['queued', 'working', 'done', 'error'].every((s) => 'status.' + s in STR.STRINGS.vi));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const looked = [...new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]))];
    check('every element id the script looks up exists in the window', looked.length > 20 && looked.every((i) => ids.includes(i)), looked.filter((i) => !ids.includes(i)).join());
    const own = ['desktop/index.html', 'desktop/app.js', 'desktop/strings.js', 'desktop/lib/glb.js', 'desktop/lib/extract.js'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    const remote = (own.match(/https?:\/\/[^\s'"`)]+/g) || []);
    check('the window references no remote URL (works offline)', remote.length === 0, remote.join());
  }

  console.log('local server');
  {
    const S = require(path.join(ROOT, 'tools', 'server.js'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v6d-server-'));
    const outDir = path.join(tmp, 'out');
    const opened = []; let byes = 0;
    const app = await S.createApp({ outDir, opener: (d) => opened.push(d), onBye: () => { byes++; } });
    const req = (method, p, o) => new Promise((resolve, reject) => {
      o = o || {};
      const headers = Object.assign({ host: `127.0.0.1:${app.port}` }, o.token === false ? {} : { 'x-v6d-token': o.token || app.token }, o.headers);
      const r = http.request({ host: '127.0.0.1', port: app.port, method, path: p, headers }, (res) => {
        const chunks = []; res.on('data', (c) => chunks.push(c));
        res.on('end', () => { const body = Buffer.concat(chunks); let json = null; try { json = JSON.parse(body.toString('utf8')); } catch (_) { /* not json */ } resolve({ status: res.statusCode, headers: res.headers, body, json }); });
      });
      r.on('error', reject);
      if (o.body !== undefined) r.write(o.body);
      r.end();
    });

    check('listens on 127.0.0.1 only and puts the token in the URL fragment', app.server.address().address === '127.0.0.1' && app.url === `http://127.0.0.1:${app.port}/desktop/index.html#t=${app.token}` && app.token.length >= 32);
    const root = await req('GET', '/', { token: false });
    check('/ redirects to the app window', root.status === 302 && root.headers.location === '/desktop/index.html');
    const page = await req('GET', '/desktop/index.html', { token: false });
    check('the window is served with a strict CSP and nosniff', page.status === 200 && /default-src 'self'/.test(page.headers['content-security-policy']) && !/https?:|\*/.test(page.headers['content-security-policy']) && page.headers['x-content-type-options'] === 'nosniff' && /Vision 6D/.test(page.body.toString()));
    const mod = await req('GET', '/core/depth.js', { token: false });
    check('shared modules are served as JavaScript', mod.status === 200 && /^text\/javascript/.test(mod.headers['content-type']) && (await req('GET', '/core/vendor/three.module.min.js', { token: false })).status === 200);
    const blocked = ['/tools/server.js', '/app.json', '/tests/desktop.js', '/android/zip.js', '/desktop/package.json', '/desktop/..%2Ftools/server.js', '/desktop/../tools/server.js', '/core/%2e%2e/tools/server.js', '/desktop/lib', '/desktop/%00.js', '/../../etc/passwd', '/desktop/nope.js'];
    const blockedStatus = [];
    for (const b of blocked) blockedStatus.push((await req('GET', b, { token: false })).status);
    check('nothing outside core/ and desktop/ is readable, traversal included', blockedStatus.every((s) => s === 404 || s === 400), blocked.map((b, i) => b + '=' + blockedStatus[i]).join(' '));
    check('a foreign Host header is refused (DNS rebinding)', (await req('GET', '/desktop/index.html', { token: false, headers: { host: 'evil.example:' + app.port } })).status === 403 && (await req('GET', '/api/info', { headers: { host: 'evil.example' } })).status === 403);
    check('localhost is accepted as a host name too', (await req('GET', '/api/info', { headers: { host: `localhost:${app.port}` } })).status === 200);
    check('API calls without the token, or with a wrong one, are refused', (await req('GET', '/api/info', { token: false })).status === 403 && (await req('GET', '/api/info', { token: 'x'.repeat(48) })).status === 403 && (await req('POST', '/api/begin', { token: false, body: '{"name":"a"}' })).status === 403);
    check('API calls from another origin are refused even with the token', (await req('GET', '/api/info', { headers: { origin: 'https://evil.example' } })).status === 403 && (await req('GET', '/api/info', { headers: { origin: `http://127.0.0.1:${app.port}` } })).status === 200);
    const info = await req('GET', '/api/info');
    check('info reports the output folder and version', info.json.outDir === outDir && info.json.app === 'Vision 6D' && /^\d+\.\d+\.\d+$/.test(info.json.version));
    check('nothing is created on disk until an extraction begins', !fs.existsSync(outDir));

    const b1 = await req('POST', '/api/begin', { body: JSON.stringify({ name: 'ảnh gia đình' }) });
    const b2 = await req('POST', '/api/begin', { body: JSON.stringify({ name: 'ảnh gia đình' }) });
    const b3 = await req('POST', '/api/begin', { body: JSON.stringify({ name: '../../escape<>' }) });
    check('begin creates a fresh folder each time, never reusing or escaping', b1.json.dir === 'ảnh gia đình' && b2.json.dir === 'ảnh gia đình-2' && b3.json.dir === 'escape' && [b1, b2, b3].every((b) => fs.statSync(path.join(outDir, b.json.dir)).isDirectory() && path.dirname(b.json.path) === outDir));
    const put = (dir, rel, body) => req('PUT', `/api/file?dir=${encodeURIComponent(dir)}&path=${encodeURIComponent(rel)}`, { body: body === undefined ? Buffer.from('data') : body });
    const data = Buffer.from([0, 1, 2, 250, 251, 252]);
    const ok1 = await put(b1.json.dir, 'model-3d.glb', data), ok2 = await put(b1.json.dir, 'layers/layer-1.png', data);
    check('files are written byte for byte, sub-folder included', ok1.status === 200 && ok1.json.bytes === 6 && fs.readFileSync(path.join(outDir, b1.json.dir, 'model-3d.glb')).equals(data) && ok2.status === 200 && fs.readFileSync(path.join(outDir, b1.json.dir, 'layers', 'layer-1.png')).equals(data));
    const badPaths = ['../x.png', 'a/../../x.png', '/etc/x.png', 'a/b/c.png', '.hidden.png', 'run.exe', 'evil.js', 'x.html', 'noext', 'a\\b.png', 'layers/', '', 'x.png/..', 'CON', 'ok.png\u0000.exe'];
    const badStatus = [];
    for (const b of badPaths) badStatus.push((await put(b1.json.dir, b)).status);
    check('paths that climb out, nest too deep, hide, or use other extensions are refused', badStatus.every((s) => s === 400), badPaths.map((b, i) => JSON.stringify(b) + '=' + badStatus[i]).join(' '));
    fs.mkdirSync(path.join(outDir, 'old-run'));
    check('only folders begun in this run can be written to', (await put('old-run', 'a.png')).status === 400 && (await put('..', 'a.png')).status === 400 && (await put('', 'a.png')).status === 400 && (await put(b1.json.dir + '/../old-run', 'a.png')).status === 400 && fs.readdirSync(path.join(outDir, 'old-run')).length === 0);
    const all = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else all.push(path.relative(tmp, f).split(path.sep).join('/')); } })(tmp);
    check('after all those attempts the only files on disk are the two legitimate ones', all.sort().join('|') === ['out/ảnh gia đình/layers/layer-1.png', 'out/ảnh gia đình/model-3d.glb'].sort().join('|'), all.join('|'));
    check('an oversized request body is cut off', (await req('POST', '/api/begin', { body: Buffer.alloc(200 * 1024, 0x61) }).catch(() => ({ status: 413 }))).status === 413);
    check('a malformed begin request is a 400, not a crash', (await req('POST', '/api/begin', { body: '{not json' })).status === 400 && (await req('GET', '/api/info')).status === 200);

    await req('POST', '/api/open', { body: JSON.stringify({ dir: b2.json.dir }) });
    await req('POST', '/api/open', { body: JSON.stringify({ dir: '../../..' }) });
    await req('POST', '/api/open', { body: '' });
    check('open only ever opens the output folder or a folder from this run', opened.length === 3 && opened[0] === path.join(outDir, b2.json.dir) && opened[1] === outDir && opened[2] === outDir, JSON.stringify(opened));
    check('goodbye needs the token (in the query, since beacons carry no headers)', (await req('POST', '/api/bye', { token: false })).status === 403 && byes === 0 && (await req('POST', '/api/bye?t=' + app.token, { token: false })).status === 200 && byes === 1);
    check('unknown API routes are 404', (await req('GET', '/api/nope')).status === 404 && (await req('DELETE', '/api/file')).status === 404);
    check('name and path helpers agree with the page', S.safeName('ảnh gia đình (1)') === 'ảnh gia đình 1' && S.safeName('NUL') === '_NUL' && S.safeRelPath('layers/layer-12.png').join('/') === 'layers/layer-12.png' && S.safeRelPath('scene.json') !== null && S.safeRelPath('a/b/c.png') === null);
    await app.close();
    fs.rmSync(tmp, { recursive: true, force: true });

    const two = await Promise.all([S.createApp({ outDir: tmp, opener() {} }), S.createApp({ outDir: tmp, opener() {} })]);
    check('each launch gets its own port and its own token', two[0].port !== two[1].port && two[0].token !== two[1].token);
    await Promise.all(two.map((a) => a.close()));
  }

  console.log('launcher');
  {
    const D = require(path.join(ROOT, 'tools', 'desktop.js'));
    const a = D.parseArgs(['--out', 'D:\\Anh 6D', '--port', '8123', '--browser', '--no-open']);
    check('launcher options are parsed', a.outDir === 'D:\\Anh 6D' && a.port === 8123 && a.appWindow === false && a.open === false && !a.unknown);
    const d = D.parseArgs([]);
    check('defaults: app window, free port, Vision6D folder in the home directory', d.open && d.appWindow && d.port === 0 && d.outDir === path.join(os.homedir(), 'Vision6D'));
    check('unknown options are reported, not ignored', D.parseArgs(['--frobnicate']).unknown === '--frobnicate' && D.parseArgs(['--help']).help === true);
    const url = 'http://127.0.0.1:5000/desktop/index.html#t=abc';
    const win = D.openCommand(url, true, 'win32'), winTab = D.openCommand(url, false, 'win32');
    check('Windows opens an Edge app window, or the default browser with --browser', win[0] === 'cmd.exe' && win[1].includes('msedge') && win[1].includes('--app=' + url) && !winTab[1].includes('msedge') && winTab[1][winTab[1].length - 1] === url);
    check('macOS and Linux use their standard openers', D.openCommand(url, true, 'darwin').slice(0, 2).join() === 'open,' + url && D.openCommand(url, true, 'linux')[0] === 'xdg-open');
    check('the launch URL has nothing a Windows shell would split on', !/[&|<>^ "]/.test(url));
    check('double-click launchers exist for Windows and for macOS/Linux', /tools\\desktop\.js/.test(fs.readFileSync(path.join(ROOT, 'Vision6D.cmd'), 'utf8')) && /tools\/desktop\.js/.test(fs.readFileSync(path.join(ROOT, 'vision6d.sh'), 'utf8')));
    check('end-to-end browser test is present', fs.existsSync(path.join(ROOT, 'tests', 'desktop-e2e.js')));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('  FAIL crashed → ' + (e && e.stack || e));
  console.log(`\n${pass} passed, ${fail + 1} failed`);
  process.exit(1);
});
