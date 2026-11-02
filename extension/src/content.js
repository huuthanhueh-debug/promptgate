// PromptGate content script for claude.ai. Thin DOM glue over globalThis.PromptGateCore (engine.js
// loads first, see manifest.json). Everything stays in the page; nothing is sent anywhere.
(function () {
  'use strict';
  if (window.__promptgateLoaded) return;
  window.__promptgateLoaded = true;
  const PG = globalThis.PromptGateCore;
  if (!PG || typeof chrome === 'undefined' || !chrome.storage) return;

  const CSS = `
    :host { all: initial; }
    .pg-btn { font: 600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 6px 10px; border-radius: 999px;
      border: 1px solid rgba(0,0,0,.15); background: #fff; color: #222; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.15); white-space: nowrap; }
    .pg-btn[data-band="low"] { background: #fdecea; color: #922b21; border-color: #f1948a; }
    .pg-btn[data-band="mid"] { background: #fef5e7; color: #7e5109; border-color: #f8c471; }
    .pg-btn[data-band="high"] { background: #eafaf1; color: #196f3d; border-color: #82e0aa; }
    .pg-btn[data-band="idle"] { opacity: .6; }
    .pg-panel { position: absolute; right: 0; width: min(380px, calc(100vw - 24px)); max-height: 70vh; overflow: auto; box-sizing: border-box;
      background: #1f1f1e; color: #eee; border-radius: 12px; padding: 12px; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,.35); }
    .pg-panel[data-dir="up"] { bottom: calc(100% + 8px); }
    .pg-panel[data-dir="down"] { top: calc(100% + 8px); }
    .pg-panel[hidden] { display: none; }
    .pg-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .pg-score { font-size: 18px; font-weight: 700; }
    .pg-meta { opacity: .75; font-size: 12px; }
    .pg-chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0 2px; }
    .pg-chip { background: #3a3a38; border-radius: 999px; padding: 2px 8px; font-size: 11px; }
    .pg-card { border: 1px solid #3d3d3b; border-radius: 10px; padding: 8px; margin-top: 8px; }
    .pg-card.rec { border-color: #7aa7ff; }
    .pg-card h4 { margin: 0 0 4px; font-size: 12px; display: flex; justify-content: space-between; gap: 6px; }
    .pg-card pre { white-space: pre-wrap; word-break: break-word; margin: 0 0 6px; font-family: inherit; font-size: 12px; max-height: 150px; overflow: auto;
      background: #161615; padding: 6px; border-radius: 6px; }
    .pg-badge { font-size: 10px; background: #2b4c8c; border-radius: 999px; padding: 1px 6px; }
    .pg-action { font: 600 12px system-ui, sans-serif; padding: 5px 9px; border-radius: 8px; border: 1px solid #555; background: #2d2d2b; color: #eee; cursor: pointer; }
    .pg-primary { background: #c96442; border-color: #c96442; color: #fff; }
    .pg-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px; }
    .pg-hint { font-size: 11px; opacity: .7; margin-top: 6px; }
  `;

  let settings = Object.assign({}, PG.DEFAULT_SETTINGS);
  let composer = null;
  let panelOpen = false;
  let timer = null;
  let bodyTimer = null;

  const host = document.createElement('div');
  host.id = 'promptgate-host';
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483646; display: none;';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  const btn = document.createElement('button');
  btn.className = 'pg-btn';
  btn.type = 'button';
  btn.textContent = 'PG';
  const panel = document.createElement('div');
  panel.className = 'pg-panel';
  panel.hidden = true;
  root.append(style, btn, panel);

  // Keep the composer focused when the badge is pressed.
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); togglePanel(); });

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fallbackLang() {
    if (settings.language === 'vi' || settings.language === 'en') return settings.language;
    return (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
  }

  function setBtn(label, bandName, title) {
    btn.textContent = label;
    btn.dataset.band = bandName;
    btn.title = title;
  }

  function place() {
    if (!composer || !composer.isConnected || !settings.enabled || settings.mode === 'off') {
      host.style.display = 'none';
      closePanel();
      return false;
    }
    const r = composer.getBoundingClientRect();
    if (!r.width || !r.height) { host.style.display = 'none'; return false; }
    const top = r.top >= 44 ? r.top - 32 : r.bottom + 6;
    const left = Math.min(r.right - 96, window.innerWidth - 110);
    host.style.left = Math.max(8, left) + 'px';
    host.style.top = Math.max(4, top) + 'px';
    host.style.display = '';
    panel.dataset.dir = top > 330 ? 'up' : 'down';
    return true;
  }

  function pageContext() {
    const main = document.querySelector('main');
    const text = (main || document.body).innerText || '';
    return PG.contextFrom(text.slice(-4000));
  }

  function renderPanel() {
    if (!panelOpen) return;
    const text = PG.readComposer(composer);
    panel.replaceChildren();
    if (!text.trim()) {
      panel.append(el('div', 'pg-meta', PG.ui(fallbackLang()).empty));
      return;
    }
    const v = PG.variants(text, { language: settings.language, depth: settings.depthProfile }, pageContext());
    const ev = v.ev;
    const T = ev.T;
    const U = PG.ui(ev.lang);

    const head = el('div', 'pg-head');
    head.append(
      el('span', 'pg-score', `${ev.score}/100`),
      el('span', 'pg-meta', `${U.type}: ${ev.typeLabel} · ${U.depth}: ${ev.depthLabel}`),
    );
    panel.append(head);

    const chips = el('div', 'pg-chips');
    if (ev.missing.length) {
      chips.append(el('span', 'pg-meta', U.missing + ':'));
      for (const k of ev.missing) chips.append(el('span', 'pg-chip', T.dims[k] || k));
    } else {
      chips.append(el('span', 'pg-meta', U.complete));
    }
    panel.append(chips);
    panel.append(el('div', 'pg-meta', U.variants));

    for (const k of ['A', 'B', 'C']) {
      const card = el('div', 'pg-card' + (v.rec === k ? ' rec' : ''));
      const h = el('h4');
      h.append(el('span', null, U[k]));
      if (v.rec === k) h.append(el('span', 'pg-badge', U.rec));
      card.append(h, el('pre', null, v[k]));
      const use = el('button', 'pg-action' + (v.rec === k ? ' pg-primary' : ''), U.use);
      use.type = 'button';
      use.addEventListener('click', (e) => { e.preventDefault(); applyVariant(v[k]); });
      card.append(use);
      panel.append(card);
    }

    const foot = el('div', 'pg-foot');
    const keep = el('button', 'pg-action', U.keep);
    keep.type = 'button';
    keep.addEventListener('click', (e) => { e.preventDefault(); closePanel(); if (composer) composer.focus(); });
    const close = el('button', 'pg-action', U.close);
    close.type = 'button';
    close.addEventListener('click', (e) => { e.preventDefault(); closePanel(); });
    foot.append(keep, close);
    panel.append(foot);
    panel.append(el('div', 'pg-hint', U.keepHint));
  }

  function applyVariant(text) {
    if (!composer) return;
    PG.writeComposer(composer, text, document);
    closePanel();
    schedule(0);
  }

  function openPanel() {
    if (!composer) composer = PG.findComposer(document);
    if (!composer || !place()) return;
    panelOpen = true;
    panel.hidden = false;
    renderPanel();
  }

  function closePanel() {
    panelOpen = false;
    panel.hidden = true;
  }

  function togglePanel() {
    if (panelOpen) closePanel(); else openPanel();
  }

  function update() {
    timer = null;
    composer = PG.findComposer(document);
    if (!place()) return;
    const text = PG.readComposer(composer);
    if (!text.trim()) {
      setBtn('PG –', 'idle', PG.ui(fallbackLang()).empty);
    } else {
      const ev = PG.evaluate(text, { language: settings.language });
      setBtn(`PG ${ev.score}`, PG.band(ev.score, settings.mode), PG.ui(ev.lang).buttonTitle);
    }
    if (panelOpen) renderPanel();
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(update, ms == null ? 300 : ms);
  }

  // Re-attach the badge when claude.ai re-renders its layout (it is a single-page app).
  function refresh() {
    bodyTimer = null;
    if (!host.isConnected) document.body.appendChild(host);
    const found = PG.findComposer(document);
    if (found !== composer) schedule(0);
    else place();
  }

  function onKeydown(e) {
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'P' || e.key === 'p')) {
      if (!settings.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    } else if (e.key === 'Escape' && panelOpen) {
      closePanel();
    }
  }

  function start() {
    document.body.appendChild(host);
    document.addEventListener('input', () => schedule(), true);
    document.addEventListener('focusin', () => schedule(0), true);
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    new MutationObserver(() => {
      if (bodyTimer) return;
      bodyTimer = setTimeout(refresh, 400);
    }).observe(document.body, { childList: true, subtree: true });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) {
        settings = Object.assign({}, PG.DEFAULT_SETTINGS, changes.settings.newValue || {});
        schedule(0);
      }
    });
    schedule(0);
  }

  chrome.storage.local.get({ settings: null }, (res) => {
    if (res && res.settings) settings = Object.assign({}, PG.DEFAULT_SETTINGS, res.settings);
    start();
  });
})();
