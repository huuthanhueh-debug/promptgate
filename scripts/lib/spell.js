'use strict';
// Spelling auto-fix for prompts (EN + VI), shared by every edition through engine.cleanFiller():
// Claude Code plugin, Windows tray and the claude.ai extension (bundled by extension/build.js).
// Only unambiguous, common mistakes: a word that is valid on its own ("sữa" = milk, "cant") is fixed
// only inside a phrase that makes the intent clear. Code spans, URLs, paths and file names are left as is.

const VI_MARKS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const PRE = '(?<![\\p{L}\\p{N}_\'])';
const POST = '(?![\\p{L}\\p{N}_])';

// Case-insensitive; the original's case is copied onto the fix (Seperate → Separate, TEH → THE).
const EN = {
  teh: 'the', hte: 'the', adn: 'and', taht: 'that', wiht: 'with', thier: 'their', freind: 'friend',
  recieve: 'receive', recieved: 'received', beleive: 'believe', seperate: 'separate', seperately: 'separately',
  definately: 'definitely', definatly: 'definitely', occured: 'occurred', occurence: 'occurrence', untill: 'until',
  wich: 'which', becuase: 'because', beacuse: 'because', becasue: 'because', adress: 'address', adresses: 'addresses',
  enviroment: 'environment', existance: 'existence', accomodate: 'accommodate', acheive: 'achieve', arguement: 'argument',
  calender: 'calendar', comming: 'coming', commited: 'committed', completly: 'completely', concious: 'conscious',
  dependancy: 'dependency', dependecy: 'dependency', desicion: 'decision', diffrent: 'different', excercise: 'exercise',
  finaly: 'finally', fucntion: 'function', funtion: 'function', goverment: 'government', grammer: 'grammar',
  happend: 'happened', immediatly: 'immediately', independant: 'independent', informaton: 'information', lenght: 'length',
  maintainance: 'maintenance', managment: 'management', neccessary: 'necessary', necesary: 'necessary',
  occassion: 'occasion', paramter: 'parameter', paramters: 'parameters', perfomance: 'performance', posible: 'possible',
  prefered: 'preferred', priviledge: 'privilege', recomend: 'recommend', recomendation: 'recommendation', refered: 'referred',
  relevent: 'relevant', responce: 'response', sucess: 'success', succesful: 'successful', successfull: 'successful',
  suprise: 'surprise', tommorow: 'tomorrow', tomorow: 'tomorrow', truely: 'truly', wierd: 'weird', writting: 'writing',
  dont: "don't", doesnt: "doesn't", didnt: "didn't", isnt: "isn't", wasnt: "wasn't", shouldnt: "shouldn't",
  couldnt: "couldn't", wouldnt: "wouldn't", havent: "haven't", hasnt: "hasn't", arent: "aren't",
  prmot: 'prompt', prmots: 'prompts', promt: 'prompt', promts: 'prompts',
  reponse: 'response', resturant: 'restaurant', accross: 'across', aswell: 'as well', alot: 'a lot',
  promt: 'prompt', promts: 'prompts',
};
// Only in English text (no Vietnamese marks): Vietnamese prompts may use "i" as a variable name.
const EN_ONLY = { i: 'I', im: "I'm", ive: "I've" };

