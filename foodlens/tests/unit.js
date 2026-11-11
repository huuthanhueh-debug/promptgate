#!/usr/bin/env node
'use strict';
// FoodLens tests: the nutrition rules, the Claude request/response handling, the offline food
// table, the APK build helpers and the static wiring of the web bundle and Android shell.
// No network and no Android SDK needed. Run: node tests/unit.js
const fs = require('fs');
const os = require('os');
const path = require('path');

const FL = path.resolve(__dirname, '..');
const C = require(path.join(FL, 'web/core.js'));
const FOODS = require(path.join(FL, 'web/foods.js'));
const B = require(path.join(FL, 'build-apk.js'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
function throwsCode(fn) { try { fn(); return null; } catch (e) { return e.code || 'error'; } }
const item = (o) => Object.assign({ name_vi: 'X', name_en: 'X', grams: 100, calories: 100, carbs_g: 0, fiber_g: 0, sugar_g: 0, added_sugar_g: 0, protein_g: 0, fat_g: 0, sat_fat_g: 0, sodium_mg: 0, gi: 0, nova: 1, confidence: 0.8 }, o);
const meal = (items) => C.parseAnalysis(JSON.stringify({ is_food: true, dish_name: 'Test', cuisine: '', portion_note: '', items, advice: '', swaps: [] }));
const food = (vi) => FOODS.find((f) => f.vi === vi);

console.log('request');
const req = C.buildRequest({ apiKey: 'sk-test', imageBase64: 'QUJD', note: '  nửa phần  ' });
check('default model is claude-opus-5-5', req.body.model === 'claude-opus-5-5');
check('posts to the Messages API', req.url === 'https://api.anthropic.com/v1/messages');
check('image block comes before the text block', req.body.messages[0].content[0].type === 'image' && req.body.messages[0].content[0].source.data === 'QUJD' && req.body.messages[0].content[1].type === 'text');
check('user note is trimmed into the text block', /Ghi chú của người dùng: nửa phần$/.test(req.body.messages[0].content[1].text));
check('key and version headers set', req.headers['x-api-key'] === 'sk-test' && req.headers['anthropic-version'] === '2023-06-01');
check('schema-constrained output requested', req.body.output_config.format.type === 'json_schema' && req.body.output_config.format.schema === C.SCHEMA);
check('no sampling or thinking parameters sent', !('temperature' in req.body) && !('top_p' in req.body) && !('thinking' in req.body));
check('long notes are capped at 500 characters', C.buildRequest({ note: 'a'.repeat(900) }).body.messages[0].content[1].text.length < 560);
const plain = C.buildRequest({ apiKey: 'k', imageBase64: 'QQ==', plain: true });
check('plain retry drops output_config, fallbacks and the beta header', !plain.body.output_config && !plain.body.fallbacks && !plain.headers['anthropic-beta']);
const haiku = C.buildRequest({ model: 'claude-haiku-5-5' });
check('haiku request carries no fallbacks', !haiku.body.fallbacks && !haiku.headers['anthropic-beta'] && haiku.body.output_config.format);
const badSchema = [];
(function walk(s, where) {
  if (!s || typeof s !== 'object') return;
  if (s.type === 'object') {
    if (s.additionalProperties !== false) badSchema.push(where + ': additionalProperties');
    if (JSON.stringify(s.required) !== JSON.stringify(Object.keys(s.properties))) badSchema.push(where + ': required');
    Object.keys(s.properties).forEach((k) => walk(s.properties[k], where + '.' + k));
  }
  if (s.type === 'array') walk(s.items, where + '[]');
  ['minimum', 'maximum', 'multipleOf', 'minLength', 'maxLength'].forEach((k) => { if (k in s) badSchema.push(where + ': ' + k); });
})(C.SCHEMA, 'root');
check('schema fits structured-output limits', badSchema.length === 0, badSchema.join(', '));

console.log('response');
const okBody = (text, stop) => JSON.stringify({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], stop_reason: stop || 'end_turn' });
check('text extracted, thinking blocks skipped', C.extractText(200, okBody('{"a":1}')) === '{"a":1}');
check('401 → auth', throwsCode(() => C.extractText(401, '{"error":{"message":"invalid x-api-key"}}')) === 'auth');
check('429 → rate', throwsCode(() => C.extractText(429, '{}')) === 'rate');
check('413 → too_large', throwsCode(() => C.extractText(413, '')) === 'too_large');
check('400 → bad_request', throwsCode(() => C.extractText(400, '{"error":{"message":"x"}}')) === 'bad_request');
check('status 0 → network', throwsCode(() => C.extractText(0, '')) === 'network');
check('529 → server', throwsCode(() => C.extractText(529, 'overloaded')) === 'server');
check('refusal stop reason → refusal', throwsCode(() => C.extractText(200, okBody('', 'refusal'))) === 'refusal');
check('empty text → parse', throwsCode(() => C.extractText(200, okBody('', 'max_tokens'))) === 'parse');
check('non-JSON 200 body → parse', throwsCode(() => C.extractText(200, '<html>')) === 'parse');

console.log('parse');
const fenced = C.parseAnalysis('Đây là kết quả:\n```json\n' + JSON.stringify({ is_food: true, dish_name: 'Táo', items: [item({ name_vi: 'Táo', carbs_g: 25, fiber_g: 4.4 })] }) + '\n```');
check('JSON inside a code fence is read', fenced.is_food && fenced.items.length === 1 && fenced.dish_name === 'Táo');
check('missing optional fields get safe defaults', fenced.advice === '' && Array.isArray(fenced.swaps) && fenced.portion_note === '');
check('garbage → parse error', throwsCode(() => C.parseAnalysis('không có gì')) === 'parse' && throwsCode(() => C.parseAnalysis('{oops}')) === 'parse' && throwsCode(() => C.parseAnalysis('')) === 'parse');
const dirty = C.parseAnalysis(JSON.stringify({ is_food: true, items: [{ name_vi: '', name_en: 'Rice', grams: -5, calories: 'abc', carbs_g: '12,5', fiber_g: 99, sugar_g: 50, added_sugar_g: 70, fat_g: 2, sat_fat_g: 9, gi: 250, nova: 9, confidence: 7 }] })).items[0];
check('negative and non-numeric values become 0', dirty.grams === 0 && dirty.calories === 0);
check('comma decimals are read', dirty.carbs_g === 12.5);
check('fiber, sugar, added sugar, sat fat clamped to their parents', dirty.fiber_g === 12.5 && dirty.sugar_g === 12.5 && dirty.added_sugar_g === 12.5 && dirty.sat_fat_g === 2);
check('gi, nova, confidence clamped to range', dirty.gi === 100 && dirty.nova === 4 && dirty.confidence === 1);
check('name falls back to the English name', dirty.name_vi === 'Rice');
const notFood = C.parseAnalysis(JSON.stringify({ is_food: false, items: [item({})], advice: 'Ảnh chụp bàn phím.' }));
check('is_food false clears items and keeps the explanation', notFood.is_food === false && notFood.items.length === 0 && notFood.advice === 'Ảnh chụp bàn phím.');
check('no items means not food', C.parseAnalysis('{"is_food":true,"items":[]}').is_food === false);
check('item list capped at 30', C.parseAnalysis(JSON.stringify({ items: Array.from({ length: 80 }, () => item({})) })).items.length === 30);
check('swaps capped at 3', C.parseAnalysis(JSON.stringify({ items: [item({})], swaps: ['a', 'b', 'c', 'd', ''] })).swaps.length === 3);
const legacy = C.parseAnalysis(JSON.stringify({ items: [item({})], advice_vi: 'cũ', swaps_vi: ['x'] }));
check('diary entries saved by 1.0 (advice_vi / swaps_vi) still open', legacy.advice === 'cũ' && legacy.swaps[0] === 'x');

console.log('diabetes / low-carb / clean rules');
const apple = C.assess(C.fromDb(food('Táo'), 182));
const rice = C.assess(C.fromDb(food('Cơm trắng'), 300));
check('one apple: net carbs = carbs − fiber', apple.totals.netCarbs === 20.7, String(apple.totals.netCarbs));
check('one apple: GL ≈ 7.5, low', apple.totals.gl === 7.5 && apple.diabetes.glLevel === 'green', String(apple.totals.gl));
check('one apple: safe for blood glucose, no added sugar', apple.diabetes.level === 'green' && apple.totals.addedSugar === 0);
check('green verdict leads with the keep-the-portion tip', /phù hợp/.test(apple.tips[0]) && !/phù hợp/.test(rice.tips.join(' ')));
check('one apple: moderate low-carb, fully clean', apple.lowCarb.level === 'yellow' && apple.clean.score === 100);
check('two bowls of white rice: red', rice.diabetes.level === 'red' && rice.diabetes.glLevel === 'red' && rice.lowCarb.level === 'red');
check('red verdict gives portion and walking tips', rice.tips.some((t) => /tinh bột/.test(t)) && rice.tips.some((t) => /Đi bộ/.test(t)));
const soda = C.assess(C.fromDb(food('Nước ngọt có ga'), 330));
check('a can of soda: added sugar alone is red', soda.diabetes.sugarLevel === 'red' && soda.diabetes.level === 'red' && soda.clean.level === 'red');
const chicken = C.assess(C.fromDb(food('Ức gà áp chảo'), 150));
check('chicken breast: green, keto, GI 0 without NaN', chicken.diabetes.level === 'green' && chicken.lowCarb.level === 'green' && chicken.totals.gi === 0 && chicken.totals.gl === 0);
const mixed = C.assess(meal([item({ carbs_g: 40, fiber_g: 2, gi: 73, calories: 180 }), item({ protein_g: 30, fat_g: 5, calories: 165 }), item({ carbs_g: 6, fiber_g: 4, gi: 15, calories: 30 })]));
check('meal GL is the sum of item GLs', mixed.totals.gl === Math.round((73 * 38 / 100 + 15 * 2 / 100) * 10) / 10, String(mixed.totals.gl));
check('meal GI is carb-weighted', mixed.totals.gi === 70.1, String(mixed.totals.gi));
check('macro percentages sum to 100', mixed.macroPct.carbs + mixed.macroPct.protein + mixed.macroPct.fat === 100);
const m30 = meal([item({ carbs_g: 34, fiber_g: 4, gi: 30 })]);
check('30 g net carbs is green at a 45 g target', C.assess(m30, { carbTarget: 45 }).diabetes.carbLevel === 'green');
check('the same meal is yellow at a 30 g target', C.assess(m30, { carbTarget: 30 }).diabetes.carbLevel === 'yellow');
check('and red at a 20 g target', C.assess(m30, { carbTarget: 20 }).diabetes.carbLevel === 'red');
check('invalid target falls back to 45', C.assess(m30, { carbTarget: 'abc' }).carbTarget === 45);
const empty = C.assess({ items: [] });
check('empty meal: zeros, no NaN', empty.totals.calories === 0 && empty.macroPct.fat === 0 && empty.diabetes.level === 'green' && !/NaN/.test(JSON.stringify(empty)));
const upf = C.assess(meal([item({ nova: 4, calories: 300, sodium_mg: 1800, sat_fat_g: 12, fat_g: 20 })]));
check('ultra-processed, salty, fatty food scores low on clean eating', upf.clean.score === 10 && upf.clean.level === 'red', String(upf.clean.score));
check('salty food gets a sodium tip', upf.tips.some((t) => /natri/.test(t)));
check('walking tip only shown in diabetes mode', !C.assess(C.fromDb(food('Cơm trắng'), 300), { diabetes: false }).tips.some((t) => /đo đường huyết/.test(t)));
check('every verdict carries a Vietnamese label', [apple, rice, soda].every((v) => v.diabetes.label && v.lowCarb.label && v.clean.label));

console.log('two languages');
const reqEn = C.buildRequest({ lang: 'en', note: 'half' }), reqVi = C.buildRequest({ note: 'nửa' });
check('prompt asks for English when the app is in English', /Write dish_name[^\n]*in English\./.test(reqEn.body.system) && /^Analyze the food[^\n]*\nUser note: half$/.test(reqEn.body.messages[0].content[1].text));
check('prompt asks for Vietnamese by default', /Write dish_name[^\n]*in Vietnamese\./.test(reqVi.body.system) && /^Phân tích món ăn/.test(reqVi.body.messages[0].content[1].text));
check('both item names are always requested', /name_vi is always the Vietnamese name and name_en always the English name/.test(reqEn.body.system));
check('unknown language falls back to Vietnamese', C.langOf('fr') === 'vi' && C.langOf(undefined) === 'vi' && C.langOf('en') === 'en');
const riceEn = C.assess(C.fromDb(food('Cơm trắng'), 300, 'en'), { lang: 'en' });
const riceVi = C.assess(C.fromDb(food('Cơm trắng'), 300, 'vi'), { lang: 'vi' });
const viChars = /[àáảãạăâđèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵ]/i;
const enText = JSON.stringify([riceEn.diabetes.label, riceEn.diabetes.reasons, riceEn.tips, riceEn.lowCarb, riceEn.clean, C.fromDb(food('Cơm trắng'), 300, 'en').portion_note]);
check('English verdict, reasons, tips and badges contain no Vietnamese', !viChars.test(enText) && /Likely to spike blood glucose/.test(enText) && /Not low-carb/.test(enText), enText.slice(0, 200));
check('numbers and levels are identical in both languages', JSON.stringify(riceEn.totals) === JSON.stringify(riceVi.totals) && riceEn.diabetes.level === riceVi.diabetes.level && riceEn.clean.score === riceVi.clean.score && riceEn.tips.length === riceVi.tips.length);
check('decimal separator follows the language', /GL\) 60\.9 /.test(riceEn.diabetes.reasons[0]) && /GL\) 60,9 /.test(riceVi.diabetes.reasons[0]), riceEn.diabetes.reasons[0]);
check('offline dish name follows the language', C.fromDb(food('Táo'), 180, 'en').dish_name === 'Apple' && C.fromDb(food('Táo'), 180).dish_name === 'Táo');
check('item name follows the language, with fallbacks', C.itemName({ name_vi: 'Táo', name_en: 'Apple' }, 'en') === 'Apple' && C.itemName({ name_vi: 'Táo', name_en: 'Apple' }, 'vi') === 'Táo' && C.itemName({ name_vi: '', name_en: '' }, 'en') === 'Unnamed food');
check('error messages follow the language', (() => { try { C.extractText(401, '{}', 'en'); } catch (e) { return /^The API key is invalid/.test(e.message); } })() && (() => { try { C.parseAnalysis('x', 'en'); } catch (e) { return /^Could not read/.test(e.message); } })());
check('every model has a label in both languages', C.MODELS.every((m) => m.vi && m.en));

