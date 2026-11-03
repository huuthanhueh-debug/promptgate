# Changelog

## Unreleased — Chrome extension for claude.ai (preview)
- New `extension/`: Manifest V3 extension. A "PG nn" badge sits by the composer and updates as you type. Ctrl+Shift+P or a click opens a panel with score, missing dimensions and three rewrites (A Lean / B Standard / C Deep). Choosing one replaces the composer text; nothing is sent.
- The engine is bundled from `scripts/lib/` by `npm run build:ext` (no copy). Node-only parts (`fs`, `path`, `os`) are swapped for browser shims.
- Popup: on/off, threshold, depth profile, suggestion language, Pro key stored locally (does not unlock Pro in the extension yet).
- Permissions: `storage` and claude.ai only. No network calls.
- 0.1.1: panel buttons were unclickable (focus inside the panel rebuilt it mid-click); multi-line rewrites are now inserted via a synthetic paste so each line stays its own paragraph. Verified on the live claude.ai.
- 0.1.2: panel height is capped to the space available above or below the composer (it ran off-screen at 1280×800). Store screenshots added in `extension/store/`.
- 0.1.2 submitted to the Chrome Web Store for review on 2026-11-03 (developer account The Quiet Concierge). Store link will be added here once approved.

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