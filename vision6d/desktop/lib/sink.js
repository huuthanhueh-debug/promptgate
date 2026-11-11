// Where extracted files go. The window talks to one of two "sinks" with the same shape:
//   server   the local Node server writes them into the output folder (node tools/desktop.js)
//   browser  the page runs on its own (Vision6D.html, no Node, no script): files go into a folder
//            the user picks (File System Access API, Chrome / Edge), or into one .zip download
//            where that API is missing.
//
// sink = { kind, canOpen, info(), prepare(), begin(name), put(dir, relPath, blob), finish(), open(dir) }
// begin() returns { dir, path }. prepare() must run first thing inside the click that starts the
// extraction (browsers only show the folder picker in response to a click). finish() runs once
// after the last file. Errors from the server sink carry code 'server'.
import { writeStoredZip } from './zip.js';

export function createServerSink(token, fetchImpl) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const call = async (method, path, body) => {
    const headers = { 'x-v6d-token': token };
    let payload = body;
    if (body && !(typeof Blob !== 'undefined' && body instanceof Blob)) { payload = JSON.stringify(body); headers['content-type'] = 'application/json'; }
    let res;
    try { res = await doFetch(path, { method, headers, body: payload }); } catch (_) { throw Object.assign(new Error('server unreachable'), { code: 'server' }); }
    if (!res.ok) throw Object.assign(new Error(`${method} ${path}: ${res.status}`), { code: res.status === 403 ? 'server' : 'http' });
    return res.json();
  };
  return {
    kind: 'server', canOpen: true, token,
    info: () => call('GET', '/api/info'),
    prepare: async () => {},
    begin: (name) => call('POST', '/api/begin', { name }),
    put: (dir, rel, blob) => call('PUT', `/api/file?dir=${encodeURIComponent(dir)}&path=${encodeURIComponent(rel)}`, blob),
    finish: async () => {},
    open: (dir) => call('POST', '/api/open', { dir }),
    bye: () => { if (typeof navigator !== 'undefined' && navigator.sendBeacon) navigator.sendBeacon('/api/bye?t=' + encodeURIComponent(token)); },
  };
}

// env = the window (or a stand-in): showDirectoryPicker, document, URL, setTimeout.
export function createBrowserSink(env) {
  let root = null; // chosen folder handle (kind 'folder')
  const zipFiles = []; // [{ name, blob }] (kind 'zip')
  const zipDirs = new Set();
  const folder = () => typeof env.showDirectoryPicker === 'function';

  async function exists(handle, name) {
    try { await handle.getDirectoryHandle(name); return true; } catch (e) { if (e && e.name === 'NotFoundError') return false; throw e; }
  }
  const sink = {
    get kind() { return folder() ? 'folder' : 'zip'; },
    canOpen: false,
    get folderName() { return root ? root.name : ''; },
    info: async () => ({}),
    prepare: async () => {
      if (folder() && !root) root = await env.showDirectoryPicker({ id: 'vision6d', mode: 'readwrite' });
    },
    begin: async (name) => {
      for (let i = 1; i < 10000; i++) {
        const candidate = i === 1 ? name : `${name}-${i}`;
        if (folder()) {
          if (await exists(root, candidate)) continue;
          await root.getDirectoryHandle(candidate, { create: true });
          return { dir: candidate, path: `${root.name}/${candidate}` };
        }
        if (zipDirs.has(candidate)) continue;
        zipDirs.add(candidate);
        return { dir: candidate, path: `Vision6D.zip/${candidate}` };
      }
      throw new Error('could not create an output folder');
    },
    put: async (dir, rel, blob) => {
      if (!folder()) { zipFiles.push({ name: `${dir}/${rel}`, blob }); return; }
      const parts = rel.split('/');
      let h = await root.getDirectoryHandle(dir);
      for (const p of parts.slice(0, -1)) h = await h.getDirectoryHandle(p, { create: true });
      const file = await h.getFileHandle(parts[parts.length - 1], { create: true });
      const w = await file.createWritable();
      try { await w.write(blob); } finally { await w.close(); }
    },
    finish: async () => {
      if (folder() || !zipFiles.length) return;
      const entries = [];
      for (const f of zipFiles.splice(0)) entries.push({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) });
      const url = env.URL.createObjectURL(new Blob([writeStoredZip(entries)], { type: 'application/zip' }));
      const a = env.document.createElement('a');
      a.href = url; a.download = 'Vision6D.zip';
      env.document.body.appendChild(a); a.click(); a.remove();
      env.setTimeout(() => env.URL.revokeObjectURL(url), 60000);
      zipDirs.clear();
    },
    open: async () => {},
    bye: () => {},
  };
  return sink;
}