console.log('offline food table');
check('table has at least 60 foods', FOODS.length >= 60, String(FOODS.length));
const broken = FOODS.filter((f) => !(f.vi && f.en && f.kcal >= 0 && f.fiber <= f.carbs && f.sugar <= f.carbs && (f.added || 0) <= f.sugar && (f.sat || 0) <= f.fat && f.gi >= 0 && f.gi <= 100 && [1, 2, 3, 4].includes(f.nova) && f.serving_g > 0));
check('every row is internally consistent', broken.length === 0, broken.map((f) => f.vi).join(', '));
const offKcal = FOODS.filter((f) => f.en !== 'Beer' && Math.abs(f.kcal - (4 * (f.carbs - f.fiber) + 2 * f.fiber + 4 * f.protein + 9 * f.fat)) > Math.max(25, f.kcal * 0.2));
check('calories agree with macros within 20%', offKcal.length === 0, offKcal.map((f) => f.vi).join(', '));
check('names are unique', new Set(FOODS.map((f) => f.vi)).size === FOODS.length);
check('search ignores Vietnamese accents', C.searchFoods(FOODS, 'tao')[0].vi === 'Táo' && C.searchFoods(FOODS, 'pho').some((f) => f.vi === 'Phở bò'));
check('search matches English names', C.searchFoods(FOODS, 'salmon').length >= 1);
check('đ folds to d', C.searchFoods(FOODS, 'dau hu')[0].vi === 'Đậu hũ');
check('empty query lists everything up to the limit', C.searchFoods(FOODS, '', 10).length === 10);
check('unknown food gives an empty list', C.searchFoods(FOODS, 'zzzz').length === 0);
check('portion scales linearly', C.fromDb(food('Táo'), 200).items[0].calories === 104 && C.fromDb(food('Táo'), 0).items[0].grams === 180);

