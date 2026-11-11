#!/usr/bin/env node
'use strict';
// Builds dist/FoodLens.apk from web/ + android/ with the Android SDK command
// line tools (aapt2, d8, zipalign, apksigner) and a JDK. No Gradle, no dependencies.
// Needs ANDROID_HOME (or ANDROID_SDK_ROOT) with one build-tools version and one platform
// (android-34 or newer) installed. Usage: node build-apk.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'web');
const ANDROID = path.join(ROOT, 'android');
const OUT = path.join(ROOT, 'dist');
const WORK = path.join(OUT, 'foodlens-build');
const APK = path.join(OUT, 'FoodLens.apk');
const KEYSTORE = process.env.FOODLENS_KEYSTORE || path.join(ANDROID, 'foodlens.keystore');
const KEY_PASS = process.env.FOODLENS_KEYSTORE_PASS || 'foodlens';
const MIN_SDK = 29, TARGET_SDK = 34;
const WIN = process.platform === 'win32';

function versionOf() {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(v.name) || !Number.isInteger(v.code) || v.code < 1) throw new Error('version.json: need {"name":"x.y.z","code":n}');
  return v;
}
// "34.0.0" / "android-35" style names, newest last.
function byVersion(a, b) {
  const pa = a.replace(/^android-/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^android-/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}
function findSdk(env) {
  const home = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!home || !fs.existsSync(home)) throw new Error('Android SDK not found: set ANDROID_HOME to the SDK folder (Android Studio > SDK Manager shows the path).');
  const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  const tools = list(path.join(home, 'build-tools')).filter((d) => /^\d+\.\d+\.\d+$/.test(d)).sort(byVersion).pop();
  const platform = list(path.join(home, 'platforms')).filter((d) => /^android-\d+$/.test(d) && parseInt(d.slice(8), 10) >= TARGET_SDK)
    .filter((d) => fs.existsSync(path.join(home, 'platforms', d, 'android.jar'))).sort(byVersion).pop();
  if (!tools) throw new Error('No build-tools in ' + home + ': install one with sdkmanager "build-tools;34.0.0".');
  if (!platform) throw new Error('No platform android-' + TARGET_SDK + '+ in ' + home + ': install one with sdkmanager "platforms;android-' + TARGET_SDK + '".');
  const bin = (name, bat) => path.join(home, 'build-tools', tools, name + (WIN ? (bat ? '.bat' : '.exe') : ''));
  return {
    home, tools, platform, androidJar: path.join(home, 'platforms', platform, 'android.jar'),
    aapt2: bin('aapt2'), aapt: bin('aapt'), zipalign: bin('zipalign'), d8: bin('d8', true), apksigner: bin('apksigner', true),
  };
}
function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, Object.assign({ encoding: 'utf8', shell: WIN && /\.bat$/.test(cmd) }, opts || {}));
  if (r.error) throw new Error(path.basename(cmd) + ': ' + r.error.message);
  if (r.status !== 0) throw new Error(path.basename(cmd) + ' failed (' + r.status + ')\n' + (r.stdout || '') + (r.stderr || ''));
  return r.stdout || '';
}
function filesUnder(dir, ext) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(filesUnder(p, ext)); else if (!ext || p.endsWith(ext)) out.push(p);
  }
  return out;
}

function build() {
  const v = versionOf();
  const sdk = findSdk(process.env);
  console.log('SDK ' + sdk.home + ' · build-tools ' + sdk.tools + ' · ' + sdk.platform);
  fs.rmSync(WORK, { recursive: true, force: true });
  const assets = path.join(WORK, 'assets', 'web'), classes = path.join(WORK, 'classes'), dex = path.join(WORK, 'dex');
  [assets, classes, dex].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  for (const f of fs.readdirSync(WEB)) fs.copyFileSync(path.join(WEB, f), path.join(assets, f));

  const resZip = path.join(WORK, 'res.zip'), base = path.join(WORK, 'base.apk'), aligned = path.join(WORK, 'aligned.apk');
  run(sdk.aapt2, ['compile', '--dir', path.join(ANDROID, 'res'), '-o', resZip]);
  run(sdk.aapt2, ['link', '-o', base, '-I', sdk.androidJar, '--manifest', path.join(ANDROID, 'AndroidManifest.xml'), '-A', path.join(WORK, 'assets'),
    '--min-sdk-version', String(MIN_SDK), '--target-sdk-version', String(TARGET_SDK), '--version-code', String(v.code), '--version-name', v.name, resZip]);

  run('javac', ['--release', '11', '-proc:none', '-Xlint:-options', '-cp', sdk.androidJar, '-d', classes].concat(filesUnder(path.join(ANDROID, 'src'), '.java')));
  run(sdk.d8, ['--release', '--lib', sdk.androidJar, '--min-api', String(MIN_SDK), '--output', dex].concat(filesUnder(classes, '.class')));
  run(sdk.aapt, ['add', base, 'classes.dex'], { cwd: dex });
  run(sdk.zipalign, ['-f', '-p', '4', base, aligned]);

  if (!fs.existsSync(KEYSTORE)) {
    // One self-signed key, kept next to the sources (git-ignored) so later builds install as updates.
    run('keytool', ['-genkeypair', '-keystore', KEYSTORE, '-storepass', KEY_PASS, '-keypass', KEY_PASS, '-alias', 'foodlens', '-keyalg', 'RSA', '-keysize', '2048',
      '-validity', '10000', '-dname', 'CN=FoodLens']);
    console.log('Created signing key ' + KEYSTORE + ' (keep it: the phone only accepts updates signed with the same key)');
  }
  run(sdk.apksigner, ['sign', '--ks', KEYSTORE, '--ks-pass', 'pass:' + KEY_PASS, '--key-pass', 'pass:' + KEY_PASS, '--ks-key-alias', 'foodlens', '--out', APK, aligned]);
  run(sdk.apksigner, ['verify', '--min-sdk-version', String(MIN_SDK), APK]);
  const badging = run(sdk.aapt2, ['dump', 'badging', APK]).split('\n').filter((l) => /^(package|sdkVersion|targetSdkVersion|application-label|uses-permission|launchable-activity):?/.test(l));
  console.log(badging.join('\n'));
  console.log('OK ' + path.relative(process.cwd(), APK) + ' · ' + Math.round(fs.statSync(APK).size / 1024) + ' KB · v' + v.name + ' (' + v.code + ')');
  return APK;
}

if (require.main === module) {
  try { build(); } catch (e) { console.error('build failed: ' + e.message); process.exit(1); }
}
module.exports = { build, findSdk, byVersion, versionOf };
