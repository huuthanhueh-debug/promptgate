// PromptGate popup: settings live in chrome.storage.local under "settings" and are read by the
// content script on claude.ai as they change. Nothing here touches the network.
(function () {
  'use strict';
  const DEFAULTS = { enabled: true, mode: 'balanced', depthProfile: 'auto', language: 'auto', licenseKey: '' };
  const $ = (id) => document.getElementById(id);

  function load(cb) {
    chrome.storage.local.get({ settings: null }, (r) => cb(Object.assign({}, DEFAULTS, r.settings || {})));
  }

  function patch(p) {
    chrome.storage.local.get({ settings: null }, (r) => {
      chrome.storage.local.set({ settings: Object.assign({}, DEFAULTS, r.settings || {}, p) });
    });
  }

  function showStatus(s) {
    const key = s.licenseKey;
    $('status').textContent = key
      ? 'Đã lưu khóa. Tính năng Pro chưa mở trong extension. Kích hoạt bằng /promptgate:activate trong Claude Code.'
      : 'Chưa có khóa. Bản miễn phí vẫn đầy đủ tính năng chấm điểm và ba bản viết lại.';
  }

  load((s) => {
    $('enabled').checked = !!s.enabled;
    $('mode').value = s.mode;
    $('depth').value = s.depthProfile;
    $('lang').value = s.language;
    $('key').value = s.licenseKey || '';
    showStatus(s);
  });

  $('enabled').addEventListener('change', (e) => patch({ enabled: e.target.checked }));
  $('mode').addEventListener('change', (e) => patch({ mode: e.target.value }));
  $('depth').addEventListener('change', (e) => patch({ depthProfile: e.target.value }));
  $('lang').addEventListener('change', (e) => patch({ language: e.target.value }));
  $('save').addEventListener('click', () => {
    const licenseKey = $('key').value.trim();
    patch({ licenseKey });
    showStatus({ licenseKey });
  });
})();
