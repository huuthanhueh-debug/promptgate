'use strict';
// Vision 6D desktop: the local server behind the app window. It serves the page (core/ and
// desktop/) and writes the files the page extracts into the output folder. Node built-ins only.
//
// It listens on 127.0.0.1 and trusts nothing else on the machine's browser:
//   - the Host header must be this server (stops DNS-rebinding pages reading it),
//   - every /api call needs the per-launch token in a custom header (other sites cannot send
//     custom headers cross-origin) and, when the browser sends an Origin, it must be ours,
//   - files can only be written inside a folder this run created under the output folder,
//     with a fixed set of extensions and sanitised names.
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const STATIC_DIRS = ['core', 'desktop']; // the only folders the page can read
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const WRITE_EXT = new Set(['.glb', '.ply', '.png', '.jpg', '.json']);
const MAX_FILE = 512 * 1024 * 1024;
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

function defaultOutDir() {
  return path.join(os.homedir(), 'Vision6D');
}

// Same rules as sanitizeName() in desktop/lib/extract.js; kept here so the server never trusts the page.
function safeName(name) {
  let s = String(name || '').normalize('NFC').replace(/[^\p{L}\p{N} ._-]+/gu, ' ').replace(/\s+/g, ' ').replace(/^[ .]+|[ .]+$/g, '').slice(0, 80).replace(/[ .]+$/g, '');
  if (!s) s = 'image';
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(s)) s = '_' + s;
  return s;
}

// "layers/layer-1.png" -> ['layers', 'layer-1.png'], or null when the path is not allowed.
function safeRelPath(rel) {
  const parts = String(rel || '').split('/');
  if (parts.length < 1 || parts.length > 2) return null;
  for (const p of parts) if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(p) || p.includes('..')) return null;
  if (!WRITE_EXT.has(path.extname(parts[parts.length - 1]).toLowerCase())) return null;
  return parts;
}

function uniqueDir(outDir, name) {
  for (let i = 1; i < 10000; i++) {
    const candidate = i === 1 ? name : `${name}-${i}`;
    try { fs.mkdirSync(path.join(outDir, candidate)); return candidate; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  throw new Error('could not create an output folder');
}

function openInFileManager(dir) {
  const cmd = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(cmd, [dir], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

function tokenOk(given, token) {
  const a = Buffer.from(String(given || '')), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// opts: { outDir, port (0 = any free port), token, opener(dir), onBye() }.
// Resolves to { server, port, token, origin, url, outDir, close() }.
function createApp(opts) {
  opts = opts || {};
  const outDir = path.resolve(opts.outDir || defaultOutDir());
  const token = opts.token || crypto.randomBytes(24).toString('hex');
  const opener = opts.opener || openInFileManager;
  const sessionDirs = new Set(); // folders this run created; the only places files may go
  let port = 0;

  const send = (res, status, body, headers) => {
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, Object.assign({ 'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, headers));
    res.end(data);
  };

  async function api(req, res, url) {
    const origin = req.headers.origin;
    if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) return send(res, 403, { error: 'origin' });
    const route = `${req.method} ${url.pathname}`;
    // The goodbye beacon cannot carry headers, so it alone takes the token from the query string.
    const given = route === 'POST /api/bye' ? url.searchParams.get('t') : req.headers['x-v6d-token'];
    if (!tokenOk(given, token)) return send(res, 403, { error: 'token' });

    if (route === 'GET /api/info') return send(res, 200, { app: APP.name, version: APP.version, outDir, platform: process.platform });
    if (route === 'POST /api/begin') {
      let body;
      try { body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}'); } catch (e) { return send(res, e.status || 400, { error: 'bad request' }); }
      fs.mkdirSync(outDir, { recursive: true });
      const dir = uniqueDir(outDir, safeName(body.name));
      sessionDirs.add(dir);
      return send(res, 200, { dir, path: path.join(outDir, dir) });
    }
    if (route === 'PUT /api/file') {
      const dir = url.searchParams.get('dir');
      const parts = safeRelPath(url.searchParams.get('path'));
      if (!sessionDirs.has(dir) || !parts) return send(res, 400, { error: 'bad target' });
      const target = path.join(outDir, dir, ...parts);
      if (!target.startsWith(path.join(outDir, dir) + path.sep)) return send(res, 400, { error: 'bad target' });
      let data;
      try { data = await readBody(req, MAX_FILE); } catch (e) { return send(res, e.status || 400, { error: 'upload failed' }); }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
      return send(res, 200, { bytes: data.length });
    }
    if (route === 'POST /api/open') {
      let body = {};
      try { body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}'); } catch (_) { /* open the main folder */ }
      const dir = sessionDirs.has(body.dir) ? path.join(outDir, body.dir) : outDir;
      fs.mkdirSync(outDir, { recursive: true });
      opener(dir);
      return send(res, 200, { opened: dir });
    }
    if (route === 'POST /api/bye') {
      send(res, 200, { bye: true });
      if (opts.onBye) opts.onBye();
      return undefined;
    }
    return send(res, 404, { error: 'not found' });
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
    if (url.pathname === '/') return send(res, 302, '', { location: '/desktop/index.html' });
    let rel;
    try { rel = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch (_) { return send(res, 400, 'bad path'); }
    const top = rel.split('/')[0];
    const file = path.join(ROOT, rel);
    const ext = path.extname(file).toLowerCase();
    if (!STATIC_DIRS.includes(top) || rel.includes('\\') || rel.split('/').includes('..') || !file.startsWith(path.join(ROOT, top) + path.sep) || !MIME[ext]) return send(res, 404, 'not found');
    let data;
    try { data = fs.readFileSync(file); } catch (_) { return send(res, 404, 'not found'); }
    const headers = { 'content-type': MIME[ext] };
    if (ext === '.html') headers['content-security-policy'] = CSP;
    return send(res, 200, req.method === 'HEAD' ? Buffer.alloc(0) : data, headers);
  }

  const server = http.createServer((req, res) => {
    const host = req.headers.host;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(res, 403, 'forbidden');
    let url;
    try { url = new URL(req.url, `http://127.0.0.1:${port}`); } catch (_) { return send(res, 400, 'bad request'); }
    if (opts.onRequest) opts.onRequest(url.pathname);
    if (url.pathname.startsWith('/api/')) return api(req, res, url).catch(() => { if (!res.headersSent) send(res, 500, { error: 'server error' }); });
    return serveStatic(req, res, url);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port || 0, '127.0.0.1', () => {
      port = server.address().port;
      const origin = `http://127.0.0.1:${port}`;
      resolve({ server, port, token, origin, outDir, url: `${origin}/desktop/index.html#t=${token}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

module.exports = { createApp, defaultOutDir, safeName, safeRelPath, APP };