console.log('diary');
const day = C.dayKey(new Date(2026, 10, 10, 8, 0));
check('day key is local YYYY-MM-DD', day === '2026-11-10');
const sum = C.dayTotals([{ day, totals: { calories: 100, netCarbs: 20.2, protein: 5, fat: 1 } }, { day, totals: { calories: 50.5, netCarbs: 10.1, protein: 1, fat: 1 } }, { day: '2026-11-09', totals: { calories: 999 } }, null, { day }], day);
check('day totals add only that day and skip broken rows', sum.calories === 150.5 && sum.netCarbs === 30.3 && sum.count === 2);

console.log('apk build helpers');
check('version ordering is numeric', ['9.0.0', '34.0.0', '35.0.1', '35.0.0'].sort(B.byVersion).pop() === '35.0.1' && ['android-9', 'android-34', 'android-35'].sort(B.byVersion).pop() === 'android-35');
const v = B.versionOf();
check('version.json is valid', /^\d+\.\d+\.\d+$/.test(v.name) && v.code >= 1);
check('missing SDK is reported with the fix', (() => { try { B.findSdk({}); return false; } catch (e) { return /ANDROID_HOME/.test(e.message); } })());
const sdkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foodlens-sdk-'));
['build-tools/33.0.2', 'build-tools/35.0.0', 'build-tools/36.0.0-rc1', 'platforms/android-33', 'platforms/android-34', 'platforms/android-35', 'platforms/android-36'].forEach((d) => fs.mkdirSync(path.join(sdkDir, d), { recursive: true }));
['android-33', 'android-34', 'android-35'].forEach((p) => fs.writeFileSync(path.join(sdkDir, 'platforms', p, 'android.jar'), ''));
const sdk = B.findSdk({ ANDROID_HOME: sdkDir });
check('newest stable build-tools picked', sdk.tools === '35.0.0', sdk.tools);
check('newest platform that has android.jar picked', sdk.platform === 'android-35', sdk.platform);
fs.rmSync(path.join(sdkDir, 'platforms/android-34'), { recursive: true }); fs.rmSync(path.join(sdkDir, 'platforms/android-35'), { recursive: true });
check('platform older than the target SDK is rejected', (() => { try { B.findSdk({ ANDROID_SDK_ROOT: sdkDir }); return false; } catch (e) { return /platforms;android-34/.test(e.message); } })());
fs.rmSync(sdkDir, { recursive: true, force: true });

