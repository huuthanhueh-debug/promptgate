'use strict';
// Minimal zip writer/reader for assembling the APK. Pure Node (zlib only).
//
// writeZip() does what `zipalign` does: entries stored without compression start on a 4-byte
// boundary, which Android 11+ requires for resources.arsc. Timestamps are fixed, so the same
// inputs always give the same bytes.
const zlib = require('zlib');

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const DOS_TIME = 0, DOS_DATE = 0x0021; // 1980-01-01 00:00
const UTF8_FLAG = 0x0800;

// entries: [{ name, data: Buffer, store?: boolean }]. Returns the archive as a Buffer.
function writeZip(entries, opts) {
  const align = (opts && opts.align) || 4;
  const seen = new Set();
  const chunks = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = String(e.name).replace(/\\/g, '/');
    if (!name || name.startsWith('/') || name.split('/').includes('..')) throw new Error('bad zip entry name: ' + e.name);
    if (seen.has(name)) throw new Error('duplicate zip entry: ' + name);
    seen.add(name);
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data);
    const store = !!e.store || data.length === 0;
    const body = store ? data : zlib.deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const pad = store ? (align - ((offset + 30 + nameBuf.length) % align)) % align : 0;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(pad, 28);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(UTF8_FLAG, 8);
    cd.writeUInt16LE(store ? 0 : 8, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    chunks.push(local, nameBuf, Buffer.alloc(pad), body);
    offset += 30 + nameBuf.length + pad + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cdBuf, end]);
}

// Reads an archive back: [{ name, stored, dataOffset, data }]. Verifies each CRC.
function readZip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip: end of central directory not found');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const dataOffset = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataOffset, dataOffset + csize);
    const data = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
    if (crc32(data) !== crc) throw new Error('crc mismatch in ' + name);
    out.push({ name, stored: method === 0, dataOffset, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

module.exports = { writeZip, readZip, crc32 };
