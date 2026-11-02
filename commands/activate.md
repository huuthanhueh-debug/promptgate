---
description: PromptGate — activate Pro with your Gumroad license key. Usage - /promptgate:activate <LICENSE-KEY>  (or `deactivate`)
argument-hint: <LICENSE-KEY | deactivate>
allowed-tools: Bash(node:*)
---

If the argument is the word `deactivate`, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/pg-cli.js" deactivate`. Otherwise run EXACTLY this Bash command. Never repeat the license key back in your reply; show only the command's stdout.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pg-cli.js" activate $ARGUMENTS
```