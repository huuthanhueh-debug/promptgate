# Changelog

## Unreleased — PromptGate Video (preview)
- New `video/`: an offline video studio. Brief → storyboard → prompts shaped for 11 AI video tools (Veo 3, Runway Gen-4, Kling, HeyGen, Synthesia, InVideo AI, CapCut AI, Canva AI, Sora, Pika, Luma) → attach the generated images/clips → export a captioned video with music, all on the device.
- Desktop: `npm run video` (zero-dependency localhost server). Android: `npm run build:apk` builds a WebView APK with the plain SDK tools; the `video-apk` workflow builds it, runs it on an emulator and publishes it on the `video-latest` release. The APK requests no permissions.
- Vietnamese and English UI with a VI | EN switch (labels, tool tips, warnings, error messages); the choice is remembered. Strings live in `video/src/i18n.js`.
- Editing tools (0.2.0): timeline with playhead, split at playhead, duplicate, undo/redo; per-clip trim, speed and volume; seven real transitions between two scenes; colour looks and sliders, fill or fit-with-blur framing; caption position, size, colour, background and animation; music fade in/out with auto-ducking; logo overlay; safe-area guide; export fps and bitrate. Projects saved by 0.1 still open.
- Fixed: a second export with music or clip sound came out silent (media elements can be wired to Web Audio only once; preview and export now share one audio graph). Editing two fields of one scene in a row no longer drops the second edit.
- Local tab with a Claude assistant (0.3.0): plain-language requests become validated edit operations (`applyOps`), undoable in one tap. Runs in the local server only: `ANTHROPIC_API_KEY` → Claude API, otherwise the signed-in `claude` CLI. Loopback only, same-origin checks, key never sent to the page; the APK stays offline with no permissions.
- `video/` is now self-contained (own `package.json`, tests in `video/tests/`, icon generator, licence, CI workflow) so it can become its own repository with `git subtree split --prefix=video`.
- Tests: `video/tests/video.js` (core logic, clip-editing maths, server, packaging, and in headless Chromium when Playwright is present: pixel checks of every transition, the editor UI, real exports with sound), wired into `node tests/run.js`.

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