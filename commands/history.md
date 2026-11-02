---
description: PromptGate — scan every Claude Code transcript on this machine, score your past prompts, write a local report. Usage - /promptgate:history [days|--all]
argument-hint: [days | --all]
allowed-tools: Bash(node:*)
---

Run EXACTLY this Bash command. It reads only local files under ~/.claude/projects and writes a report under ~/.claude/promptgate/reports. Show the stdout verbatim (it is already a Markdown report); do not summarize it, do not add commentary before it. After the report, add one line telling the user where the file was saved.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/history.js" $ARGUMENTS
```