// Vietnamese: wrong tone mark (hỏi/ngã), common teen-code shorthand, phrases where one word is a valid
// homonym. Matched case-insensitively except SHORT, which only fixes lowercase/Capitalized forms (DC, KO stay).
const VI = {
  'lổi': 'lỗi', 'nhửng': 'những', 'dử liệu': 'dữ liệu', 'giử': 'giữ', 'kiễm tra': 'kiểm tra', 'hướng dẩn': 'hướng dẫn',
  'trả lởi': 'trả lời', 'chính sát': 'chính xác', 'giúp đở': 'giúp đỡ', 'đuợc': 'được', 'đựoc': 'được', 'đươc': 'được',
  'xãy ra': 'xảy ra', 'sữa lỗi': 'sửa lỗi', 'sữa chữa': 'sửa chữa', 'sữa đổi': 'sửa đổi', 'sữa lại': 'sửa lại',
  'bảo cáo': 'báo cáo', 'khách sạng': 'khách sạn', 'cãi thiện': 'cải thiện', 'củng được': 'cũng được', 'củng có': 'cũng có',
  'bôi đăn': 'bôi đen', 'bôi đem': 'bôi đen', 'bôi đẹn': 'bôi đen', 'nhất tổ hợp': 'nhấn tổ hợp', 'nhất phím': 'nhấn phím', 'nhất nút': 'nhấn nút', 'nghỉ là': 'nghĩ là', 'suy nghỉ': 'suy nghĩ', 'kỉ năng': 'kỹ năng',
  'promtgate': 'PromptGate', 'prmotgate': 'PromptGate', 'promotgate': 'PromptGate', 'promptgte': 'PromptGate',
  'promgate': 'PromptGate', 'prompgate': 'PromptGate', 'sàn lọc': 'sàng lọc',
};
const SHORT = {
  ko: 'không', hok: 'không', dc: 'được', 'đc': 'được', vd: 'ví dụ', ntn: 'như thế nào',
  kq: 'kết quả', mik: 'mình', mn: 'mọi người', bth: 'bình thường', cx: 'cũng',
};
const FIXED_CASE = new Set(['PromptGate']);

