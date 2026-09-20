## Shared Fleet standard

Also read and follow `../AGENTS.md`. This repository is a private internal
support tool, not a product application.

## Project

- Stack: dependency-free Node.js ESM core; product adapters may declare isolated, pinned experiment-only tools.
- Test: `npm test`
- Full check: `npm run check`
- Deploy: `npm run deploy` publishes the existing `map-of-agent-testing`
  Cloudflare Worker at `browser-agents.sarthakagrawal.dev`; the workers.dev
  fallback remains enabled.

## Boundaries

- Run benchmarks only against local or disposable seeded targets.
- Never read or store API keys, production credentials, personal browser profiles, or production data.
- Keep product changes in explicit adapter patches applied only to clean isolated worktrees.
- Keep raw evidence, generated builds, model files, virtual environments, and third-party tool installations ignored.
- Do not claim a driver winner from successful execution alone; independent functional and visual verification is required.
- Keep command execution bounded and array-based. Do not add arbitrary shell execution or unlimited retries.
- Do not package a winner skill until a candidate meets the documented adoption threshold.
