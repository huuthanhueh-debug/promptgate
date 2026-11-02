---
description: PromptGate — set strictness. Usage - /promptgate:config <strict|balanced|gentle|off>
argument-hint: <strict|balanced|gentle|off>
allowed-tools: Bash(node:*)
---

Run EXACTLY this Bash command and show its stdout verbatim:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pg-cli.js" config $ARGUMENTS
```