# Security

PromptGate runs entirely on your machine. The hook reads the prompt from stdin, writes JSON to stdout, and appends a log line (score, type, action; never the prompt text) to `~/.claude/promptgate/log.jsonl`. It opens no network connections except:

- Tier-2 rewrite when `brain` is `llm` (off by default): `claude -p` (your own login) or `api.anthropic.com` with your `ANTHROPIC_API_KEY`, only for the prompt you just typed.

History reports read `~/.claude/projects/**/*.jsonl` locally and write to `~/.claude/promptgate/reports/`.

To report a vulnerability, email huuthanhueh@gmail.com. Please do not open a public issue for security reports.
