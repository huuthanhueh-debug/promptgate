'use strict';
// Draws the Vision 6D launcher icon at build time so no binary lives in the repo: a dark
// rounded square, a cyan wireframe cube seen corner-on (a hexagon with three spokes: six
// edges for six axes) and a pink core. Pure Node PNG encoder (zlib + CRC32).
const zlib = require('zlib');
const { crc32 } = require('./zip');

// Android launcher densities: mdpi .. xxxhdpi.
const DENSITIES = Object.freeze({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 });

const BG = [5, 12, 20], CYAN = [53, 224, 255], PINK = [255, 79, 216];

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Colour + alpha of one sample point, in unit coordinates (0..1).
function shade(x, y) {
  const r = 0.2;
  const qx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0), qy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
  if (Math.hypot(qx, qy) > r) return null; // outside the rounded square
  const R = 0.33, verts = [];
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 2; verts.push([0.5 + R * Math.cos(a), 0.5 + R * Math.sin(a)]); }
  if (Math.hypot(x - 0.5, y - 0.5) < 0.075) return PINK;
  let d = Infinity;
  for (let i = 0; i < 6; i++) d = Math.min(d, segDist(x, y, verts[i][0], verts[i][1], verts[(i + 1) % 6][0], verts[(i + 1) % 6][1]));
  for (let i = 1; i < 6; i += 2) d = Math.min(d, segDist(x, y, 0.5, 0.5, verts[i][0], verts[i][1]));
  return d < 0.028 ? CYAN : BG;
}

function png(size) {
  const SS = 3; // 3x3 supersampling
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = row + 1 + x * 4;
      if (a) { raw[o] = Math.round(r / a); raw[o + 1] = Math.round(g / a); raw[o + 2] = Math.round(b / a); }
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { png, DENSITIES };
