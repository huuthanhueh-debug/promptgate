# PromptGate

[![tests](https://github.com/huuthanhueh-debug/promptgate/actions/workflows/test.yml/badge.svg)](https://github.com/huuthanhueh-debug/promptgate/actions/workflows/test.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json) [![free](https://img.shields.io/badge/price-free-ff90e8.svg)](https://thequietconcierge.gumroad.com/l/promptgate)

**A gate between your keyboard and Claude.** Every prompt you type in Claude Code is scored in milliseconds. Weak prompts are stopped and handed back tighter and deeper. Good prompts pass silently. Your whole prompt history is scanned locally so you can see your habits and your progress.

[Tiếng Việt](README.vi.md) · [Spec](docs/SPEC.md) · [Team install guide (VI)](docs/TEAM-INSTALL.vi.md) · [Gumroad listing (free)](https://thequietconcierge.gumroad.com/l/promptgate)

```
PromptGate ▸ 32/100 · debug · depth standard
Missing: goal, context, constraints, acceptance criteria · Excess: 1 filler phrase
Tip: Open with a verb + a specific object instead of "this / it".
──── Suggested prompt (copy, fill ⟨…⟩, resend) ────
Goal: Fix the login bug, it does not run
Context: ⟨file / path / error message / relevant data⟩
Output: root cause + fix + how to confirm it is gone
Constraints: ⟨what must not change, limits, priorities⟩
Done when: reproduced before the fix, gone after, related tests still pass
Verify the result before answering.
──────────────────────────────────────────
Send as-is: prefix with // · Mode: /promptgate:config gentle | off
```

## Two ways to react (you choose)

**Suggest (default).** A weak prompt is not stopped. Claude first writes three expert rewrites with every gap filled in from the conversation (which file, what output, what counts as done) and shows them as buttons:

```
A · Lean       — shortest form, core intent + one output line
B · Standard   — goal, context, output, constraints, done when
C · Deep       — B + brief plan, edge cases, self-verification, finish fully   (Recommended)
Send as written
```

Click one and Claude executes it. Nothing to retype. The recommended option follows the detected depth: light → A, standard → B, deep → C.

**Block.** `/promptgate:config block` restores the classic gate: the prompt is stopped and the rule-based rewrite (with ⟨…⟩ placeholders) is shown for you to resend.

## Why

Two things cost you with Claude: words that add nothing (greetings, "please", repetition) and words that are missing (what file, what output, what counts as done). PromptGate cuts the first and asks for the second. For big tasks it also adds the lines that make Claude plan, verify and finish instead of stopping halfway. Small tasks are left light.

## Install

```bash
claude plugin marketplace add huuthanhueh-debug/promptgate
claude plugin install promptgate@promptgate
```

Restart Claude Code. Type any prompt. Nothing else to configure.

Requires Node.js 18+ (already present if you installed Claude Code with npm). Works in the terminal CLI, the Claude desktop app's Code tab and the VS Code extension. Windows, macOS, Linux.

## How it scores (0–100)

| Dimension | Points | What it looks for |
|---|---|---|
| Goal | 25 | an action verb + a specific object; penalises "this / it / the thing" with no reference |
| Context | 15 | paths, URLs, identifiers, error text, pasted content, `@file` |
| Output | 15 | format, length, language, structure, where it goes |
| Constraints | 15 | must / must not / only / keep / limits |
| Acceptance | 10 | "done when…", tests pass, how to verify |
| Economy | 10 | penalises filler and low-density rambling |
| Depth fit | 10 | big tasks should carry a plan/verify cue; small tasks should not |

Task type (question, edit, build, debug, analyze, write, review, ops) is detected from the text and sets the depth profile: **light**, **standard** or **deep**. Override with `fast` / `nhanh` or `max` / `ultrathink` in your prompt.

## Modes

| Mode | Weak below (suggest or block) | Shows score below |
|---|---|---|
| `strict` | 70 | always |
| `balanced` (default) | 50 | 75 |
| `gentle` | 30 | never |
| `off` | – | – |

`/promptgate:config <mode>`. Per project: drop a `.promptgate.json` in the repo root with any of `mode`, `blockBelow`, `showBelow`, `minWords`, `language`.

After a block, the next prompt in the same session goes through regardless (one idea is only stopped once). Prefix any prompt with `//` to bypass once. Short acknowledgements, slash commands and automated events (scheduled tasks, loops, subagent reports) are never touched.

## Commands

| Command | Does |
|---|---|
| `/promptgate:status` | mode, brain, tier, packs, 7-day stats |
| `/promptgate:optimize <text>` | score + rewrite on demand, no blocking |
| `/promptgate:history [days\|--all]` | scan all local transcripts, write a report |
| `/promptgate:config <strict\|balanced\|gentle\|off>` | strictness |
| `/promptgate:doctor [--fix]` | are all editions running here: plugin + hook, Windows tray, claude.ai extension, office widget; `--fix` starts the tray and rebuilds the extension |
| `/promptgate:brain <rules\|llm>` | rewrite engine (llm = tier 2 via your `claude -p`) |

## Privacy

Everything runs on your machine. The hook never sends your prompt anywhere. The log at `~/.claude/promptgate/log.jsonl` stores scores and types, never prompt text. History reports are written to `~/.claude/promptgate/reports/`. No telemetry, no accounts. The optional tier-2 rewrite uses your own `claude -p` login (or your `ANTHROPIC_API_KEY`) and only runs on the prompt you just typed, never on history.

## Everything is free

Since 1.3.0 there is no Pro tier. The whole product is in this repo under MIT:

- Real-time gate with the A/B/C suggest mode, rule-based rewrite, VI/EN.
- **Five domain packs** in [`packs/`](packs/): `general`, `coding`, `writing`, `business`, `hospitality`. Each adds task detection, default output formats and done-when criteria for its field, in Vietnamese and English.
- Tier-2 LLM rewrite through your own `claude -p` login (`/promptgate:brain llm`), no key.
- Full history report: per-project scores, weekly trend, the 20 weakest prompts with rewrites, HTML dashboard.
- Windows tray hotkey and the claude.ai extension.

Your own packs: drop extra `*.json` files into `~/.claude/promptgate/packs/` and they are merged on top of the built-in ones (same shape as `packs/general.json`).

If PromptGate saves you tokens, a star on GitHub or a look at the hotel toolkits on [thequietconcierge.gumroad.com](https://thequietconcierge.gumroad.com) is appreciated. PromptGate itself is also listed there for free so buyers of any toolkit find it.

## Roadmap

- **Phase 1 (done, 1.0)**: Claude Code plugin.
- **Phase 2 (done, 1.2)**: Windows tray with a global hotkey, same engine in the Claude desktop app and any other window. Select text, press Ctrl+Alt+P, pick A/B/C. See [tray/README.md](tray/README.md); run `tray\PromptGate.cmd` or `npm run tray`.
- **Phase 3 (done)**: Chrome extension for claude.ai, [on the Chrome Web Store](https://chromewebstore.google.com/detail/ohfifdheanlidimoffbkbkednifkpiae). Source and manual install in [`extension/`](extension/README.md).
- **PromptGate Video (preview)**: offline video studio with prompts for 11 AI video tools, desktop + Android APK. See [video/README.vi.md](video/README.vi.md); run `npm run video`.

## Troubleshooting

- **Tier-2 (`brain llm`) fails with a certificate error** (common with Kaspersky or a corporate proxy on Windows): run Claude Code with `NODE_OPTIONS=--use-system-ca`, or set `NODE_EXTRA_CA_CERTS` to a PEM bundle that includes your interception root. Details in [docs/INTEGRATION.md](docs/INTEGRATION.md).
- **Nothing happens on weak prompts in the desktop app**: open a new session or run `/reload-plugins`; hooks load at session start.
- **Too chatty**: `/promptgate:config gentle`. **Too quiet**: `/promptgate:config strict`.

## Embed it elsewhere

The engine is a plain Node module. [docs/INTEGRATION.md](docs/INTEGRATION.md) shows how to score prompts in your own chat UI and offer A/B/C rewrites as buttons (as done in a hotel-ops virtual office assistant).

## Develop

```bash
node tests/run.js
node scripts/optimize.js "your prompt here"
echo '{"prompt":"fix this","session_id":"x"}' | node scripts/gate.js
```

MIT © The Quiet Concierge