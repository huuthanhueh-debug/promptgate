#!/usr/bin/env node
'use strict';
// Starts Vision 6D on this computer: a local server plus an app window.
//   node tools/desktop.js [--out <folder>] [--port <n>] [--browser] [--no-open]
// --browser opens a normal browser tab instead of a chromeless app window; --no-open only
// prints the address. The app stops by itself a few seconds after its window is closed.
const { spawn } = require('child_process');
const { createApp, defaultOutDir } = require('./server');

function parseArgs(argv) {
  const o = { open: true, appWindow: true, outDir: defaultOutDir(), port: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-open') o.open = false;
    else if (a === '--browser') o.appWindow = false;
    else if (a === '--out' && argv[i + 1]) o.outDir = argv[++i];
    else if (a === '--port' && /^\d+$/.test(argv[i + 1] || '')) o.port = Number(argv[++i]);
    else if (a === '-h' || a === '--help') o.help = true;
    else o.unknown = a;
  }
  return o;
}

// How to show `url` on this platform: [command, args, spawn options].
function openCommand(url, appWindow, platform) {
  platform = platform || process.platform;
  if (platform === 'win32') {
    // Edge ships with Windows 10/11; --app gives a window without tabs or an address bar.
    const what = appWindow ? ['msedge', `--app=${url}`] : [url];
    return ['cmd.exe', ['/d', '/s', '/c', 'start', '""', ...what], { windowsVerbatimArguments: true }];
  }
  if (platform === 'darwin') return ['open', [url], {}];
  return ['xdg-open', [url], {}];
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || o.unknown) {
    console.log((o.unknown ? `Unknown option: ${o.unknown}\n` : '') + 'Usage: node tools/desktop.js [--out <folder>] [--port <n>] [--browser] [--no-open]');
    process.exit(o.unknown ? 1 : 0);
  }
  let leaving = null;
  const app = await createApp({
    outDir: o.outDir, port: o.port,
    onBye: () => { leaving = setTimeout(() => { console.log('Window closed, stopping.'); process.exit(0); }, 4000); }, // a reload says bye too, then comes right back
    onRequest: (p) => { if (leaving && p !== '/api/bye') { clearTimeout(leaving); leaving = null; } },
  });
  console.log(`Vision 6D is running.\n  Window : ${app.url}\n  Output : ${app.outDir}\n  Stop   : close the window, or press Ctrl+C here.`);
  if (o.open) {
    const [cmd, args, extra] = openCommand(app.url, o.appWindow);
    const child = spawn(cmd, args, Object.assign({ detached: true, stdio: 'ignore' }, extra));
    child.on('error', () => console.log('Could not open a window automatically. Open the address above in Chrome or Edge.'));
    child.unref();
  }
}

module.exports = { parseArgs, openCommand };

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
