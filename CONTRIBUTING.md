# Contributing

PromptGate is small on purpose: no dependencies, one engine, data-driven packs.

- **Scoring rules** live in `scripts/lib/lexicon.js` (word lists, regexes) and `scripts/lib/engine.js` (weights). Add words, not special cases.
- **Task types and defaults** live in `packs/general.json`. A new language or domain is a new pack file; see the shape there.
- **Strings** live in `scripts/lib/i18n.js`. Add a language by adding a key next to `vi` and `en`.
- Run `node tests/run.js` before opening a PR. Add a case to `tests/run.js` for every rule you change: the suite is the calibration record.
- Keep the hook fail-open: any error must result in `{}` on stdout, never a blocked prompt.
- Pro packs are not in this repo and are not accepted as PRs.

Bug reports: open an issue with the prompt text, the score you got, and the score you expected.
