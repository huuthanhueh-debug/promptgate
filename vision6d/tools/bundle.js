'use strict';
// Gathers an ES-module program into ONE classic script, so a page can run from a plain file
// (file://) where browsers refuse module imports. No dependencies.
//
// It understands exactly the syntax this project uses and fails loudly on anything else:
//   import { a, b as c } from './x.js';   import * as X from './x.js';
//   export function f() {}   export const/let/class n = ...;   export { a, b as c };  (last statement)
// Unsupported (throws): default imports/exports, re-exports, side-effect imports, import(), import.meta.
const fs = require('fs');
const path = require('path');

const IMPORT_LINE = /^import\s+(?:\*\s+as\s+([A-Za-z_$][\w$]*)|\{([^}]*)\})\s+from\s+'([^']+)'\s*;?[ \t]*$/;
const EXPORT_DECL = /^export\s+(?:async\s+)?(?:function\s*\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/;
const TAIL_EXPORT = /\bexport\s*\{([^{}]*)\}\s*;?\s*$/;

function names(list) {
  return list.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(s);
    if (!m) throw new Error(`unsupported import/export item "${s}"`);
    return { local: m[1], alias: m[2] || m[1] };
  });
}

// Rewrites one module's source. Returns { code, deps: [absolute paths] }.
function transform(source, file, root) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const deps = [];
  const exportsOut = [];
  const fail = (msg) => { throw new Error(`${rel}: ${msg}`); };
  if (/\bimport\.meta\b|\bimport\s*\(/.test(source)) fail('import.meta and dynamic import() are not supported');

  const tail = TAIL_EXPORT.exec(source);
  if (tail) {
    for (const n of names(tail[1])) exportsOut.push(`__e.${n.alias} = ${n.local};`);
    source = source.slice(0, tail.index);
  }
  const lines = source.split('\n').map((line) => {
    if (/^import[\s*{]/.test(line)) {
      const m = IMPORT_LINE.exec(line);
      if (!m) fail(`unsupported import: ${line.trim()}`);
      const target = path.resolve(path.dirname(file), m[3]);
      if (!m[3].startsWith('.') || !target.startsWith(root + path.sep)) fail(`import outside the project: ${m[3]}`);
      deps.push(target);
      const id = JSON.stringify(path.relative(root, target).split(path.sep).join('/'));
      if (m[1]) return `const ${m[1]} = __r(${id});`;
      const parts = names(m[2]).map((n) => (n.local === n.alias ? n.local : `${n.local}: ${n.alias}`));
      return `const { ${parts.join(', ')} } = __r(${id});`;
    }
    if (/^export\b/.test(line)) {
      const m = EXPORT_DECL.exec(line);
      if (!m) fail(`unsupported export: ${line.trim()}`);
      exportsOut.push(`__e.${m[1]} = ${m[1]};`);
      return line.replace(/^export\s+/, '');
    }
    return line;
  });
  return { code: lines.join('\n') + '\n' + exportsOut.join('\n'), deps };
}

// Bundles `entry` and everything it imports. Returns the script text.
function bundle(entry, root) {
  root = path.resolve(root);
  const order = [], seen = new Map();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.set(file, null);
    const { code, deps } = transform(fs.readFileSync(file, 'utf8'), file, root);
    deps.forEach(visit);
    seen.set(file, code);
    order.push(file);
  };
  visit(path.resolve(entry));
  const defs = order.map((f) => `__m[${JSON.stringify(path.relative(root, f).split(path.sep).join('/'))}] = function (__e, __r) {\n${seen.get(f)}\n};`);
  const out = [
    '(function () {', '"use strict";', 'var __m = {}, __c = {};',
    'function __r(id) { if (__c[id]) return __c[id]; var e = (__c[id] = {}); __m[id](e, __r); return e; }',
    defs.join('\n'),
    `__r(${JSON.stringify(path.relative(root, path.resolve(entry)).split(path.sep).join('/'))});`,
    '})();', '',
  ].join('\n');
  return out.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'); // safe to inline in an HTML page
}

module.exports = { bundle, transform };
