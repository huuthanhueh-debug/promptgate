'use strict';
// Browser stand-in for Node's os. The browser has no home directory; config paths are never used.
module.exports = { homedir: () => '/', platform: () => 'browser', EOL: '\n' };