// Never touched: fenced/inline code, URLs, anything with a slash or backslash (paths), file names, @mentions.
const PROTECT = /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|[^\s`]*[\/\\][^\s`]*|[^\s`]+\.[A-Za-z]{1,5}(?![\p{L}])|@\S+/gu;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
const rule = (froms, to, flags) => ({ re: new RegExp(PRE + '(' + [].concat(froms).map(esc).join('|') + ')' + POST, flags), to });
const RULES_ALL = []
  .concat(Object.keys(EN).map((k) => rule(k, EN[k], 'giu')))
  .concat(Object.keys(VI).map((k) => rule(k, VI[k], 'giu')))
  .concat(Object.keys(SHORT).map((k) => rule([k, k.charAt(0).toUpperCase() + k.slice(1)], SHORT[k], 'gu')));
const RULES_EN_ONLY = Object.keys(EN_ONLY).filter((k) => EN_ONLY[k]).map((k) => rule(k, EN_ONLY[k], 'gu'));
const DOUBLE_EN = new RegExp(PRE + '(the|a|an|to|of|and|in|is|for|on|that|it|with)\\s+\\1' + POST, 'giu');

// Vietnamese only, two general steps (a word list cannot keep up with how people type):
// 1) tone mark on the wrong vowel of an open ưa/ua/ia syllable: "sưả" → "sửa", "cuả" → "của", "điạ" → "địa".
//    qu- and gi- syllables are left alone ("quả", "giả" are already right).
// 2) Telex keys left unconverted: "Tooi" → "Tôi", stray capital in front ("YTooi" → "Tôi"). A token is changed only when
//    the converted form is a common Vietnamese syllable, so English words (room, book, see, been, teen) never match.
const TONED = { a: 'àáảãạ', 'ă': 'ằắẳẵặ', 'â': 'ầấẩẫậ', e: 'èéẻẽẹ', 'ê': 'ềếểễệ', i: 'ìíỉĩị', o: 'òóỏõọ', 'ô': 'ồốổỗộ', 'ơ': 'ờớởỡợ', u: 'ùúủũụ', 'ư': 'ừứửữự', y: 'ỳýỷỹỵ' };
const TONE_SPOT = new RegExp(PRE + '([bcdđghklmnpqrstvx]{0,3})([ưui])([àáảãạ])' + POST, 'giu');
function fixTone(s, note) {
  return s.replace(TONE_SPOT, (m, init, v, a) => {
    const lv = v.toLowerCase(), li = init.toLowerCase();
    if ((lv === 'u' && li.endsWith('q')) || (lv === 'i' && li.endsWith('g'))) return m;
    const t = TONED.a.indexOf(a.toLowerCase());
    const toned = TONED[lv][t];
    return note(m, init + (v === lv ? toned : toned.toUpperCase()) + (a === a.toLowerCase() ? 'a' : 'A'));
  });
}
const TELEX_WORDS = new Set(('tôi không đã được đến để đi đó đây đâu đầu đều đang đúng đủ đơn đổi đọc đặt cần cũng vẫn nếu người những với về '
  + 'việc viết biết hiện hôm thấy thêm trên trước tốt tổng câu cấu nhập xuất mở mới chưa chương bước phòng ổn rồi rất như thể muốn cấp tất '
  + 'sửa lỗi gửi giờ năm tuần ngày tháng hướng dẫn cuối đầy kiểm sẵn ơn').split(' '));
const TELEX_TOKEN = new RegExp(PRE + '([A-Za-z]{2,9})' + POST, 'gu');
function telex(w) {
  let tone = -1;
  if (w.length > 2 && 'sfrxj'.includes(w.slice(-1))) { tone = 'fsrxj'.indexOf(w.slice(-1)); w = w.slice(0, -1); }
  w = w.replace(/dd/g, 'đ').replace(/uwow|uow/g, 'ươ').replace(/aa/g, 'â').replace(/ee/g, 'ê').replace(/oo/g, 'ô')
    .replace(/aw/g, 'ă').replace(/ow/g, 'ơ').replace(/uw/g, 'ư');
  if (w.includes('w')) return null;
  if (tone >= 0) {
    let i = w.includes('ươ') ? w.indexOf('ơ') : w.search(/[âêôơăư]/);
    if (i < 0) { const vs = [...w.matchAll(/[aeiouy]/g)]; if (!vs.length) return null; i = vs[vs.length - 1].index; }
    w = w.slice(0, i) + TONED[w[i]][tone] + w.slice(i + 1);
  }
  return w;
}
function fixTelex(s, note) {
  return s.replace(TELEX_TOKEN, (tok) => {
    let word = tok;
    if (/^[A-Z][A-Z][a-z]+$/.test(word)) word = word.slice(1);          // stray capital typed in front
    if (!/aa|ee|oo|dd|aw|ow|uw/i.test(word)) return tok;
    const v = telex(word.toLowerCase());
    if (!v || !TELEX_WORDS.has(v)) return tok;
    return note(tok, word.charAt(0) !== word.charAt(0).toLowerCase() ? v.charAt(0).toUpperCase() + v.slice(1) : v);
  });
}

function matchCase(orig, fix) {
  if (FIXED_CASE.has(fix) || fix === 'I' || /^I'/.test(fix)) return fix;
  if (orig.length > 1 && orig === orig.toUpperCase() && orig !== orig.toLowerCase()) return fix.toUpperCase();
  if (orig.charAt(0) !== orig.charAt(0).toLowerCase()) return fix.charAt(0).toUpperCase() + fix.slice(1);
  return fix;
}

function fixPlain(s, english, log) {
  const note = (from, to) => { if (log && from !== to && !log.some((f) => f.from === from)) log.push({ from, to }); return to; };
  for (const r of RULES_ALL) s = s.replace(r.re, (m) => note(m, matchCase(m, r.to)));
  if (english) {
    for (const r of RULES_EN_ONLY) s = s.replace(r.re, (m) => note(m, r.to));
    s = s.replace(DOUBLE_EN, (m, w) => note(m, w));
  } else {
    s = fixTelex(fixTone(s, note), note);
  }
  return s;
}

// Same as fixSpelling, plus the list of fixes made: [{ from, to }] (unique, in order of appearance).
function spellCheck(text) {
  const fixes = [];
  const src = String(text == null ? '' : text);
  if (!src.trim()) return { text: src, fixes };
  const english = !VI_MARKS.test(src);
  let out = '', last = 0, m;
  PROTECT.lastIndex = 0;
  while ((m = PROTECT.exec(src))) {
    out += fixPlain(src.slice(last, m.index), english, fixes) + m[0];
    last = m.index + m[0].length;
    if (m[0].length === 0) PROTECT.lastIndex++;
  }
  return { text: out + fixPlain(src.slice(last), english, fixes), fixes };
}

// Returns the text with spelling fixed; protected spans (code, URLs, paths) come back byte-for-byte.
function fixSpelling(text) { return spellCheck(text).text; }

module.exports = { fixSpelling, spellCheck };
