---
description: PromptGate — are all editions running here (plugin + hook, Windows tray, claude.ai extension, office widget)? Usage - /promptgate:doctor [--fix]  (--fix starts the tray and rebuilds the extension)
argument-hint: [--fix]
allowed-tools: Bash(node:*)
---

Run EXACTLY this Bash command and show its stdout verbatim, nothing else:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js" $ARGUMENTS
```
