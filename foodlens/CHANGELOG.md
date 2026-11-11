# FoodLens changelog

## 1.1.1 — 2026-11-11 — standalone project, tested on a device
- FoodLens is self-contained in this folder (own `package.json`, tests, changelog); nothing in PromptGate refers to it any more.
- Every build is now installed and launched on an Android 14 emulator before it is published: `tests/device.sh` checks that the page starts inside the WebView and that an HTTPS call reaches the Claude API through the native bridge.
- The app logs `ready` on start and answers a launch self-test (`--ez selftest true`).

## 1.1.0 — 2026-11-10 — Vietnamese and English
- VI | EN switch in the app header: every screen, verdicts, reasons, tips, error messages, decimal separator, food names and the language the model answers in. The choice is remembered.
- Model output fields renamed `advice` / `swaps`; diary entries saved by 1.0 still open.

## 1.0.0 — 2026-11-10
- Photo of any food → portion estimate through the Claude API, then app-computed verdicts for type 2 diabetes (glycemic load, net carbs vs. a per-meal target, added sugar), low-carb fit and a clean-eating score.
- Offline lookup table (64 foods), diary with daily totals, settings. Android shell (WebView, min Android 10).
