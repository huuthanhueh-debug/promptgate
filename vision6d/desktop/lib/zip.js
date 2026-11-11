// Store-only zip writer for the browser (no compression: the exported files are already
// compressed or binary). Names are UTF-8. Pure JS over typed arrays, runs in Node as well.

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
export function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// entries: [{ name: 'folder/file.glb', data: Uint8Array }] -> Uint8Array of the whole archive.
export function writeStoredZip(entries) {
  if (entries.length > 0xffff) throw new RangeError('too many files for a zip');
  const enc = new TextEncoder();
  const seen = new Set();
  let size = 22;
  const prepared = entries.map((e) => {
    const name = String(e.name).replace(/\\/g, '/');
    if (!name || name.startsWith('/') || name.split('/').includes('..') || seen.has(name)) throw new Error('bad or duplicate zip entry: ' + e.name);
    seen.add(name);
    const nameBytes = enc.encode(name);
    size += 30 + 46 + 2 * nameBytes.length + e.data.length;
    return { nameBytes, data: e.data, crc: crc32(e.data) };
  });
  if (size > 0xffffffff) throw new RangeError('archive larger than 4 GB');
  const out = new Uint8Array(size), dv = new DataView(out.buffer);
  const central = [];
  let o = 0;
  for (const p of prepared) {
    central.push(o);
    dv.setUint32(o, 0x04034b50, true); dv.setUint16(o + 4, 20, true); dv.setUint16(o + 6, 0x0800, true); dv.setUint16(o + 8, 0, true);
    dv.setUint16(o + 10, 0, true); dv.setUint16(o + 12, 0x0021, true); // 1980-01-01 00:00
    dv.setUint32(o + 14, p.crc, true); dv.setUint32(o + 18, p.data.length, true); dv.setUint32(o + 22, p.data.length, true);
    dv.setUint16(o + 26, p.nameBytes.length, true); dv.setUint16(o + 28, 0, true);
    out.set(p.nameBytes, o + 30); out.set(p.data, o + 30 + p.nameBytes.length);
    o += 30 + p.nameBytes.length + p.data.length;
  }
  const cdStart = o;
  prepared.forEach((p, i) => {
    dv.setUint32(o, 0x02014b50, true); dv.setUint16(o + 4, 20, true); dv.setUint16(o + 6, 20, true); dv.setUint16(o + 8, 0x0800, true); dv.setUint16(o + 10, 0, true);
    dv.setUint16(o + 12, 0, true); dv.setUint16(o + 14, 0x0021, true);
    dv.setUint32(o + 16, p.crc, true); dv.setUint32(o + 20, p.data.length, true); dv.setUint32(o + 24, p.data.length, true);
    dv.setUint16(o + 28, p.nameBytes.length, true); dv.setUint32(o + 42, central[i], true);
    out.set(p.nameBytes, o + 46);
    o += 46 + p.nameBytes.length;
  });
  dv.setUint32(o, 0x06054b50, true); dv.setUint16(o + 8, prepared.length, true); dv.setUint16(o + 10, prepared.length, true);
  dv.setUint32(o + 12, o - cdStart, true); dv.setUint32(o + 16, cdStart, true);
  return out;
}
