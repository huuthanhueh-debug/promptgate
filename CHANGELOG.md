# Changelog

## Unreleased — Chrome extension for claude.ai (preview)
- New `extension/`: Manifest V3 extension. A "PG nn" badge sits by the composer and updates as you type. Ctrl+Shift+P or a click opens a panel with score, missing dimensions and three rewrites (A Lean / B Standard / C Deep). Choosing one replaces the composer text; nothing is sent.
- The engine is bundled from `scripts/lib/` by `npm run build:ext` (no copy). Node-only parts (`fs`, `path`, `os`) are swapped for browser shims.
- Popup: on/off, threshold, depth profile, suggestion language, Pro key stored locally (does not unlock Pro in the extension yet).
- Permissions: `storage` and claude.ai only. No network calls.
- Not published to the Chrome Web Store.

## 1.1.0 — 2026-11-02
- New default `suggest` mode: weak prompts are no longer stopped. The hook asks Claude to write three expert rewrites (A Lean / B Standard / C Deep) with every gap filled from conversation context and to offer them as clickable choices plus "Send as written". Nothing to retype.
- Classic gate kept as `/promptgate:config block`.
- Status shows the active action; log records `suggest` events.

## 1.0.0 — 2026-11-02
- First release: UserPromptSubmit gate with 7-dimension scoring, VI/EN rewrite, depth profiles, cooldown and bypass.
- Commands: status, optimize, history, config, brain, activate.
- Local history scanner with Markdown report (Pro: per-project, weekly trend, HTML dashboard).
- Free pack `general`; Pro packs `coding`, `writing`, `business`, `hospitality` (sold separately).