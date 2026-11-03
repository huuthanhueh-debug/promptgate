# PromptGate for claude.ai (Chrome extension)

[Tiếng Việt](README.vi.md) · [About PromptGate](../README.md)

Scores your prompt on claude.ai as you type, from 0 to 100. Press the badge or **Ctrl+Shift+P** to open a panel with three rewrites: **A · Lean**, **B · Standard**, **C · Deep**. Click one to put it in the composer. Nothing is sent for you, and no prompt is blocked.

```
[ PG 32 ]   ← badge next to the composer, red / amber / green by score
```

## Status

Preview, manual install. Not yet on the Chrome Web Store.

- Tested: the engine runs in a sandbox with no Node globals, scores match the Claude Code plugin, and a mock of the claude.ai DOM confirms the badge appears, updates while typing, and that clicking B replaces the composer text without sending.
- Verified on the live claude.ai (Chrome, Load unpacked, 0.1.1, 2026-11-02): badge appears, score updates while typing, panel opens, choosing B replaces the composer text. The claude.ai interface changes often; if the badge does not appear, see "When claude.ai changes its layout" below.

## Install (needs Node.js 18+ and Chrome)

1. Get the source and build:

   ```bash
   git clone https://github.com/huuthanhueh-debug/promptgate.git
   cd promptgate
   npm run build:ext
   ```

   This creates `extension/dist/`. The engine is bundled straight from `scripts/lib/`; there is no hand-copied duplicate.

2. Open Chrome at `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `extension/dist` folder.
4. Open [claude.ai](https://claude.ai), type a prompt, and the `PG ...` badge appears next to the composer.

After rebuilding, press the reload icon (↻) for the extension on `chrome://extensions`.

## Use

- **PG badge**: shows the score, coloured by threshold. Click it to open the panel.
- **Ctrl+Shift+P**: open or close the panel while on claude.ai.
- **Panel**: score out of 100, task type, depth, the missing dimensions, and three rewrites. The recommended one is marked.
- **Replace composer text**: replaces everything in the composer with the chosen rewrite. Review it, then press claude.ai's own send button.
- **Send as written**: keeps your original prompt, closes the panel, and returns focus to the composer.
- **Popup** (extension icon): on/off, threshold (strict / balanced / gentle / off), depth profile, suggestion language.

The panel language follows the prompt's language.

## How missing details are filled

The extension calls no model. The A, B and C rewrites come from the same rule engine as the Claude Code plugin:

- Context: if the prompt names no file or URL, up to three paths or URLs from the visible chat are used.
- Constraints and done-when: pack defaults for the task type (for example, "keep unrelated parts unchanged").
- Output: pack default for the task type.
- Anything with no source stays as a `⟨…⟩` placeholder for you to fill.

So the suggestions are less capable than tier 2 in Claude Code, which calls an LLM. They are fast, cost no tokens, and never leave the machine.

## Privacy

- Prompts, chat history and suggestions are not sent off the browser. The extension asks for no network permission and calls no API.
- The only stored data is the settings, in `chrome.storage.local` of your browser profile.
- Paths and URLs read from the chat are used in memory to build a suggestion and are not kept.
- Permissions: `storage`, and a content script on `https://claude.ai/*`. No access to other tabs.


## When claude.ai changes its layout

The badge finds the composer in this order: `div.ProseMirror[contenteditable="true"]`, then `div[contenteditable="true"][role="textbox"]`, then `fieldset [contenteditable="true"]`, then `textarea`. The largest visible match wins. The list lives in `extension/src/core.js` (`COMPOSER_SELECTORS`). When it drifts, update the list and run `npm run build:ext` again.

If no composer is found, the badge hides and the page is left alone.

## Chrome Web Store (not published)

Prepared: icons (generated at build time), the [privacy policy](PRIVACY.md), the [listing text and submission steps](STORE-LISTING.md), and the upload zip via `npm run build:ext -- --zip`. Still manual: a developer account (one-time $5), store screenshots, and pressing Submit.

## Development

```bash
npm run build:ext      # bundle the engine and copy the extension files into extension/dist
npm test               # includes tests/extension.js (no-Node bundle, score parity, claude.ai DOM mock)
```

| File | Role |
|---|---|
| `build.js` | bundles `scripts/lib/` into one browser script (IIFE), swaps `fs`/`path`/`os` for shims |
| `src/core.js` | pure logic: scoring, A/B/C, find and write the composer (takes the document as an argument) |
| `src/content.js` | DOM glue: badge, panel, shortcut, watching for layout changes |
| `src/popup.*` | settings |
| `src/manifest.json` | Manifest V3 |
| `src/shims/` | browser stand-ins for `fs`, `path`, `os` |

MIT, like the rest of the repo.
