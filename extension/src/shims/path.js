'use strict';
// Minimal POSIX-style path helpers for the browser build (only used to build unused paths).
function normalize(p) {
  const abs = p.startsWith('/');
  const parts = [];
  for (const s of p.split('/')) {
    if (!s || s === '.') continue;
    if (s === '..') parts.pop(); else parts.push(s);
  }
  return (abs ? '/' : '') + parts.join('/');
}
module.exports = {
  sep: '/',
  join: (...xs) => normalize(xs.filter((x) => x !== '' && x != null).join('/')),
  resolve: (...xs) => normalize(xs.filter(Boolean).join('/')),
  dirname: (p) => p.replace(/\/[^/]*$/, '') || '/',
  basename: (p, ext) => { let b = p.split('/').pop(); if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length); return b; },
  extname: (p) => { const m = /\.[^./]+$/.exec(p); return m ? m[0] : ''; },
};
