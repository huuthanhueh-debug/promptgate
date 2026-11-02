'use strict';
// Browser stand-in for Node's fs. The engine only touches the disk through packs.js / config.js
// (both disk-backed loaders). The extension feeds packs in directly, so these calls never run;
// if one does, it fails loudly instead of silently returning nothing.
function nope() { throw new Error('fs is not available in the browser build'); }
module.exports = {
  readFileSync: nope, writeFileSync: nope, readdirSync: () => [], mkdirSync: nope,
  appendFileSync: nope, unlinkSync: nope, existsSync: () => false, statSync: nope,
};
