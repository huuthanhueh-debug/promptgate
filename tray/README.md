# PromptGate Tray (phase 2) — a global hotkey for every Windows window

> Stack: **PowerShell 5.1 + WinForms** (like Claude Usage Monitor) rather than Electron (like Teams Live Subtitles): one command or one `.cmd`, nothing to install or build; Node.js is already required for the engine so no new dependency, whereas Electron adds 200+ MB and a packaging step.

Select a prompt in **any app** (Claude desktop, a browser, Word, Notepad…), press **Ctrl+Alt+P**, and a small popup appears next to the cursor: score /100, task type, missing dimensions, and three filled-in rewrites **A Lean / B Standard / C Deep**. Click one to copy it to the clipboard (optionally paste it straight over the selection). Esc closes. Same engine as the Claude Code plugin, under 1 ms, nothing leaves the machine.

Vietnamese guide: [README.vi.md](README.vi.md).

## Requirements

- Windows 10/11. PowerShell 5.1 ships with Windows.
- Node.js 18+ (`node` on PATH, or set `tray.node` in the config, see below).
- This repo cloned locally (the engine lives in `scripts/lib/`; the tray requires it directly, no copy).

## Run

| How | Command | Notes |
|---|---|---|
| Quickest | double-click `tray\PromptGate.cmd` | background, no console window |
| From a terminal | `npm run tray` | console stays open, useful for errors |
| Start with Windows | tray menu → **Start with Windows** | creates a shortcut in the Startup folder; untick to remove |

On first run a balloon says "Running. Select a prompt in any app and press Ctrl+Alt+P." A blue round **P** icon appears in the system tray (click ^ if hidden).

## Use

1. Select the prompt in whatever app you are in. With nothing selected, the tray uses the clipboard.
2. Press **Ctrl+Alt+P**.
3. The popup shows:
   - Line 1: `53/100 · build · depth deep` (red < 50, amber < 75, green ≥ 75); top right says "from selection" or "from clipboard".
   - Line 2: **Missing**: goal, context… · **Excess**: filler phrases. Line 3: one **Tip**.
   - Three versions: the button on the left is the name (recommended one in blue), the box on the right is the full text. Click either, or press **A / B / C**.
4. The chosen version is now in the clipboard. With **Paste over the selection** on, the tray brings the original window back and sends Ctrl+V for you.
5. **Esc** or click outside to close. Pressing the hotkey while the popup is open closes it too.

What the three versions are:

- **A · Lean**: the core intent with pleasantries removed + one default output line for the task type.
- **B · Standard**: Goal / Context / Output / Constraints / Done when, each line filled in.
- **C · Deep**: B plus Ultrathink, a short plan, edge cases and assumptions, self-check, finish without stopping halfway.

The tray has no Claude in the loop (unlike the plugin), so "filled in" means what the rule engine can see: paths and file names in the prompt, URLs, error lines (`TypeError: …`, `ENOENT`, `500`…), `@file` mentions, the **title of the window** the text came from (e.g. `auth.js - Visual Studio Code` becomes "open: auth.js - Visual Studio Code"), and the pack's per-type defaults for output / constraints / done-when. Only genuinely unknowable parts stay as ⟨…⟩ (e.g. the length of an email).

Popup language follows the prompt (VI/EN). Tray menu language defaults to Vietnamese; change it with `tray.language`.

## Tray menu (right-click the icon)

| Item | Effect |
|---|---|
| Enable PromptGate | Ticked = hotkey active; unticked = paused (grey icon) |
| Change hotkey… (Ctrl+Alt+P) | Dialog: press the new combination, Save. If it cannot be registered the old one is kept and the reason shown |
| Paste over selection after choosing | Toggle automatic Ctrl+V after choosing (only when the text came from a selection) |
| Ask tier 2 (Claude) when scoring | Call `claude -p --model haiku` on every score to rewrite B/C |
| Open prompt history | Runs `scripts/history.js 30` and opens the newest Markdown report |
| Open data folder | `%USERPROFILE%\.claude\promptgate` (config, logs, reports) |
| Start with Windows | Startup-folder shortcut |
| Quit | Unregisters the hotkey and exits |

## Configuration

Same file as the plugin: `%USERPROFILE%\.claude\promptgate\config.json`, key `tray`. Everything has a default; write only what you change:

```json
{
  "mode": "balanced",
  "tray": {
    "hotkey": "Ctrl+Alt+P",
    "paste": false,
    "llm": false,
    "enabled": true,
    "node": "",
    "language": "auto"
  }
}
```

| Key | Default | Meaning |
|---|---|---|
| `hotkey` | `Ctrl+Alt+P` | At least one of Ctrl / Alt / Shift / Win plus a key: `Ctrl+Shift+Space`, `Win+Alt+G`, `Ctrl+Alt+F9`… |
| `paste` | `false` | Paste over the selection after choosing |
| `llm` | `false` | Call tier 2 on every score. With `false` the popup still has a **Tier 2 (Claude)** button for on-demand use |
| `enabled` | `true` | On/off state, remembered by the tray menu |
| `node` | `""` | Path to `node.exe` when it is not on PATH |
| `language` | `auto` | `auto` = popup follows the prompt, menu in Vietnamese; `vi` / `en` force both |