console.log('bundle wiring');
const read = (p) => fs.readFileSync(path.join(FL, p), 'utf8');
const html = read('web/index.html'), app = read('web/app.js'), css = read('web/style.css');
const uiBlock = (l) => { const m = new RegExp('\\n    ' + l + ': \\{\\n([\\s\\S]*?)\\n    \\},').exec(app); return m ? (m[1].match(/(?:^|[ ,])(\w+): '/gm) || []).map((k) => k.replace(/[^\w]/g, '')) : []; };
const uiVi = uiBlock('vi'), uiEn = uiBlock('en');
check('UI strings: Vietnamese and English tables have the same keys', uiVi.length > 50 && JSON.stringify(uiVi.slice().sort()) === JSON.stringify(uiEn.slice().sort()), uiVi.filter((k) => !uiEn.includes(k)).concat(uiEn.filter((k) => !uiVi.includes(k))).join(', '));
const usedKeys = [...new Set((html.match(/data-i18n(?:-ph)?="(\w+)"/g) || []).map((m) => m.replace(/^.*="|"$/g, '')).concat((app.match(/\bt\('(\w+)'/g) || []).map((m) => m.slice(3, -1)).filter((k) => !k.endsWith('_'))))];
check('every UI key used in the page or the code is translated', usedKeys.length > 40 && usedKeys.every((k) => uiVi.includes(k)), usedKeys.filter((k) => !uiVi.includes(k)).join(', '));
check('language switch buttons present', /id="lang-vi" data-lang="vi"/.test(html) && /id="lang-en" data-lang="en"/.test(html));
const refs = (html.match(/(?:src|href)="([^"]+)"/g) || []).map((m) => m.replace(/^.*="|"$/g, ''));
check('index.html only references local files that exist', refs.length >= 4 && refs.every((r) => !/^https?:/.test(r) && fs.existsSync(path.join(FL, 'web', r))), refs.join(', '));
check('CSP allows only the Claude API and local scripts', /connect-src https:\/\/api\.anthropic\.com"/.test(html) && /script-src 'self'/.test(html) && /default-src 'none'/.test(html));
check('no inline scripts or inline styles (CSP would block them)', !/<script(?![^>]*\bsrc=)/.test(html) && !/\sstyle="/.test(html) && !/style="/.test(app) && !/\son\w+="/.test(html + app));
const ids = (app.match(/\$\('([\w-]+)'\)/g) || []).map((m) => m.slice(3, -2)).filter((id) => !/^(grams|lookup-detail)$/.test(id));
const missingIds = [...new Set(ids)].filter((id) => !new RegExp('id="' + id + '"').test(html));
check('every element id used by app.js exists in index.html', missingIds.length === 0, missingIds.join(', '));
check('camera and gallery inputs present', /id="cam"[^>]*capture="environment"/.test(html) && /id="gal"[^>]*accept="image\/\*"/.test(html));
check('level colours defined for all three levels', ['.lv-green', '.lv-yellow', '.lv-red', '.dot.green', '.dot.yellow', '.dot.red'].every((s) => css.includes(s)));
const manifest = read('android/AndroidManifest.xml'), java = read('android/src/com/foodlens/app/MainActivity.java');
check('manifest: INTERNET only, no CAMERA permission, cleartext off', /android\.permission\.INTERNET/.test(manifest) && (manifest.match(/uses-permission/g) || []).length === 1 && /usesCleartextTraffic="false"/.test(manifest));
check('manifest: launcher activity exported', /android:exported="true"/.test(manifest) && /category\.LAUNCHER/.test(manifest));
check('native bridge only talks to api.anthropic.com', /API_PREFIX = "https:\/\/api\.anthropic\.com\/"/.test(java) && /startsWith\(API_PREFIX\)/.test(java));
check('device self-test hooks match on both sides', /getBooleanExtra\("selftest"/.test(java) && /__flSelfTest/.test(java) && /window\.__flSelfTest = /.test(app) && /public void log\(/.test(java) && /FoodLensNative\.log\(/.test(app));
check('bridge name and callback match app.js', /"FoodLensNative"/.test(java) && /window\.__flNative\(/.test(java) && /window\.FoodLensNative\.post\(/.test(app) && /window\.__flNative = /.test(app));
check('back button hook matches', /__flBack/.test(java) && /window\.__flBack = /.test(app));
check('launcher icon is a PNG', fs.readFileSync(path.join(FL, 'android/res/mipmap-xxxhdpi/ic_launcher.png')).slice(1, 4).toString() === 'PNG');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
