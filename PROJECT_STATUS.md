# Agent Testing — PROJECT STATUS

Last updated: 2026-09-20

## Why / What

Private internal tooling for reproducible, local-first web and native app-agent benchmarks with independent correctness verification.

**Users:** Fleet owner and coding agents.

**IN scope:** generic orchestration, strict manifests and receipts, product adapters, isolated app-hook patches, benchmark reports, and evidence contracts.

**OUT of scope:** production test infrastructure, device clouds, broad browser matrices, production credentials, and automatic tool adoption.

## Dependencies

### External

- Node.js 22 or newer for the dependency-free core.
- Wrangler 4.135.0 is pinned as a development-only dependency for static-site validation and deployment.
- Adapter-specific tools are pinned and installed inside the adapter's ignored runtime directories.

### Internal

- Product repositories are supplied as clean isolated worktrees; this repository does not own their application code.

## Timeline

- 2026-09-20 — agent-first Map of Agent Testing deployed as a static Cloudflare Worker at `map-of-agent-testing.sarthakagrawal927.workers.dev`; canonical Fleet ownership recorded under this project.
- 2026-09-20 — standalone private repository created; generic runner and Vaultwealth experiment extracted from product repositories.

## Products

- `agent-testing` CLI and receipt contract.
- Vaultwealth web and iOS benchmark adapter.
- Public, read-only Map of Agent Testing for agents and authorized maintainers.

## Features (shipped)

- Strict command-array manifests, bounded phases and run counts.
- Sanitized receipts with verified/incorrect/failed/timed-out distinctions.
- Warm/cold statistics, model/cost counters, defect detection, retry, and intervention metrics.
- Reproducible Vaultwealth adapter with historical reports and opt-in app-hook patch.
- Command-first static guide, `llms.txt`, real 404, security headers, and responsive evidence at 390, 768, and 1440 px.

## Todo / Planned / Deferred / Blocked

1. Add another product adapter only after the Vaultwealth extraction is stable.
2. Package a Claude/Codex skill only after a benchmark candidate meets the adoption threshold.