The tray menu writes this file; after editing it by hand, restart the tray.

## Tier 2 (Claude)

The **Tier 2 (Claude)** button on the popup (or `llm: true`) calls `scripts/lib/brain-llm.js` exactly like the plugin does: `claude -p --model haiku` with your own Claude login, or the API when `ANTHROPIC_API_KEY` is set. The result replaces **B**; **C** becomes that result plus the deep lines; **A** is untouched. No key is needed since 1.3.0. Tier 2 runs in the background; the popup stays usable while waiting. Network or certificate errors (Kaspersky TLS interception) keep the rule-based versions; see Troubleshooting in the root README.

## How it works

```
PromptGate.ps1 (WinForms, STA)             core.js (Node)                engine
  RegisterHotKey ──► WM_HOTKEY               --config / --ui               scripts/lib/engine.js
  foreground window + title                  --req req.json --out …  ──►   analyze() + cleanFiller()
  synthetic Ctrl+C → clipboard (or old clipboard)   tray/lib/compose.js    ◄── packs/general.json
  write req.json (UTF-8) ────────────────►   A/B/C + context filling
  read result JSON ◄─────────────────────    append log.jsonl (no text)
  WinForms popup near the cursor
```

- Every visible string (VI/EN) lives in `tray/lib/compose.js`; the `.ps1` is pure ASCII so PowerShell 5.1's default ANSI encoding can never garble it.
- Text travels through UTF-8 JSON files in `%TEMP%\promptgate-tray\`, never through command-line arguments.
- Operational log: `%USERPROFILE%\.claude\promptgate\tray.log`. Scoring log shared with the plugin: `log.jsonl` (`action: "tray"`, no prompt text), so `/promptgate:history` and **Open prompt history** include prompts scored from the tray.
- Single instance (mutex); a second launch exits silently.

Preview what the popup would show, from the command line:

```bash
node tray/core.js "help me fix the login bug in auth.js"
```

## Troubleshooting

**Hotkey could not be registered** (balloon at start, `tray.log` says `RegisterHotKey failed … 1409`). Another app holds the combination (screenshot tools, GPU drivers and chat apps often take Ctrl+Alt+P). Tray menu → **Change hotkey…** → press another one (`Ctrl+Shift+Space`, `Win+Alt+P`, `Ctrl+Alt+F9`). No restart needed.

**Hotkey does nothing while an elevated app is in front** (admin terminal, Task Manager, installers). Windows blocks a normal process from sending input to an elevated one (UIPI). Either run the tray elevated (right-click `PromptGate.cmd` → Run as administrator) or copy the prompt by hand and press the hotkey from another window; the tray falls back to the clipboard.

**Kaspersky**: *Secure Keyboard Input* / *Safe Money* block synthetic keystrokes in browsers and some apps, so the automatic Ctrl+C copies nothing and the popup says "Nothing selected and the clipboard is empty" or picks up the old clipboard. Fix: Kaspersky → Settings → Privacy → Secure Keyboard Input → off, or add `powershell.exe` to Trusted applications with *Do not monitor application activity*; or simply **Ctrl+C by hand, then press the hotkey** (always works, it reads the clipboard). Kaspersky's TLS interception only affects tier 2, never scoring.

**SmartScreen / Defender prompts on the `.vbs` or `.cmd`** the first time: *More info → Run anyway*; the files are in the repo you cloned and are plain text. Or use `npm run tray` (no `.vbs`).

**`running scripts is disabled on this system`**: the launchers pass `-ExecutionPolicy Bypass` for this process only and do not change the machine policy. If it still appears, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**"node.exe not found"**: install Node.js 18+ or set `"tray": { "node": "C:\\Program Files\\nodejs\\node.exe" }`.

**No popup, no message**: read `tray.log`. A `hotkey:` line means the hotkey arrived; `popup shown:` means the engine answered. No `hotkey:` → not registered or swallowed by another app. No `popup shown:` → look for `node stderr`.

**Wrong text picked up**: some apps do not copy on Ctrl+C (terminals use Ctrl+Shift+C, drawing apps…). The tray waits 600 ms then falls back to the old clipboard, so Ctrl+C by hand first. The chosen version always replaces the clipboard content.

**Paste lands in the wrong place**: pasting only runs when the text came from a selection (never from the clipboard) and needs the original window to accept focus again; elevated apps do not (UIPI above).

## Current limits

- Windows only. The Win key is not captured by the hotkey dialog; write `Win+…` directly in the config.
- A/B/C are filled from rules, not from conversation context like the plugin; tier 2 covers that gap.
- The popup is a WinForms window with a fixed dark theme.

## Tests

```bash
npm run test:tray      # non-UI: composer A/B/C, context filling, core.js, logging, config
npm test               # everything, plugin included
```

The UI part (hotkey, popup, clipboard) was verified by hand against Notepad: select → Ctrl+Alt+P → popup → key B → clipboard holds version B; sample `tray.log`:

```
16:04:52 hotkey: selection, 125 chars from 'auth.js - Notepad'
16:04:53 popup shown: ok=True score=53 type=build lang=vi origin=selection
16:04:54 chose B (519 chars, score 53, selection)
```
