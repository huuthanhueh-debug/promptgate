---
description: PromptGate — choose the rewrite engine. Usage - /promptgate:brain <rules|llm>  (llm is a Pro feature, uses your own `claude -p` login)
argument-hint: <rules|llm>
allowed-tools: Bash(node:*)
---

Run EXACTLY this Bash command and show its stdout verbatim:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pg-cli.js" brain $ARGUMENTS
```