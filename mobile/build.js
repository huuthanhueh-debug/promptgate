#!/usr/bin/env node
'use strict';
// Builds Vision 6D.
//   node mobile/build.js          -> mobile/dist/www/   (the web app; open index.html over http)
//   node mobile/build.js --apk    -> mobile/dist/vision6d-<version>.apk (signed, installable)
//
// No npm dependencies and no Gradle. The APK step drives the Android SDK command-line tools
// directly: aapt2 (manifest + icon), javac + d8 (the WebView shell), our own zip writer
// (alignment), then apksigner. It needs a JDK and an Android SDK (ANDROID_HOME) with
// build-tools and one platform installed. Each tool can also be pointed at explicitly:
//   V6D_AAPT2=<aapt2 binary>  V6D_ANDROID_JAR=<android.jar>
//   V6D_R8_JAR=<d8.jar or r8.jar>  V6D_APKSIGNER_JAR=<apksigner.jar>
// Signing: set V6D_KEYSTORE, V6D_KEY_ALIAS, V6D_KEYSTORE_PASS to use your own key. Without
// them a throwaway debug key is generated in mobile/dist/ (fine for sideloading; an update
// signed with a different key needs an uninstall first).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { writeZip, readZip } = require('./android/zip');
const icon = require('./android/icon');

const MOBILE = __dirname;
const ROOT = path.resolve(MOBILE, '..');
const SRC = path.join(MOBILE, 'src');
const DIST = path.join(MOBILE, 'dist');
const WWW = path.join(DIST, 'www');
const ANDROID = path.join(MOBILE, 'android');
const APP = JSON.parse(fs.readFileSync(path.join(MOBILE, 'app.json'), 'utf8'));
const WEB_SKIP = new Set(['package.json']); // only tells Node the sources are ES modules

function walk(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, rel));
    else out.push({ rel, full });
  }
  return out;
}

