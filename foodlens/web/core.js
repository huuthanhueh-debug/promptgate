// FoodLens core: request builder, response parser and the nutrition rules.
// No DOM, no network: the same file runs in the WebView, a browser and Node (tests).
// The model only identifies food and estimates nutrients; every verdict shown to the
// user (diabetes level, low-carb fit, clean-eating score) is computed here from numbers.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FoodLensCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var API_URL = 'https://api.anthropic.com/v1/messages';
  var MODELS = [
    { id: 'claude-opus-5-5', label: 'Opus 5.5 · chính xác nhất' },
    { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 · cân bằng' },
    { id: 'claude-haiku-5-5', label: 'Haiku 5.5 · nhanh, rẻ' },
  ];
  var DEFAULT_MODEL = MODELS[0].id;
  var DEFAULT_PROFILE = { diabetes: true, carbTarget: 45 };

  var NUM = { type: 'number' };
  var STR = { type: 'string' };
  var ITEM_FIELDS = {
    name_vi: STR, name_en: STR, grams: NUM, calories: NUM, carbs_g: NUM, fiber_g: NUM, sugar_g: NUM,
    added_sugar_g: NUM, protein_g: NUM, fat_g: NUM, sat_fat_g: NUM, sodium_mg: NUM, gi: NUM,
    nova: { type: 'integer', enum: [1, 2, 3, 4] }, confidence: NUM,
  };
  var TOP_FIELDS = {
    is_food: { type: 'boolean' }, dish_name: STR, cuisine: STR, portion_note: STR,
    items: { type: 'array', items: { type: 'object', properties: ITEM_FIELDS, required: Object.keys(ITEM_FIELDS), additionalProperties: false } },
    advice_vi: STR, swaps_vi: { type: 'array', items: STR },
  };
  var SCHEMA = { type: 'object', properties: TOP_FIELDS, required: Object.keys(TOP_FIELDS), additionalProperties: false };

  var SYSTEM = [
    'You are FoodLens, a registered dietitian and professional chef who knows the cuisines and packaged foods of every region of the world.',
    'You receive one photo (and sometimes a short note from the user). Identify every food and drink component that is visible and estimate what the pictured portion contains.',
    '',
    'How to estimate:',
    '- List each distinct component as its own item (rice, grilled pork, dipping sauce, vegetables, drink...). A single fruit or a packaged product is one item.',
    '- Estimate the edible weight in grams of the portion actually shown, using plates, bowls, cutlery, hands and packaging as scale. If the user note gives a quantity, trust the note over the photo.',
    '- Give nutrients for that estimated portion, not per 100 g: calories (kcal), total carbohydrate, fiber, total sugar, added sugar (0 for intrinsic sugar in whole fruit, milk and vegetables), protein, fat, saturated fat (grams) and sodium (mg). Include oil, sauces and sugar a cook would normally use for the dish.',
    '- gi: the typical glycemic index (0-100) of that component from published GI tables; use 0 when it has almost no carbohydrate (meat, eggs, oil, leafy vegetables).',
    '- nova: NOVA processing group, 1 unprocessed or minimally processed, 2 culinary ingredient, 3 processed, 4 ultra-processed.',
    '- confidence: 0 to 1, how sure you are about identification and portion together.',
    '- name_vi is the Vietnamese name, name_en the English name. dish_name is the Vietnamese name of the whole dish or meal. portion_note states in Vietnamese the portion assumption you made.',
    '',
    'advice_vi: two or three short Vietnamese sentences for an adult with type 2 diabetes who also follows clean-eating and low-carb habits: what this food does to blood glucose and how to eat it well (portion, order of eating, pairing). Never give medication or insulin dosing. swaps_vi: up to three concrete lower-carb or less processed swaps in Vietnamese, empty if the food is already a good choice.',
    '',
    'If the photo shows no food or drink, set is_food to false, items to an empty list and explain in advice_vi what you see instead. Do not judge the meal as good or bad with scores; the app computes those from your numbers.',
    'Reply with the JSON object only.',
  ].join('\n');

  function buildRequest(opts) {
    var o = opts || {};
    var text = 'Phân tích món ăn trong ảnh.';
    if (o.note && String(o.note).trim()) text += '\nGhi chú của người dùng: ' + String(o.note).trim().slice(0, 500);
    var body = {
      model: o.model || DEFAULT_MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: o.mediaType || 'image/jpeg', data: o.imageBase64 || '' } },
        { type: 'text', text: text },
      ] }],
    };
    var headers = {
      'content-type': 'application/json',
      'x-api-key': o.apiKey || '',
      'anthropic-version': '2023-06-01',
      // Required for calls made straight from a browser page; harmless from the native bridge.
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (!o.plain) {
      // Full request: schema-constrained JSON, and a server-side fallback model if a safety
      // classifier declines. `plain` drops both for a retry when the API rejects the request shape.
      body.output_config = { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } };
      if (body.model !== 'claude-haiku-5-5') {
        body.fallbacks = 'default';
        headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      }
    }
    return { url: API_URL, headers: headers, body: body };
  }

  function fail(code, message) { var e = new Error(message); e.code = code; return e; }

  // HTTP status + raw body text -> the model's text, or a thrown Error with a Vietnamese message.
  function extractText(status, raw) {
    var j = null;
    try { j = JSON.parse(raw); } catch (_) {}
    if (status < 200 || status >= 300) {
      var detail = j && j.error && j.error.message ? String(j.error.message).slice(0, 200) : '';
      if (status === 401 || status === 403) throw fail('auth', 'API key không hợp lệ hoặc chưa được cấp quyền. Kiểm tra lại trong Cài đặt.');
      if (status === 429) throw fail('rate', 'Đang bị giới hạn tốc độ hoặc hết hạn mức. Thử lại sau ít phút.');
      if (status === 413) throw fail('too_large', 'Ảnh quá lớn. Hãy chụp lại hoặc chọn ảnh nhỏ hơn.');
      if (status === 400) throw fail('bad_request', 'Yêu cầu bị từ chối (400). ' + detail);
      if (status === 0) throw fail('network', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      throw fail('server', 'Máy chủ lỗi (' + status + '). Thử lại sau. ' + detail);
    }
    if (!j || !Array.isArray(j.content)) throw fail('parse', 'Phản hồi không đúng định dạng.');
    if (j.stop_reason === 'refusal') throw fail('refusal', 'Mô hình từ chối phân tích ảnh này. Hãy thử ảnh khác.');
    var text = j.content.filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return c.text; }).join('').trim();
    if (!text) throw fail('parse', j.stop_reason === 'max_tokens' ? 'Phản hồi bị cắt giữa chừng. Thử lại.' : 'Phản hồi rỗng.');
    return text;
  }

  function num(v, max) {
    var n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
  }
  function str(v, max) { return (v == null ? '' : String(v)).trim().slice(0, max); }
  function r1(n) { return Math.round(n * 10) / 10; }

  function cleanItem(it) {
    it = it && typeof it === 'object' ? it : {};
    var carbs = num(it.carbs_g, 2000);
    var fiber = Math.min(num(it.fiber_g, 500), carbs);
    var sugar = Math.min(num(it.sugar_g, 2000), carbs);
    var fat = num(it.fat_g, 1000);
    var nova = Math.round(num(it.nova, 4));
    return {
      name_vi: str(it.name_vi, 80) || str(it.name_en, 80) || 'Món chưa rõ tên',
      name_en: str(it.name_en, 80),
      grams: num(it.grams, 5000), calories: num(it.calories, 10000),
      carbs_g: carbs, fiber_g: fiber, sugar_g: sugar, added_sugar_g: Math.min(num(it.added_sugar_g, 2000), sugar),
      protein_g: num(it.protein_g, 1000), fat_g: fat, sat_fat_g: Math.min(num(it.sat_fat_g, 1000), fat),
      sodium_mg: num(it.sodium_mg, 50000), gi: num(it.gi, 100),
      nova: nova >= 1 && nova <= 4 ? nova : 1,
      confidence: num(it.confidence == null ? 0.5 : it.confidence, 1),
    };
  }

  // Model text -> sanitized analysis. Tolerates code fences and prose around the JSON object.
  function parseAnalysis(text) {
    var s = String(text || '');
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw fail('parse', 'Không đọc được kết quả phân tích. Thử lại.');
    var j;
    try { j = JSON.parse(s.slice(a, b + 1)); } catch (_) { throw fail('parse', 'Không đọc được kết quả phân tích. Thử lại.'); }
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw fail('parse', 'Không đọc được kết quả phân tích. Thử lại.');
    var items = (Array.isArray(j.items) ? j.items : []).slice(0, 30).map(cleanItem);
    var isFood = j.is_food !== false && items.length > 0;
    return {
      is_food: isFood,
      dish_name: str(j.dish_name, 100) || (items[0] ? items[0].name_vi : ''),
      cuisine: str(j.cuisine, 60), portion_note: str(j.portion_note, 300),
      items: isFood ? items : [],
      advice_vi: str(j.advice_vi, 800),
      swaps_vi: (Array.isArray(j.swaps_vi) ? j.swaps_vi : []).slice(0, 3).map(function (x) { return str(x, 160); }).filter(Boolean),
    };
  }

  var RANK = { green: 0, yellow: 1, red: 2 };
  function worst(a, b) { return RANK[b] > RANK[a] ? b : a; }

  function totalsOf(items) {
    var t = { grams: 0, calories: 0, carbs: 0, fiber: 0, sugar: 0, addedSugar: 0, protein: 0, fat: 0, satFat: 0, sodium: 0, netCarbs: 0, gl: 0, gi: 0 };
    var novaKcal = 0;
    items.forEach(function (it) {
      var net = Math.max(0, it.carbs_g - it.fiber_g);
      t.grams += it.grams; t.calories += it.calories; t.carbs += it.carbs_g; t.fiber += it.fiber_g;
      t.sugar += it.sugar_g; t.addedSugar += it.added_sugar_g; t.protein += it.protein_g; t.fat += it.fat_g;
      t.satFat += it.sat_fat_g; t.sodium += it.sodium_mg; t.netCarbs += net; t.gl += it.gi * net / 100;
      novaKcal += it.nova * Math.max(it.calories, 1);
    });
    t.gi = t.netCarbs > 0.5 ? t.gl * 100 / t.netCarbs : 0;
    t.nova = items.length ? novaKcal / items.reduce(function (s, it) { return s + Math.max(it.calories, 1); }, 0) : 1;
    Object.keys(t).forEach(function (k) { t[k] = r1(t[k]); });
    return t;
  }

  // Glycemic load of the portion: <10 low, 10-19 medium, >=20 high.
  // Net carbs are judged against the user's per-meal target (default 45 g): up to 2/3 of it is
  // comfortable, up to 4/3 needs care, beyond that is too much for one sitting.
  // Added sugar: over 10 g needs care, over 25 g (the WHO daily ideal) is too much.
  function assess(analysis, profile) {
    var p = Object.assign({}, DEFAULT_PROFILE, profile || {});
    var target = num(p.carbTarget, 300) || DEFAULT_PROFILE.carbTarget;
    var items = (analysis && analysis.items) || [];
    var t = totalsOf(items);
    var reasons = [], tips = [];

    var glLevel = t.gl >= 20 ? 'red' : t.gl >= 10 ? 'yellow' : 'green';
    var carbLevel = t.netCarbs > target * 4 / 3 ? 'red' : t.netCarbs > target * 2 / 3 ? 'yellow' : 'green';
    var sugarLevel = t.addedSugar > 25 ? 'red' : t.addedSugar > 10 ? 'yellow' : 'green';
    var level = worst(worst(glLevel, carbLevel), sugarLevel);

    reasons.push('Tải đường huyết (GL) ' + t.gl + ' · ' + (glLevel === 'green' ? 'thấp' : glLevel === 'yellow' ? 'trung bình' : 'cao'));
    reasons.push('Carb thực ' + t.netCarbs + ' g so với mục tiêu ' + target + ' g/bữa');
    if (t.addedSugar > 0.5) reasons.push('Đường bổ sung ' + t.addedSugar + ' g');
    if (t.fiber >= 5) reasons.push('Chất xơ ' + t.fiber + ' g giúp hấp thu đường chậm hơn');
    if (t.protein >= 15) reasons.push('Đạm ' + t.protein + ' g giúp no lâu, đường huyết ổn định hơn');

    if (glLevel === 'red') tips.push('Giảm một nửa phần tinh bột, hoặc chia món này thành hai lần ăn.');
    if (carbLevel !== 'green') tips.push('Ăn rau và đạm trước, tinh bột sau cùng để đường huyết lên chậm hơn.');
    if (sugarLevel !== 'green') tips.push('Bỏ bớt nước sốt ngọt, nước ngọt hoặc phần tráng miệng có đường.');
    if (t.netCarbs > 15 && t.fiber < 3) tips.push('Thêm rau xanh hoặc salad để bù chất xơ.');
    if (t.netCarbs > 15 && t.protein < 10) tips.push('Ăn kèm trứng, cá, thịt nạc hoặc đậu hũ để cân bằng bữa.');
    if (t.sodium > 1500) tips.push('Món khá mặn (' + Math.round(t.sodium) + ' mg natri); hạn chế chan nước dùng, nước chấm.');
    if (level !== 'green' && p.diabetes) tips.push('Đi bộ 10 đến 15 phút sau ăn và đo đường huyết sau 2 giờ để biết cơ thể phản ứng thế nào.');
    if (level === 'green') tips.unshift('Khẩu phần này phù hợp, có thể ăn nguyên lượng như trong ảnh.');

    var dLabel = { green: 'An toàn cho đường huyết', yellow: 'Ăn có kiểm soát', red: 'Dễ làm tăng đường huyết' }[level];

    var lc = t.netCarbs <= 20 ? { level: 'green', label: 'Low-carb chặt (keto)' }
      : t.netCarbs <= 45 ? { level: 'yellow', label: 'Low-carb vừa' }
        : { level: 'red', label: 'Không low-carb' };
    lc.detail = 'Carb thực ' + t.netCarbs + ' g/khẩu phần';

    var novaPenalty = t.nova <= 1 ? 0 : t.nova <= 2 ? (t.nova - 1) * 10 : t.nova <= 3 ? 10 + (t.nova - 2) * 20 : 30 + (t.nova - 3) * 30;
    var score = 100 - novaPenalty - Math.min(20, t.addedSugar * 2) - (t.sodium > 1500 ? 20 : t.sodium > 800 ? 10 : 0) - (t.satFat > 10 ? 10 : 0);
    score = Math.max(0, Math.min(100, Math.round(score)));
    var clean = { score: score, level: score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red' };
    clean.label = { green: 'Clean', yellow: 'Tạm ổn', red: 'Chế biến nhiều' }[clean.level];
    clean.detail = 'NOVA trung bình ' + t.nova + (t.addedSugar > 0.5 ? ' · đường bổ sung ' + t.addedSugar + ' g' : '') + (t.sodium > 800 ? ' · natri ' + Math.round(t.sodium) + ' mg' : '');

    var kc = t.carbs * 4, kp = t.protein * 4, kf = t.fat * 9, sum = kc + kp + kf;
    var macroPct = sum > 0
      ? { carbs: Math.round(kc * 100 / sum), protein: Math.round(kp * 100 / sum), fat: 0 }
      : { carbs: 0, protein: 0, fat: 0 };
    if (sum > 0) macroPct.fat = 100 - macroPct.carbs - macroPct.protein;

    return {
      totals: t, macroPct: macroPct,
      diabetes: { level: level, label: dLabel, reasons: reasons, glLevel: glLevel, carbLevel: carbLevel, sugarLevel: sugarLevel },
      lowCarb: lc, clean: clean, tips: tips, carbTarget: target,
    };
  }

  // Offline lookup: a database row (per 100 g) scaled to a portion, in the same shape the model returns.
  function fromDb(food, grams) {
    var g = num(grams, 5000) || food.serving_g || 100;
    var k = g / 100;
    return {
      is_food: true, dish_name: food.vi, cuisine: '', portion_note: g + ' g · số liệu trung bình từ bảng thành phần thực phẩm',
      items: [cleanItem({
        name_vi: food.vi, name_en: food.en, grams: g, calories: food.kcal * k, carbs_g: food.carbs * k, fiber_g: food.fiber * k,
        sugar_g: food.sugar * k, added_sugar_g: (food.added || 0) * k, protein_g: food.protein * k, fat_g: food.fat * k,
        sat_fat_g: (food.sat || 0) * k, sodium_mg: (food.sodium || 0) * k, gi: food.gi, nova: food.nova, confidence: 0.9,
      })],
      advice_vi: '', swaps_vi: [],
    };
  }

  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim();
  }
  function searchFoods(db, q, limit) {
    var needle = fold(q);
    var rows = (db || []).filter(function (f) { return !needle || fold(f.vi).indexOf(needle) >= 0 || fold(f.en).indexOf(needle) >= 0; });
    return rows.slice(0, limit || 50);
  }

  // Sum of the diary entries logged on the given local day.
  function dayTotals(entries, dayKey) {
    var t = { calories: 0, netCarbs: 0, protein: 0, fat: 0, count: 0 };
    (entries || []).forEach(function (e) {
      if (!e || e.day !== dayKey || !e.totals) return;
      t.calories += e.totals.calories || 0; t.netCarbs += e.totals.netCarbs || 0;
      t.protein += e.totals.protein || 0; t.fat += e.totals.fat || 0; t.count++;
    });
    Object.keys(t).forEach(function (k) { t[k] = r1(t[k]); });
    return t;
  }
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  return {
    API_URL: API_URL, MODELS: MODELS, DEFAULT_MODEL: DEFAULT_MODEL, DEFAULT_PROFILE: DEFAULT_PROFILE, SCHEMA: SCHEMA, SYSTEM: SYSTEM,
    buildRequest: buildRequest, extractText: extractText, parseAnalysis: parseAnalysis, assess: assess,
    fromDb: fromDb, searchFoods: searchFoods, dayTotals: dayTotals, dayKey: dayKey, fold: fold,
  };
});
