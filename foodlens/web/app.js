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
  function fmt(n) { n = Number(n) || 0; return n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace('.', ','); }

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
      var req = Core.buildRequest({ apiKey: s.apiKey, model: s.model, imageBase64: image.base64, mediaType: image.mediaType, note: note, plain: plain });
      return httpPost(req.url, req.headers, JSON.stringify(req.body));
    }
    return call(false)
      // A 400 usually means the API no longer accepts an optional field; retry once with the bare request.
      .then(function (r) { return r.status === 400 ? call(true) : r; })
      .then(function (r) { return Core.parseAnalysis(Core.extractText(r.status, r.text)); });
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
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh này. Hãy thử ảnh khác.')); };
      img.src = url;
    });
  }

  // ---- result rendering ----------------------------------------------------------------
  var LEVEL_TEXT = { green: 'Thấp', yellow: 'Trung bình', red: 'Cao' };
  function donut(pct) {
    var C = 2 * Math.PI * 42, off = 0;
    var seg = function (color, p) {
      var len = C * p / 100, s = '<circle cx="56" cy="56" r="42" fill="none" stroke="' + color + '" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += len; return s;
    };
    return '<svg viewBox="0 0 112 112" role="img" aria-label="Tỉ lệ năng lượng">' +
      '<circle cx="56" cy="56" r="42" fill="none" stroke="#edf5ea" stroke-width="16"/>' +
      seg('#16a36a', pct.carbs) + seg('#7c5cff', pct.protein) + seg('#ff8a3d', pct.fat) + '</svg>';
  }

  function renderResult(host, analysis, source) {
    var s = settings();
    var v = Core.assess(analysis, { diabetes: s.diabetes, carbTarget: s.carbTarget });
    var t = v.totals, d = v.diabetes;
    var h = '';
    h += '<div class="card res-head" data-level="' + d.level + '"><h2>' + esc(analysis.dish_name) + '</h2>' +
      '<p>' + esc([analysis.cuisine, fmt(t.grams) + ' g', analysis.portion_note].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="verdict lv-' + d.level + '"><span class="light"></span><div><b>' + esc(d.label) + '</b>' +
      '<small>' + (s.diabetes ? 'Ảnh hưởng tới người tiểu đường type 2' : 'Ảnh hưởng tới đường huyết') + '</small></div></div>' +
      '<ul class="reasons">' + d.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';

    h += '<div class="card"><div class="tiles">' +
      '<div class="tile t-kcal"><b>' + fmt(t.calories) + '</b><span>kcal</span></div>' +
      '<div class="tile t-carb"><b>' + fmt(t.netCarbs) + ' g</b><span>carb thực · tổng ' + fmt(t.carbs) + ' g</span></div>' +
      '<div class="tile t-sugar"><b>' + fmt(t.sugar) + ' g</b><span>đường · bổ sung ' + fmt(t.addedSugar) + ' g</span></div>' +
      '<div class="tile t-protein"><b>' + fmt(t.protein) + ' g</b><span>đạm</span></div></div></div>';

    h += '<div class="card"><h3>Tỉ lệ năng lượng</h3><div class="macro">' + donut(v.macroPct) + '<div class="legend">' +
      '<div><i class="dot green"></i>Carb ' + fmt(t.carbs) + ' g<b>' + v.macroPct.carbs + '%</b></div>' +
      '<div><i class="dot protein"></i>Đạm ' + fmt(t.protein) + ' g<b>' + v.macroPct.protein + '%</b></div>' +
      '<div><i class="dot fat"></i>Béo ' + fmt(t.fat) + ' g<b>' + v.macroPct.fat + '%</b></div>' +
      '<div><i class="dot fiber"></i>Chất xơ<b>' + fmt(t.fiber) + ' g</b></div></div></div></div>';

    h += '<div class="card"><h3>Tải đường huyết (GL) ' + fmt(t.gl) + ' · ' + LEVEL_TEXT[d.glLevel] + (t.gi ? ' · GI ≈ ' + Math.round(t.gi) : '') + '</h3>' +
      '<div class="meter"><span class="pin" data-gl="' + t.gl + '"></span></div>' +
      '<div class="scale"><span>0</span><span>10</span><span>20</span><span>40+</span></div></div>';

    h += '<div class="card"><div class="badges">' +
      '<div class="badge lv-' + v.lowCarb.level + '"><em>Low-carb</em><b>' + esc(v.lowCarb.label) + '</b><small>' + esc(v.lowCarb.detail) + '</small></div>' +
      '<div class="badge lv-' + v.clean.level + '"><em>Clean eating</em><b>' + v.clean.score + '/100 · ' + esc(v.clean.label) + '</b><small>' + esc(v.clean.detail) + '</small></div>' +
      '</div></div>';

    h += '<div class="card"><h3>Thành phần khẩu phần</h3><table class="items">' + analysis.items.map(function (it) {
      return '<tr><td><b>' + esc(it.name_vi) + '</b>' + (source === 'ai' ? '<span class="conf">' + Math.round(it.confidence * 100) + '%</span>' : '') +
        '<small>' + esc(it.name_en) + (it.name_en ? ' · ' : '') + fmt(it.grams) + ' g · GI ' + Math.round(it.gi) + ' · NOVA ' + it.nova + '</small></td>' +
        '<td>' + fmt(it.calories) + ' kcal<small>C ' + fmt(it.carbs_g) + ' · Đ ' + fmt(it.protein_g) + ' · B ' + fmt(it.fat_g) + '</small></td></tr>';
    }).join('') + '</table></div>';

    h += '<div class="card"><h3>Nên ăn thế nào</h3><ul class="tips">' + v.tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';

    if (analysis.advice_vi || analysis.swaps_vi.length) {
      h += '<div class="card ai"><h3>Nhận định của AI</h3>' + (analysis.advice_vi ? '<p>' + esc(analysis.advice_vi) + '</p>' : '') +
        analysis.swaps_vi.map(function (x) { return '<div class="swap">Thay thế: ' + esc(x) + '</div>'; }).join('') + '</div>';
    }
    h += '<p class="disclaimer">Số liệu ước tính' + (source === 'ai' ? ' từ hình ảnh' : '') + ', không thay thế tư vấn y khoa và không dùng để chỉnh liều thuốc hay insulin.</p>';
    host.innerHTML = h;
    var pin = host.querySelector('.pin');
    if (pin) pin.style.left = Math.max(1, Math.min(99, t.gl / 40 * 100)) + '%';
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
    if (current === 'diary' && $('diary-result').innerHTML) { $('diary-result').innerHTML = ''; renderDiary(); return true; }
    if (current !== 'scan') { go('scan'); return true; }
    return false;
  };

  // ---- scan ----------------------------------------------------------------------------
  var picked = null, busy = false;
  function showError(msg) { var e = $('scan-error'); e.textContent = msg || ''; e.hidden = !msg; }
  function onPick(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    showError(''); $('scan-result').innerHTML = '';
    readImage(file).then(function (img) {
      picked = img;
      var p = $('preview'); p.className = 'preview'; p.innerHTML = '';
      var el = new Image(); el.alt = 'Ảnh món ăn'; el.src = img.dataUrl; p.appendChild(el);
      $('analyze').disabled = false;
    }).catch(function (e) { picked = null; $('analyze').disabled = true; showError(e.message || 'Không đọc được ảnh.'); });
  }
  function onAnalyze() {
    if (busy || !picked) return;
    if (!settings().apiKey) { showError('Chưa có API key. Mở tab Cài đặt để nhập.'); $('need-key').hidden = false; return; }
    busy = true; showError(''); $('scan-result').innerHTML = ''; $('loading').hidden = false; $('analyze').disabled = true;
    var image = picked;
    analyzeImage(image, $('note').value).then(function (analysis) {
      if (!analysis.is_food) { showError('Không thấy món ăn trong ảnh. ' + (analysis.advice_vi || 'Hãy chụp lại gần và rõ hơn.')); return; }
      var v = renderResult($('scan-result'), analysis, 'ai');
      addToDiary(analysis, v, image.thumb);
      $('scan-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) {
      showError(e && e.message ? e.message : 'Có lỗi khi phân tích. Thử lại.');
    }).then(function () { busy = false; $('loading').hidden = true; $('analyze').disabled = !picked; });
  }

  // ---- lookup --------------------------------------------------------------------------
  var chosen = null;
  function renderFoods() {
    var rows = Core.searchFoods(FOODS, $('q').value, 80);
    $('food-list').innerHTML = rows.length ? rows.map(function (f) {
      var lv = Core.assess(Core.fromDb(f, f.serving_g)).diabetes.level;
      return '<button class="food" data-i="' + FOODS.indexOf(f) + '"><i class="dot ' + lv + '"></i><b>' + esc(f.vi) + '</b><small>' + f.serving_g + ' g · ' + Math.round(f.kcal * f.serving_g / 100) + ' kcal</small></button>';
    }).join('') : '<p class="empty-note">Chưa có trong bảng offline. Hãy chụp ảnh ở tab Chụp để AI phân tích.</p>';
  }
  function showFood(grams) {
    if (!chosen) return;
    var host = $('lookup-result');
    host.innerHTML = '<div class="card"><div class="grams"><b>Khẩu phần (g)</b><input id="grams" class="field" type="number" min="1" max="5000" inputmode="numeric" value="' + Number(grams) + '"></div></div><div id="lookup-detail"></div>';
    renderResult($('lookup-detail'), Core.fromDb(chosen, grams), 'db');
    $('grams').addEventListener('input', function () {
      var g = Number($('grams').value);
      if (g > 0) renderResult($('lookup-detail'), Core.fromDb(chosen, g), 'db');
    });
  }

  // ---- diary ---------------------------------------------------------------------------
  function renderDiary() {
    var list = diary(), today = Core.dayTotals(list, Core.dayKey()), target = settings().carbTarget;
    $('diary-today').innerHTML = '<h3>Hôm nay · ' + today.count + ' món đã chụp</h3><div class="sum">' +
      '<div><b>' + fmt(today.calories) + '</b><span>kcal</span></div><div><b>' + fmt(today.netCarbs) + ' g</b><span>carb thực</span></div>' +
      '<div><b>' + fmt(today.protein) + ' g</b><span>đạm</span></div><div><b>' + fmt(today.fat) + ' g</b><span>béo</span></div></div>' +
      '<p class="hint">Mục tiêu ' + target + ' g carb thực mỗi bữa.</p>';
    $('diary-list').innerHTML = list.length ? list.map(function (e, i) {
      var when = new Date(e.ts), hm = ('0' + when.getHours()).slice(-2) + ':' + ('0' + when.getMinutes()).slice(-2);
      var thumb = typeof e.thumb === 'string' && e.thumb.indexOf('data:image/jpeg;base64,') === 0 ? '<img alt="" src="' + esc(e.thumb) + '">' : '<span class="ph"></span>';
      return '<button class="card entry" data-i="' + i + '">' + thumb + '<div><b>' + esc(e.name) + '</b><small>' + esc(e.day) + ' ' + hm + ' · ' +
        fmt(e.totals && e.totals.calories) + ' kcal · carb thực ' + fmt(e.totals && e.totals.netCarbs) + ' g</small></div><i class="dot ' + (LEVEL_TEXT[e.level] ? e.level : 'green') + '"></i></button>';
    }).join('') : '<p class="empty-note">Chưa có món nào. Mỗi lần phân tích ảnh sẽ tự lưu vào đây.</p>';
    $('diary-clear').hidden = !list.length;
    $('diary-result').innerHTML = '';
  }

  // ---- settings ------------------------------------------------------------------------
  function fillSettings() {
    var s = settings();
    $('set-key').value = s.apiKey; $('set-carb').value = s.carbTarget; $('set-diabetes').checked = s.diabetes;
    $('set-model').innerHTML = Core.MODELS.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === s.model ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('');
    $('set-msg').hidden = true;
  }
  function saveSettings() {
    var carb = Math.round(Number($('set-carb').value));
    save('fl.settings', {
      apiKey: $('set-key').value.trim(), model: $('set-model').value,
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
    try { renderResult($('diary-result'), Core.parseAnalysis(JSON.stringify(e.analysis)), 'ai'); } catch (_) { return; }
    $('diary-list').innerHTML = ''; $('diary-clear').hidden = true;
    window.scrollTo(0, 0);
  });
  $('diary-clear').addEventListener('click', function () {
    if (window.confirm('Xóa toàn bộ nhật ký món ăn?')) { save('fl.diary', []); renderDiary(); }
  });
  $('set-save').addEventListener('click', saveSettings);

  renderFoods();
  go('scan');
})();
