# Embedding the PromptGate engine in your own app

The scoring engine is plain Node, dependency-free, and fast (< 1 ms per prompt). You can use it outside Claude Code: a chat UI, a bot, an internal assistant. The pattern below is what powers the "Trợ lý" page of a hotel-ops virtual office: a weak question gets three filled-in rewrites as buttons before anything is sent to the model.

## 1. Load the engine

```js
const path = require("path");
const root = process.env.PROMPTGATE_ROOT || "/path/to/promptgate"; // the plugin folder
process.env.CLAUDE_PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || root;
const E = require(path.join(root, "scripts/lib/engine.js"));
const packs = require(path.join(root, "scripts/lib/packs.js"));
const { t } = require(path.join(root, "scripts/lib/i18n.js"));
```

## 2. Score a prompt

```js
const pack = packs.load();                       // all built-in packs + any custom packs in ~/.claude/promptgate/packs
const a = E.analyze(text, { pack, followUp });    // followUp = true from the 3rd turn of a conversation
// a.score (0-100), a.type, a.depth, a.lang ('vi'|'en'), a.missing (weak dimensions), a.dims
const T = t(a.lang);
const skeleton = E.rewrite(text, a, pack, T);     // rule-based rewrite with ⟨…⟩ placeholders
```

## 3. Offer choices instead of blocking

When `a.score < 50`, ask your model (one cheap call) for three rewrites that fill the gaps from *your* context, then show them as buttons. Ask for a delimiter format, not JSON: multi-line Vietnamese text breaks JSON far too often.

```text
Rewrite the user's request as 3 versions in <language>. Keep the intent. Fill in missing details from the context below. No placeholders.
A (Lean): shortest, core intent + one output line.
B (Standard): goal, context, output, constraints, done when.
C (Deep): like B + conclusion first, risks, self-check, finish fully.
Return EXACTLY:
<<<A>>>
...
<<<B>>>
...
<<<C>>>
...
```

Parse with `/<<<\s*([ABC])\s*>>>\s*([\s\S]*?)(?=<<<\s*[ABC]\s*>>>|$)/g`. Recommend C for `a.depth === 'deep'`, A for `'light'`, else B. Always add a "Send as written" button. When the user clicks, send the chosen text with a flag so you do not gate it again.

## 4. Things that bit us

- Gate only requests that carry an explicit flag from the UI (`pg: "on"`), so CLIs and background jobs are untouched.
- Relax from the third turn (context lives in earlier turns): treat context as satisfied and lower the threshold by 10.
- On Windows with Kaspersky or a corporate proxy, long-lived Node processes get intermittent `SELF_SIGNED_CERT_IN_CHAIN` on `fetch`. Run Node with `--use-system-ca` (Node 22.15+/24) or set `NODE_EXTRA_CA_CERTS`. Log `err.cause.code`; "network error" alone hides it.
