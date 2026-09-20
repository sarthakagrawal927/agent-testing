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

- 2026-09-20 — published the complete quantitative matrix: 26 measured journey arms, seven additional probes, honest pass denominators, model/cost fields, seeded-fault outcomes and six headline coverage totals.
- 2026-09-20 — completed evidence matrix expanded to 79 sourced tools in seven categories. Puppeteer, Selenium, WebdriverIO, Nightwatch and Taiko each completed five verified clean search runs and detected the stale-search fault; TestCafe and Cypress retain explicit setup dispositions.
- 2026-09-20 — ios-simulator-mcp 2.1.0 and Mobile MCP 1.0.4 completed bounded simulator discovery and accessibility screens; isolated fb-idb 1.1.7 supplied the former's accessibility backend, and Mobile MCP's temporary device agent was removed afterward.
- 2026-09-20 — public map expanded to a sourced catalogue, ten experiment records, exact observed version pins, and machine-readable JSON; catalogue research and the last executed benchmark are dated separately.
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
- Structured comparison rows expose median, observed p95, verified passes/attempts, model use or spend, timing basis and fault result for every retained measured journey.
- Evidence labels keep benchmarked and screened tools separate from setup-blocked and source-reviewed entries, and every row exposes a version or concrete boundary.

## Deferred

- No active roadmap. Add another product adapter only if a concrete future product needs a fresh comparison.
- Package a Claude/Codex skill only if a future benchmark candidate meets the documented adoption threshold.
