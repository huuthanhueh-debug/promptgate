// FoodLens UI: tabs, photo capture, the analysis call, result rendering, diary and settings.
// Every string that comes from the model or from storage goes through esc() before it reaches
// the DOM. Network calls use the native bridge inside the Android app and fetch in a browser.
(function () {
  'use strict';
  var Core = window.FoodLensCore, FOODS = window.FoodLensFoods;
  var $ = function (id) { return document.getElementById(id); };
  var MAX_SIDE = 1568, DIARY_MAX = 60, TIMEOUT_MS = 120000;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fmt(n) { n = Number(n) || 0; var s = n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10); return lang === 'vi' ? s.replace('.', ',') : s; }

  // ---- language ------------------------------------------------------------------------
  var UI = {
    vi: {
      tagline: 'Chụp món ăn, hiểu ngay khẩu phần', need_key_title: 'Cần API key để phân tích ảnh',
      need_key_body: 'Nhập Anthropic API key một lần trong Cài đặt. Tab Tra cứu dùng được ngay, không cần mạng.',
      open_settings: 'Mở Cài đặt', preview_empty: 'Ảnh món ăn sẽ hiện ở đây', take_photo: 'Chụp ảnh', pick_photo: 'Chọn từ máy',
      note_ph: 'Ghi chú (không bắt buộc): 1 chén cơm, ăn nửa phần…', analyze: 'Phân tích khẩu phần',
      loading: 'Đang nhận diện món ăn và ước lượng khẩu phần…', search_ph: 'Tìm thực phẩm: táo, phở, cơm, sữa chua…',
      clear_diary: 'Xóa toàn bộ nhật ký', set_key: 'Anthropic API key',
      set_key_hint: 'Key chỉ lưu trong bộ nhớ riêng của app trên máy này và chỉ gửi tới api.anthropic.com. Tạo key tại console.anthropic.com.',
      set_model: 'Mô hình phân tích', set_carb: 'Mục tiêu carb thực mỗi bữa (g)', set_diabetes: 'Tôi theo dõi đường huyết (tiểu đường type 2)',
      save: 'Lưu cài đặt', saved: 'Đã lưu.', about_title: 'Cách FoodLens đánh giá',
      about_body: 'AI nhận diện món và ước lượng gram, calo, carb, đường, đạm, béo. Mức ảnh hưởng đường huyết, low-carb và clean eating được app tính từ các con số đó: tải đường huyết GL (dưới 10 thấp, từ 20 cao), carb thực so với mục tiêu bữa, đường bổ sung và mức độ chế biến NOVA.',
      about_hint: 'Số liệu là ước tính từ hình ảnh, có thể lệch 20 đến 30%. Không thay thế tư vấn của bác sĩ; không dùng để chỉnh liều thuốc hay insulin.',
      tab_scan: 'Chụp', tab_lookup: 'Tra cứu', tab_diary: 'Nhật ký', tab_settings: 'Cài đặt',
      lv_green: 'Thấp', lv_yellow: 'Trung bình', lv_red: 'Cao', for_t2d: 'Ảnh hưởng tới người tiểu đường type 2', for_glucose: 'Ảnh hưởng tới đường huyết',
      net_carbs: 'carb thực · tổng {0} g', sugar: 'đường · bổ sung {0} g', protein: 'đạm', energy_split: 'Tỉ lệ năng lượng',
      m_carb: 'Carb', m_protein: 'Đạm', m_fat: 'Béo', m_fiber: 'Chất xơ', gl_title: 'Tải đường huyết (GL)',
      components: 'Thành phần khẩu phần', short_macros: 'C {0} · Đ {1} · B {2}', how_to_eat: 'Nên ăn thế nào', ai_view: 'Nhận định của AI', swap: 'Thay thế: ',
      disclaimer_ai: 'Số liệu ước tính từ hình ảnh, không thay thế tư vấn y khoa và không dùng để chỉnh liều thuốc hay insulin.',
      disclaimer_db: 'Số liệu ước tính, không thay thế tư vấn y khoa và không dùng để chỉnh liều thuốc hay insulin.',
      photo_alt: 'Ảnh món ăn', bad_image: 'Không đọc được ảnh này. Hãy thử ảnh khác.', no_key: 'Chưa có API key. Mở tab Cài đặt để nhập.',
      not_food: 'Không thấy món ăn trong ảnh. ', not_food_hint: 'Hãy chụp lại gần và rõ hơn.', failed: 'Có lỗi khi phân tích. Thử lại.',
      not_in_table: 'Chưa có trong bảng offline. Hãy chụp ảnh ở tab Chụp để AI phân tích.', portion_g: 'Khẩu phần (g)',
      today: 'Hôm nay · {0} món đã chụp', d_net: 'carb thực', d_protein: 'đạm', d_fat: 'béo', target_hint: 'Mục tiêu {0} g carb thực mỗi bữa.',
      entry_meta: '{0} kcal · carb thực {1} g', diary_empty: 'Chưa có món nào. Mỗi lần phân tích ảnh sẽ tự lưu vào đây.', confirm_clear: 'Xóa toàn bộ nhật ký món ăn?',
    },
    en: {
      tagline: 'Snap your food, see the portion', need_key_title: 'An API key is needed to analyze photos',
      need_key_body: 'Enter your Anthropic API key once in Settings. The Lookup tab works right away, with no network.',
      open_settings: 'Open Settings', preview_empty: 'Your food photo will appear here', take_photo: 'Take photo', pick_photo: 'Choose photo',
      note_ph: 'Note (optional): 1 bowl of rice, half portion…', analyze: 'Analyze portion',
      loading: 'Identifying the food and estimating the portion…', search_ph: 'Search foods: apple, pho, rice, yogurt…',
      clear_diary: 'Clear the whole diary', set_key: 'Anthropic API key',
      set_key_hint: 'The key stays in the private storage of this app on this phone and is only sent to api.anthropic.com. Create one at console.anthropic.com.',
      set_model: 'Analysis model', set_carb: 'Net carb target per meal (g)', set_diabetes: 'I track my blood glucose (type 2 diabetes)',
      save: 'Save settings', saved: 'Saved.', about_title: 'How FoodLens rates food',
      about_body: 'AI identifies the food and estimates grams, calories, carbs, sugar, protein and fat. The app then computes the blood glucose, low-carb and clean-eating ratings from those numbers: glycemic load GL (under 10 low, 20 and up high), net carbs against your meal target, added sugar and the NOVA processing level.',
      about_hint: 'Figures are estimates from a photo and can be off by 20 to 30%. Not a substitute for advice from your doctor; do not use them to adjust medication or insulin.',
      tab_scan: 'Scan', tab_lookup: 'Lookup', tab_diary: 'Diary', tab_settings: 'Settings',
      lv_green: 'Low', lv_yellow: 'Medium', lv_red: 'High', for_t2d: 'Effect for people with type 2 diabetes', for_glucose: 'Effect on blood glucose',
      net_carbs: 'net carbs · total {0} g', sugar: 'sugar · added {0} g', protein: 'protein', energy_split: 'Energy split',
      m_carb: 'Carbs', m_protein: 'Protein', m_fat: 'Fat', m_fiber: 'Fiber', gl_title: 'Glycemic load (GL)',
      components: 'What is in the portion', short_macros: 'C {0} · P {1} · F {2}', how_to_eat: 'How to eat it', ai_view: 'AI notes', swap: 'Swap: ',
      disclaimer_ai: 'Estimates from a photo. Not medical advice, and not for adjusting medication or insulin.',
      disclaimer_db: 'Estimates. Not medical advice, and not for adjusting medication or insulin.',
      photo_alt: 'Food photo', bad_image: 'Could not read this image. Try another one.', no_key: 'No API key yet. Open the Settings tab to enter one.',
      not_food: 'No food found in the photo. ', not_food_hint: 'Retake it closer and sharper.', failed: 'The analysis failed. Try again.',
      not_in_table: 'Not in the offline table. Take a photo in the Scan tab and let AI analyze it.', portion_g: 'Portion (g)',
      today: 'Today · {0} foods scanned', d_net: 'net carbs', d_protein: 'protein', d_fat: 'fat', target_hint: 'Target: {0} g net carbs per meal.',
      entry_meta: '{0} kcal · net carbs {1} g', diary_empty: 'Nothing yet. Every photo you analyze is saved here.', confirm_clear: 'Clear the whole food diary?',
    },
  };
  var lang = 'vi';
  function t(key, a, b, c) {
    var args = [a, b, c];
    return UI[lang][key].replace(/\{(\d)\}/g, function (_, i) { return args[Number(i)] == null ? '' : String(args[Number(i)]); });
  }
  function applyLang() {
    document.documentElement.lang = lang;
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (e) { e.textContent = t(e.dataset.i18n); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-ph]'), function (e) { e.placeholder = t(e.dataset.i18nPh); });
    Array.prototype.forEach.call(document.querySelectorAll('.lang button'), function (b) { b.classList.toggle('on', b.dataset.lang === lang); });
  }
  function foodName(f) { return lang === 'en' ? f.en : f.vi; }

  // ---- storage -------------------------------------------------------------------------
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (_) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
  function settings() {
    var s = load('fl.settings', {}) || {};
    return {
      apiKey: typeof s.apiKey === 'string' ? s.apiKey : '',
      model: Core.MODELS.some(function (m) { return m.id === s.model; }) ? s.model : Core.DEFAULT_MODEL,
      carbTarget: Number(s.carbTarget) >= 10 && Number(s.carbTarget) <= 150 ? Number(s.carbTarget) : Core.DEFAULT_PROFILE.carbTarget,
      diabetes: s.diabetes !== false,
      lang: Core.langOf(s.lang),
    };
  }
  function diary() { var d = load('fl.diary', []); return Array.isArray(d) ? d : []; }
  function addToDiary(analysis, verdict, thumb) {
    var list = diary();
    list.unshift({ id: Date.now(), ts: Date.now(), day: Core.dayKey(), name: analysis.dish_name, thumb: thumb || '', level: verdict.diabetes.level, totals: verdict.totals, analysis: analysis });
    list = list.slice(0, DIARY_MAX);
    // Thumbnails are the bulky part: if the quota is hit, drop them from the oldest entries first.
    for (var i = list.length - 1; !save('fl.diary', list) && i >= 0; i--) list[i].thumb = '';
  }

  // ---- network -------------------------------------------------------------------------
  var pending = {}, seq = 0;
  window.__flNative = function (id, status, text) {
    var p = pending[id];
    if (!p) return;
    delete pending[id]; clearTimeout(p.timer);
    p.resolve({ status: Number(status) || 0, text: String(text == null ? '' : text) });
  };
  function httpPost(url, headers, body) {
    if (window.FoodLensNative && typeof window.FoodLensNative.post === 'function') {
      return new Promise(function (resolve) {
        var id = 'r' + (++seq);
        var timer = setTimeout(function () { delete pending[id]; resolve({ status: 0, text: '' }); }, TIMEOUT_MS + 5000);
        pending[id] = { resolve: resolve, timer: timer };
        window.FoodLensNative.post(id, url, JSON.stringify(headers), body);
      });
    }
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    return fetch(url, { method: 'POST', headers: headers, body: body, signal: ctrl.signal })
      .then(function (res) { return res.text().then(function (text) { return { status: res.status, text: text }; }); })
      .catch(function () { return { status: 0, text: '' }; })
      .then(function (r) { clearTimeout(t); return r; });
  }

  function analyzeImage(image, note) {
    var s = settings();
    function call(plain) {
      var req = Core.buildRequest({ apiKey: s.apiKey, model: s.model, imageBase64: image.base64, mediaType: image.mediaType, note: note, plain: plain, lang: lang });
      return httpPost(req.url, req.headers, JSON.stringify(req.body));
    }
    return call(false)
      // A 400 usually means the API no longer accepts an optional field; retry once with the bare request.
      .then(function (r) { return r.status === 400 ? call(true) : r; })
      .then(function (r) { return Core.parseAnalysis(Core.extractText(r.status, r.text, lang), lang); });
  }

  // ---- image ---------------------------------------------------------------------------
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var jpeg = function (side, q) {
            var k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
            var ctx = c.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
            return c.toDataURL('image/jpeg', q);
          };
          var full = jpeg(MAX_SIDE, 0.85);
          resolve({ dataUrl: full, base64: full.slice(full.indexOf(',') + 1), mediaType: 'image/jpeg', thumb: jpeg(160, 0.7) });
        } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(t('bad_image'))); };
      img.src = url;
    });
  }

  // ---- result rendering ----------------------------------------------------------------
  var LEVELS = { green: 1, yellow: 1, red: 1 };
  function donut(pct) {
    var C = 2 * Math.PI * 42, off = 0;
    var seg = function (color, p) {
      var len = C * p / 100, s = '<circle cx="56" cy="56" r="42" fill="none" stroke="' + color + '" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += len; return s;
    };
    return '<svg viewBox="0 0 112 112" role="img" aria-label="' + esc(t('energy_split')) + '">' +
      '<circle cx="56" cy="56" r="42" fill="none" stroke="#edf5ea" stroke-width="16"/>' +
      seg('#16a36a', pct.carbs) + seg('#7c5cff', pct.protein) + seg('#ff8a3d', pct.fat) + '</svg>';
  }

  function renderResult(host, analysis, source) {
    var s = settings();
    var v = Core.assess(analysis, { diabetes: s.diabetes, carbTarget: s.carbTarget, lang: lang });
    var tt = v.totals, d = v.diabetes;
    var h = '';
    h += '<div class="card res-head" data-level="' + d.level + '"><h2>' + esc(analysis.dish_name) + '</h2>' +
      '<p>' + esc([analysis.cuisine, fmt(tt.grams) + ' g', analysis.portion_note].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="verdict lv-' + d.level + '"><span class="light"></span><div><b>' + esc(d.label) + '</b>' +
      '<small>' + esc(t(s.diabetes ? 'for_t2d' : 'for_glucose')) + '</small></div></div>' +
      '<ul class="reasons">' + d.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';

    h += '<div class="card"><div class="tiles">' +
      '<div class="tile t-kcal"><b>' + fmt(tt.calories) + '</b><span>kcal</span></div>' +
      '<div class="tile t-carb"><b>' + fmt(tt.netCarbs) + ' g</b><span>' + esc(t('net_carbs', fmt(tt.carbs))) + '</span></div>' +
      '<div class="tile t-sugar"><b>' + fmt(tt.sugar) + ' g</b><span>' + esc(t('sugar', fmt(tt.addedSugar))) + '</span></div>' +
      '<div class="tile t-protein"><b>' + fmt(tt.protein) + ' g</b><span>' + esc(t('protein')) + '</span></div></div></div>';

    h += '<div class="card"><h3>' + esc(t('energy_split')) + '</h3><div class="macro">' + donut(v.macroPct) + '<div class="legend">' +
      '<div><i class="dot green"></i>' + esc(t('m_carb')) + ' ' + fmt(tt.carbs) + ' g<b>' + v.macroPct.carbs + '%</b></div>' +
      '<div><i class="dot protein"></i>' + esc(t('m_protein')) + ' ' + fmt(tt.protein) + ' g<b>' + v.macroPct.protein + '%</b></div>' +
      '<div><i class="dot fat"></i>' + esc(t('m_fat')) + ' ' + fmt(tt.fat) + ' g<b>' + v.macroPct.fat + '%</b></div>' +
      '<div><i class="dot fiber"></i>' + esc(t('m_fiber')) + '<b>' + fmt(tt.fiber) + ' g</b></div></div></div></div>';

    h += '<div class="card"><h3>' + esc(t('gl_title')) + ' ' + fmt(tt.gl) + ' · ' + esc(t('lv_' + d.glLevel)) + (tt.gi ? ' · GI ≈ ' + Math.round(tt.gi) : '') + '</h3>' +
      '<div class="meter"><span class="pin"></span></div>' +
      '<div class="scale"><span>0</span><span>10</span><span>20</span><span>40+</span></div></div>';

    h += '<div class="card"><div class="badges">' +
      '<div class="badge lv-' + v.lowCarb.level + '"><em>Low-carb</em><b>' + esc(v.lowCarb.label) + '</b><small>' + esc(v.lowCarb.detail) + '</small></div>' +
      '<div class="badge lv-' + v.clean.level + '"><em>Clean eating</em><b>' + v.clean.score + '/100 · ' + esc(v.clean.label) + '</b><small>' + esc(v.clean.detail) + '</small></div>' +
      '</div></div>';

    h += '<div class="card"><h3>' + esc(t('components')) + '</h3><table class="items">' + analysis.items.map(function (it) {
      var other = lang === 'en' ? it.name_vi : it.name_en;
      if (other === Core.itemName(it, lang)) other = '';
      return '<tr><td><b>' + esc(Core.itemName(it, lang)) + '</b>' + (source === 'ai' ? '<span class="conf">' + Math.round(it.confidence * 100) + '%</span>' : '') +
        '<small>' + esc(other) + (other ? ' · ' : '') + fmt(it.grams) + ' g · GI ' + Math.round(it.gi) + ' · NOVA ' + it.nova + '</small></td>' +
        '<td>' + fmt(it.calories) + ' kcal<small>' + esc(t('short_macros', fmt(it.carbs_g), fmt(it.protein_g), fmt(it.fat_g))) + '</small></td></tr>';
    }).join('') + '</table></div>';

    h += '<div class="card"><h3>' + esc(t('how_to_eat')) + '</h3><ul class="tips">' + v.tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';

    if (analysis.advice || analysis.swaps.length) {
      h += '<div class="card ai"><h3>' + esc(t('ai_view')) + '</h3>' + (analysis.advice ? '<p>' + esc(analysis.advice) + '</p>' : '') +
        analysis.swaps.map(function (x) { return '<div class="swap">' + esc(t('swap') + x) + '</div>'; }).join('') + '</div>';
    }
    h += '<p class="disclaimer">' + esc(t(source === 'ai' ? 'disclaimer_ai' : 'disclaimer_db')) + '</p>';
    host.innerHTML = h;
    var pin = host.querySelector('.pin');
    if (pin) pin.style.left = Math.max(1, Math.min(99, tt.gl / 40 * 100)) + '%';
    return v;
  }

  // ---- tabs ----------------------------------------------------------------------------
  var TABS = ['scan', 'lookup', 'diary', 'settings'], current = 'scan';
  function go(tab) {
    current = tab;
    TABS.forEach(function (t) { $('view-' + t).hidden = t !== tab; });
    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    if (tab === 'diary') renderDiary();
    if (tab === 'settings') fillSettings();
    if (tab === 'scan') $('need-key').hidden = !!settings().apiKey;
    window.scrollTo(0, 0);
  }
  // Android back button: leave an open detail or a secondary tab first; false lets the app close.
  window.__flBack = function () {
    if (current === 'diary' && openEntry) { renderDiary(); return true; }
    if (current !== 'scan') { go('scan'); return true; }
    return false;
  };

  // ---- scan ----------------------------------------------------------------------------
  var picked = null, busy = false, lastScan = null;
  function showError(msg) { var e = $('scan-error'); e.textContent = msg || ''; e.hidden = !msg; }
  function onPick(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    showError(''); $('scan-result').innerHTML = ''; lastScan = null;
    readImage(file).then(function (img) {
      picked = img;
      var p = $('preview'); p.className = 'preview'; p.innerHTML = '';
      var el = new Image(); el.alt = t('photo_alt'); el.src = img.dataUrl; p.appendChild(el);
      $('analyze').disabled = false;
    }).catch(function (e) { picked = null; $('analyze').disabled = true; showError(e.message || t('bad_image')); });
  }
  function onAnalyze() {
    if (busy || !picked) return;
    if (!settings().apiKey) { showError(t('no_key')); $('need-key').hidden = false; return; }
    busy = true; lastScan = null; showError(''); $('scan-result').innerHTML = ''; $('loading').hidden = false; $('analyze').disabled = true;
    var image = picked;
    analyzeImage(image, $('note').value).then(function (analysis) {
      if (!analysis.is_food) { showError(t('not_food') + (analysis.advice || t('not_food_hint'))); return; }
      lastScan = analysis;
      var v = renderResult($('scan-result'), analysis, 'ai');
      addToDiary(analysis, v, image.thumb);
      $('scan-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) {
      showError(e && e.message ? e.message : t('failed'));
    }).then(function () { busy = false; $('loading').hidden = true; $('analyze').disabled = !picked; });
  }

  // ---- lookup --------------------------------------------------------------------------
  var chosen = null;
  function renderFoods() {
    var rows = Core.searchFoods(FOODS, $('q').value, 80);
    $('food-list').innerHTML = rows.length ? rows.map(function (f) {
      var lv = Core.assess(Core.fromDb(f, f.serving_g), { carbTarget: settings().carbTarget }).diabetes.level;
      return '<button class="food" data-i="' + FOODS.indexOf(f) + '"><i class="dot ' + lv + '"></i><b>' + esc(foodName(f)) + '</b><small>' + f.serving_g + ' g · ' + Math.round(f.kcal * f.serving_g / 100) + ' kcal</small></button>';
    }).join('') : '<p class="empty-note">' + esc(t('not_in_table')) + '</p>';
  }
  function showFood(grams) {
    if (!chosen) return;
    var host = $('lookup-result');
    host.innerHTML = '<div class="card"><div class="grams"><b>' + esc(t('portion_g')) + '</b><input id="grams" class="field" type="number" min="1" max="5000" inputmode="numeric" value="' + Number(grams) + '"></div></div><div id="lookup-detail"></div>';
    renderResult($('lookup-detail'), Core.fromDb(chosen, grams, lang), 'db');
    $('grams').addEventListener('input', function () {
      var g = Number($('grams').value);
      if (g > 0) renderResult($('lookup-detail'), Core.fromDb(chosen, g, lang), 'db');
    });
  }

  // ---- diary ---------------------------------------------------------------------------
  var openEntry = null;
  function showEntry(e) {
    var analysis;
    try { analysis = Core.parseAnalysis(JSON.stringify(e.analysis), lang); } catch (_) { return; }
    openEntry = e;
    renderResult($('diary-result'), analysis, 'ai');
    $('diary-list').innerHTML = ''; $('diary-clear').hidden = true;
  }
  function renderDiary() {
    openEntry = null;
    var list = diary(), today = Core.dayTotals(list, Core.dayKey()), target = settings().carbTarget;
    $('diary-today').innerHTML = '<h3>' + esc(t('today', today.count)) + '</h3><div class="sum">' +
      '<div><b>' + fmt(today.calories) + '</b><span>kcal</span></div><div><b>' + fmt(today.netCarbs) + ' g</b><span>' + esc(t('d_net')) + '</span></div>' +
      '<div><b>' + fmt(today.protein) + ' g</b><span>' + esc(t('d_protein')) + '</span></div><div><b>' + fmt(today.fat) + ' g</b><span>' + esc(t('d_fat')) + '</span></div></div>' +
      '<p class="hint">' + esc(t('target_hint', target)) + '</p>';
    $('diary-list').innerHTML = list.length ? list.map(function (e, i) {
      var when = new Date(e.ts), hm = ('0' + when.getHours()).slice(-2) + ':' + ('0' + when.getMinutes()).slice(-2);
      var thumb = typeof e.thumb === 'string' && e.thumb.indexOf('data:image/jpeg;base64,') === 0 ? '<img alt="" src="' + esc(e.thumb) + '">' : '<span class="ph"></span>';
      return '<button class="card entry" data-i="' + i + '">' + thumb + '<div><b>' + esc(e.name) + '</b><small>' + esc(e.day) + ' ' + hm + ' · ' +
        esc(t('entry_meta', fmt(e.totals && e.totals.calories), fmt(e.totals && e.totals.netCarbs))) + '</small></div><i class="dot ' + (LEVELS[e.level] ? e.level : 'green') + '"></i></button>';
    }).join('') : '<p class="empty-note">' + esc(t('diary_empty')) + '</p>';
    $('diary-clear').hidden = !list.length;
    $('diary-result').innerHTML = '';
  }

  // ---- settings ------------------------------------------------------------------------
  function fillSettings() {
    var s = settings();
    $('set-key').value = s.apiKey; $('set-carb').value = s.carbTarget; $('set-diabetes').checked = s.diabetes;
    $('set-model').innerHTML = Core.MODELS.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === s.model ? ' selected' : '') + '>' + esc(m.label + ' · ' + m[lang]) + '</option>'; }).join('');
    $('set-msg').hidden = true;
  }
  function saveSettings() {
    var carb = Math.round(Number($('set-carb').value));
    save('fl.settings', {
      lang: lang, apiKey: $('set-key').value.trim(), model: $('set-model').value,
      carbTarget: carb >= 10 && carb <= 150 ? carb : Core.DEFAULT_PROFILE.carbTarget, diabetes: $('set-diabetes').checked,
    });
    fillSettings(); $('set-msg').hidden = false;
  }

  // ---- wiring --------------------------------------------------------------------------
  document.querySelector('.tabs').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) go(b.dataset.tab); });
  document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  $('cam').addEventListener('change', onPick);
  $('gal').addEventListener('change', onPick);
  $('analyze').addEventListener('click', onAnalyze);
  $('q').addEventListener('input', renderFoods);
  $('food-list').addEventListener('click', function (ev) {
    var b = ev.target.closest('.food'); if (!b) return;
    chosen = FOODS[Number(b.dataset.i)]; showFood(chosen.serving_g);
    $('lookup-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('diary-list').addEventListener('click', function (ev) {
    var b = ev.target.closest('.entry'); if (!b) return;
    var e = diary()[Number(b.dataset.i)]; if (!e || !e.analysis) return;
    showEntry(e);
    window.scrollTo(0, 0);
  });
  $('diary-clear').addEventListener('click', function () {
    if (window.confirm(t('confirm_clear'))) { save('fl.diary', []); renderDiary(); }
  });
  $('set-save').addEventListener('click', saveSettings);

  // Language switch: redraw whatever is on screen. Text the AI already wrote stays in the language it was written in.
  function setLang(next) {
    lang = Core.langOf(next);
    var s = load('fl.settings', {}) || {}; s.lang = lang; save('fl.settings', s);
    applyLang(); renderFoods();
    if (chosen && $('grams')) showFood(Number($('grams').value) || chosen.serving_g);
    if (lastScan) renderResult($('scan-result'), lastScan, 'ai');
    if (current === 'diary') { var e = openEntry; renderDiary(); if (e) showEntry(e); }
    if (current === 'settings') fillSettings();
  }
  document.querySelector('.lang').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b && b.dataset.lang !== lang) setLang(b.dataset.lang); });

  // Inside the Android app: tell the shell the page is alive, and answer its launch self-test
  // (adb ... --ez selftest true) with one keyless call that must come back as HTTP 401.
  function nativeLog(msg) { if (window.FoodLensNative && typeof window.FoodLensNative.log === 'function') window.FoodLensNative.log(String(msg)); }
  window.__flSelfTest = function () {
    var req = Core.buildRequest({ apiKey: 'selftest', imageBase64: 'AAAA', plain: true });
    return httpPost(req.url, req.headers, JSON.stringify(req.body)).then(function (r) { nativeLog('selftest http ' + r.status); });
  };

  lang = settings().lang;
  applyLang();
  renderFoods();
  go('scan');
  nativeLog('ready lang=' + lang + ' foods=' + FOODS.length + ' tabs=' + document.querySelectorAll('.tabs button').length);
})();
