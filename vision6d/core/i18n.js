// Language helpers shared by the Vision 6D apps (Vietnamese and English). Each app keeps its own
// string table and calls translate() on it. Pure functions: no DOM.

export const LANGS = Object.freeze(['vi', 'en']);

export function normalizeLang(lang) {
  const l = String(lang || '').toLowerCase().slice(0, 2);
  return LANGS.includes(l) ? l : null;
}

// Stored choice wins, then the device language, then Vietnamese.
export function pickLang(stored, deviceLang) {
  return normalizeLang(stored) || normalizeLang(deviceLang) || 'vi';
}

export function otherLang(lang) {
  return normalizeLang(lang) === 'en' ? 'vi' : 'en';
}

// Looks a key up in a { vi: {...}, en: {...} } table, filling {placeholders}.
// Falls back to Vietnamese, then to the key itself.
export function translate(table, lang, key, vars) {
  const cur = table[normalizeLang(lang) || 'vi'] || {};
  const s = key in cur ? cur[key] : key in table.vi ? table.vi[key] : key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}