function buildWeb(opts) {
  fs.rmSync(WWW, { recursive: true, force: true });
  const files = walk(SRC, '').filter((f) => !WEB_SKIP.has(f.rel));
  for (const f of files) {
    const to = path.join(WWW, f.rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(f.full, to);
  }
  if (!(opts && opts.quiet)) console.log(`built ${path.relative(ROOT, WWW)}/ (${files.length} files)`);
  return WWW;
}

// ---------- Android toolchain discovery ----------
const numeric = (a, b) => a.localeCompare(b, undefined, { numeric: true });
function latestDir(parent, test) {
  if (!parent || !fs.existsSync(parent)) return null;
  const dirs = fs.readdirSync(parent).filter((d) => test(path.join(parent, d))).sort(numeric);
  return dirs.length ? path.join(parent, dirs[dirs.length - 1]) : null;
}
function javaTool(name) {
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  const home = process.env.JAVA_HOME;
  return home && fs.existsSync(path.join(home, 'bin', exe)) ? path.join(home, 'bin', exe) : name;
}

// Resolves every tool or reports all that are missing. Returns { ok, missing: [], ... }.
function findTools(env) {
  env = env || process.env;
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || '';
  const aapt2Name = process.platform === 'win32' ? 'aapt2.exe' : 'aapt2';
  const bt = latestDir(sdk && path.join(sdk, 'build-tools'), (d) => fs.existsSync(path.join(d, aapt2Name)));
  const platform = latestDir(sdk && path.join(sdk, 'platforms'), (d) => /android-\d+$/.test(d) && fs.existsSync(path.join(d, 'android.jar')));
  const pick = (override, fallback) => (override ? override : fallback && fs.existsSync(fallback) ? fallback : null);
  const t = {
    aapt2: pick(env.V6D_AAPT2, bt && path.join(bt, aapt2Name)),
    androidJar: pick(env.V6D_ANDROID_JAR, platform && path.join(platform, 'android.jar')),
    r8Jar: pick(env.V6D_R8_JAR, bt && path.join(bt, 'lib', 'd8.jar')),
    apksignerJar: pick(env.V6D_APKSIGNER_JAR, bt && path.join(bt, 'lib', 'apksigner.jar')),
    java: javaTool('java'), javac: javaTool('javac'), keytool: javaTool('keytool'),
  };
  t.missing = ['aapt2', 'androidJar', 'r8Jar', 'apksignerJar'].filter((k) => !t[k] || !fs.existsSync(t[k]));
  for (const k of ['java', 'javac']) {
    try { execFileSync(t[k], ['-version'], { stdio: 'ignore' }); } catch (_) { t.missing.push(k); }
  }
  t.ok = t.missing.length === 0;
  return t;
}

function run(cmd, args, quiet, env) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, env: env ? Object.assign({}, process.env, env) : process.env });
  } catch (e) {
    const detail = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${path.basename(cmd)} ${args[0] || ''} failed${detail ? ':\n' + detail : ''}`);
  } finally {
    if (!quiet) process.stdout.write('.');
  }
}

function signingConfig(tools, quiet) {
  const env = process.env;
  if (env.V6D_KEYSTORE) {
    if (!env.V6D_KEYSTORE_PASS) throw new Error('V6D_KEYSTORE is set but V6D_KEYSTORE_PASS is not');
    return { ks: env.V6D_KEYSTORE, alias: env.V6D_KEY_ALIAS || 'vision6d', pass: env.V6D_KEYSTORE_PASS, debug: false };
  }
  const ks = path.join(DIST, 'debug.keystore');
  if (!fs.existsSync(ks)) {
    run(tools.keytool, ['-genkeypair', '-keystore', ks, '-storetype', 'PKCS12', '-storepass', 'android', '-keypass', 'android', '-alias', 'debug',
      '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Vision 6D Debug, O=Debug, C=VN'], quiet);
  }
  return { ks, alias: 'debug', pass: 'android', debug: true };
}

const STORED = /\.(png|jpg|jpeg|webp|arsc)$/i; // already compressed, or must stay uncompressed

function buildApk(opts) {
  opts = opts || {};
  const quiet = !!opts.quiet;
  const tools = findTools();
  if (!tools.ok) {
    throw new Error('Android toolchain incomplete, missing: ' + tools.missing.join(', ')
      + '.\nInstall a JDK and the Android SDK (build-tools + a platform), set ANDROID_HOME, or set the V6D_* variables listed at the top of mobile/build.js.');
  }
  buildWeb({ quiet: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vision6d-apk-'));
  try {
    // 1. resources: launcher icon at every density, compiled and linked with the manifest
    const res = path.join(work, 'res');
    for (const [density, size] of Object.entries(icon.DENSITIES)) {
      fs.mkdirSync(path.join(res, 'mipmap-' + density), { recursive: true });
      fs.writeFileSync(path.join(res, 'mipmap-' + density, 'ic_launcher.png'), icon.png(size));
    }
    const compiled = path.join(work, 'res.zip');
    run(tools.aapt2, ['compile', '--dir', res, '-o', compiled], quiet);
    // Linked into an archive we then unpack ourselves: aapt2's --output-to-dir cannot create
    // the res/ sub-folders on Windows.
    const linked = path.join(work, 'linked.apk');
    run(tools.aapt2, ['link', '-I', tools.androidJar, '--manifest', path.join(ANDROID, 'AndroidManifest.xml'),
      '--min-sdk-version', String(APP.minSdk), '--target-sdk-version', String(APP.targetSdk),
      '--version-code', String(APP.versionCode), '--version-name', APP.version,
      '-o', linked, compiled], quiet);

    // 2. the WebView shell: javac -> d8
    const classes = path.join(work, 'classes');
    fs.mkdirSync(classes);
    const sources = walk(path.join(ANDROID, 'src'), '').filter((f) => f.rel.endsWith('.java')).map((f) => f.full);
    run(tools.javac, ['-source', '8', '-target', '8', '-Xlint:-options', '-encoding', 'UTF-8', '-bootclasspath', tools.androidJar, '-d', classes, ...sources], quiet);
    const classFiles = walk(classes, '').map((f) => f.full);
    const dex = path.join(work, 'dex');
    fs.mkdirSync(dex);
    run(tools.java, ['-cp', tools.r8Jar, 'com.android.tools.r8.D8', '--release', '--min-api', String(APP.minSdk), '--lib', tools.androidJar, '--output', dex, ...classFiles], quiet);

    // 3. assemble (aligned), then sign
    const entries = [];
    for (const e of readZip(fs.readFileSync(linked))) entries.push({ name: e.name, data: e.data, store: e.stored || STORED.test(e.name) });
    entries.push({ name: 'classes.dex', data: fs.readFileSync(path.join(dex, 'classes.dex')) });
    for (const f of walk(WWW, '')) entries.push({ name: 'assets/www/' + f.rel, data: fs.readFileSync(f.full), store: STORED.test(f.rel) });
    const unsigned = path.join(work, 'unsigned.apk');
    fs.writeFileSync(unsigned, writeZip(entries));

    const sign = signingConfig(tools, quiet);
    const out = opts.out || path.join(DIST, `vision6d-${APP.version}.apk`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.rmSync(out, { force: true });
    run(tools.java, ['-jar', tools.apksignerJar, 'sign', '--ks', sign.ks, '--ks-key-alias', sign.alias,
      '--ks-pass', 'env:V6D_SIGN_PASS', '--key-pass', 'env:V6D_SIGN_PASS', // via env, not argv: argv shows up in `ps`
      '--min-sdk-version', String(APP.minSdk), '--out', out, unsigned], quiet, { V6D_SIGN_PASS: sign.pass });
    run(tools.java, ['-jar', tools.apksignerJar, 'verify', '--min-sdk-version', String(APP.minSdk), out], quiet);
    fs.rmSync(out + '.idsig', { force: true });
    if (!quiet) console.log(`\nbuilt ${path.relative(ROOT, out)} (${fs.statSync(out).size} bytes, ${APP.id} ${APP.version}, ${sign.debug ? 'debug key' : 'release key'})`);
    return out;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = { buildWeb, buildApk, findTools, APP, WWW };

if (require.main === module) {
  try {
    if (process.argv.includes('--apk')) buildApk();
    else buildWeb();
  } catch (e) {
    console.error('\n' + e.message);
    process.exit(1);
  }
}
