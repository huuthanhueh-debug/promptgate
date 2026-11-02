# PromptGate

**A gate between your keyboard and Claude.** Every prompt you type in Claude Code is scored in milliseconds. Weak prompts are stopped and handed back tighter and deeper. Good prompts pass silently. Your whole prompt history is scanned locally so you can see your habits and your progress.

[Tiếng Việt](README.vi.md) · [Spec](docs/SPEC.md) · [Team install guide (VI)](docs/TEAM-INSTALL.vi.md) · [Pro on Gumroad](https://thequietconcierge.gumroad.com/l/promptgate)

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

| Mode | Blocks below | Shows score below |
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
| `/promptgate:brain <rules\|llm>` | rewrite engine (llm = Pro) |
| `/promptgate:activate <KEY>` | unlock Pro |

## Privacy

Everything runs on your machine. The hook never sends your prompt anywhere. The log at `~/.claude/promptgate/log.jsonl` stores scores and types, never prompt text. History reports are written to `~/.claude/promptgate/reports/`. No telemetry, no accounts. The optional Pro tier-2 rewrite uses your own `claude -p` login (or your `ANTHROPIC_API_KEY`) and only runs on the prompt you just typed, never on history.

## Free vs Pro

| | Free (this repo, MIT) | Pro ($19 once, 12 months of updates) |
|---|---|---|
| Real-time gate, rule-based rewrite, VI/EN | ✓ | ✓ |
| `general` pattern pack | ✓ | ✓ |
| History report: overview, weaknesses, 5 worst prompts | ✓ | ✓ |
| History: per-project, weekly trend, 20 worst with rewrites, HTML dashboard | – | ✓ |
| Tier-2 LLM rewrite via your own `claude -p` | – | ✓ |
| Domain packs: **coding**, **writing**, **business**, **hospitality** | – | ✓ |
| Full per-project depth profiles | basic | ✓ |

Pro packs are JSON files you drop into `~/.claude/promptgate/packs/`. Get them at [thequietconcierge.gumroad.com/l/promptgate](https://thequietconcierge.gumroad.com/l/promptgate), then `/promptgate:activate <KEY>`.

## Roadmap

- **Phase 1 (this)**: Claude Code plugin.
- **Phase 2**: Windows tray tool with a global hotkey, so the same engine works in the Claude desktop app and any other window.
- **Phase 3**: Chrome extension for claude.ai.

## Develop

```bash
node tests/run.js
node scripts/optimize.js "your prompt here"
echo '{"prompt":"fix this","session_id":"x"}' | node scripts/gate.js
```

MIT © The Quiet Concierge