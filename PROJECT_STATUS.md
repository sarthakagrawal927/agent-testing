# Browser Agent Testing — PROJECT STATUS

Last updated: 2026-09-20

## Why / What

Completed experiment for reproducible, local-first web and native app-agent benchmarks with independent correctness verification. The live evidence map and public runner are retained without an active expansion roadmap.

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

- 2026-09-20 — public map expanded to a sourced 54-tool catalogue, eight experiment records, exact observed version pins, and machine-readable JSON; catalogue research and the last executed benchmark are dated separately.
- 2026-09-20 — owner marked Browser Agent Testing a completed experiment. The live evidence map and public reproducibility artifacts remain available; no ongoing benchmark treadmill or general-purpose framework is planned.
- 2026-09-20 — agent-first Map of Browser Agent Testing deployed as a static Cloudflare Worker at `browser-agents.sarthakagrawal.dev`, with the workers.dev fallback retained; canonical Fleet ownership recorded under this project.
- 2026-09-20 — standalone repository created; generic runner and Vaultwealth experiment extracted from product repositories. The repository was made public after its completed-experiment review.

## Products

- `agent-testing` CLI and receipt contract.
- Vaultwealth web and iOS benchmark adapter.
- Public, read-only Map of Browser Agent Testing for coding agents and maintainers.

## Features (shipped)

- Strict command-array manifests, bounded phases and run counts.
- Sanitized receipts with verified/incorrect/failed/timed-out distinctions.
- Warm/cold statistics, model/cost counters, defect detection, retry, and intervention metrics.
- Reproducible Vaultwealth adapter with historical reports and opt-in app-hook patch.
- Command-first static guide, `llms.txt`, real 404, security headers, and responsive evidence at 390, 768, and 1440 px.
- Static `/tools` and `/experiments` pages with no client JavaScript.
- Public `tools.json`, `experiments.json`, and `versions.json` surfaces for agents.
- Evidence labels keep benchmarked and screened tools separate from setup-blocked and researched-only entries.

## Deferred

- No active roadmap. Add another product adapter only if a concrete future product needs a fresh comparison.
- Package a Claude/Codex skill only if a future benchmark candidate meets the documented adoption threshold.
