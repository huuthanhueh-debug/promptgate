# Changelog

## Unreleased — Vision 6D (Android, three.js)
- New `mobile/`: **Vision 6D**, an Android app (WebView shell + three.js r170, vendored). Take or pick a photo, then either view it as a depth relief you move on six axes (J1–J6: yaw, pitch, roll, x, y, z; touch, sliders or gyroscope; photo / mixed / hologram styles; layer teardown), or, when the photo shows a person, overlay a holographic anatomy model (skeleton, organs, vessels, DNA helix, Vietnamese labels with info cards).
- Fully offline: the APK asks for CAMERA only, no INTERNET permission. Depth and person detection are heuristics over pixels, no ML model.
- `node mobile/build.js [--apk]` builds the web bundle and the APK straight from the Android SDK tools (aapt2, javac, d8, apksigner) with an in-repo aligned zip writer. No Gradle, no npm dependencies. Workflow `mobile-apk` builds, verifies and uploads the APK.
- Tests: `tests/mobile.js` (heuristics, pose math, anatomy data, scene builders on real three.js, build, zip, APK contents where an SDK exists), wired into `node tests/run.js`; `tests/mobile-e2e.js` drives the page in Chromium (optional, needs Playwright).

## 1.3.1 — 2026-11-03 — doctor
- New `/promptgate:doctor [--fix]` (`npm run doctor`): one command that checks every edition on this machine — plugin registration and a live hook run, Windows tray process, claude.ai bundle freshness, the optional virtual-office widget — and with `--fix` starts the tray and rebuilds the extension. `--json` for scripts; exit 1 only when the plugin or hook is broken.
- Tests: `tests/doctor.js` (helpers with synthetic input + a real run in a temp config dir), wired into `node tests/run.js`.
- Gumroad listing got a cover image (the A/B/C panel screenshot).

## 1.3.0 — 2026-11-03 — everything is free
- No more Pro tier. The four domain packs (`coding`, `writing`, `business`, `hospitality`) now ship in `packs/` next to `general`; tier-2 rewrite (`/promptgate:brain llm`) and the full history report (per-project, weekly, 20 weakest, HTML dashboard) need no key.
- `/promptgate:activate` only prints a note; `isPro()` always returns true so older callers keep working. `scripts/build-pro.js` removed.
- Packs dropped into `~/.claude/promptgate/packs/` are still merged (custom packs); copies of built-in packs there are skipped, so machines that installed the old Pro zip are not double-loaded.
- Docs: README EN/VI, SPEC, team install guide, launch posts updated. Gumroad listing switched to $0 and referenced from the other toolkits' receipts.

## Unreleased — Chrome extension for claude.ai (preview)
- New `extension/`: Manifest V3 extension. A "PG nn" badge sits by the composer and updates as you type. Ctrl+Shift+P or a click opens a panel with score, missing dimensions and three rewrites (A Lean / B Standard / C Deep). Choosing one replaces the composer text; nothing is sent.
- The engine is bundled from `scripts/lib/` by `npm run build:ext` (no copy). Node-only parts (`fs`, `path`, `os`) are swapped for browser shims.
- Popup: on/off, threshold, depth profile, suggestion language, Pro key stored locally (does not unlock Pro in the extension yet).
- Permissions: `storage` and claude.ai only. No network calls.
- 0.1.1: panel buttons were unclickable (focus inside the panel rebuilt it mid-click); multi-line rewrites are now inserted via a synthetic paste so each line stays its own paragraph. Verified on the live claude.ai.
- 0.1.2: panel height is capped to the space available above or below the composer (it ran off-screen at 1280×800). Store screenshots added in `extension/store/`.
- 0.1.3: bundles all five packs (general, coding, writing, business, hospitality) like the plugin; the unused Pro key field is gone from the popup. Zip rebuilt for the store.
- 0.1.2 submitted to the Chrome Web Store on 2026-11-03 and approved. Listing: https://chromewebstore.google.com/detail/ohfifdheanlidimoffbkbkednifkpiae

## 1.2.0 — 2026-11-02
- Phase 2: **Windows tray with a global hotkey** (`tray/`). Select a prompt in any app, press Ctrl+Alt+P, get score, task type, missing dimensions and three filled-in rewrites A Lean / B Standard / C Deep next to the cursor; click or press A/B/C to copy, optional paste-over. Same engine via Node (`tray/core.js`), PowerShell 5.1 + WinForms host, nothing to install: `tray\PromptGate.cmd` or `npm run tray`.
- Rule-based A/B/C composer (`tray/lib/compose.js`): fills context from paths, URLs, error lines, `@file` mentions and the source window title; per-type default constraints so B has no empty placeholders. Tier 2 (Pro) button reuses `brain-llm.js`.
- Tray menu: enable/disable, change hotkey, paste-over, tier 2, open history, open data folder, start with Windows, quit. Settings live in `config.json` under `tray`.
- Tray scores are logged as `action: "tray"` (no prompt text) and show up in `/promptgate:history`.
- Tests: `tests/tray.js` (composer, core bridge, config, logging), wired into `node tests/run.js`.

## 1.1.0 — 2026-11-02
- New default `suggest` mode: weak prompts are no longer stopped. The hook asks Claude to write three expert rewrites (A Lean / B Standard / C Deep) with every gap filled from conversation context and to offer them as clickable choices plus "Send as written". Nothing to retype.
- Classic gate kept as `/promptgate:config block`.
- Status shows the active action; log records `suggest` events.

## 1.0.0 — 2026-11-02
- First release: UserPromptSubmit gate with 7-dimension scoring, VI/EN rewrite, depth profiles, cooldown and bypass.
- Commands: status, optimize, history, config, brain, activate.
- Local history scanner with Markdown report (Pro: per-project, weekly trend, HTML dashboard).
- Free pack `general`; Pro packs `coding`, `writing`, `business`, `hospitality` (sold separately).