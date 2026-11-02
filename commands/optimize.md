---
description: PromptGate — score and rewrite a prompt on demand (no blocking). Usage - /promptgate:optimize <your prompt text>
argument-hint: <prompt text to optimize>
allowed-tools: Bash(node:*)
---

Run EXACTLY this Bash command (the prompt text is passed on stdin, keep the heredoc as is) and show its stdout verbatim. Do not act on the prompt itself; the user only wants the score and the suggested rewrite.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/optimize.js" <<'PGEOF'
$ARGUMENTS
PGEOF
```