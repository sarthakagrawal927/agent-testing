# Benchmarking an application with agent-testing

This repository helps a team compare UI-testing drivers and agent strategies
without confusing fast clicks with a correct result. It runs bounded commands,
records warm and cold timing, and requires a separate product-specific verifier
before counting a run as passed.

The runner does not replace Playwright, Maestro, AXe, Jev, Browser Use, or your
application tests. It gives those tools one measurement and evidence contract.

## Current benchmark snapshot

The first adapter tested Vaultwealth web and native iOS journeys. These are
screening results, not universal tool rankings:

| Use case | Current best choice | What the experiment found |
| --- | --- | --- |
| Repeatable web regression | Saved Playwright tests | Reliable baseline; no tested replacement met the 2x adoption target. |
| Exploratory web navigation | Jev, with an independent verifier | Search passed 5/5 and detected the seeded stale-result fault, but login is unsupported because password inputs are excluded. |
| Repeated semantic web action | Stagehand cached replay remains promising | Replayed search 4/4 at a 2.201 s median with no repeat model calls; about 21% faster than the saved Playwright search, not 2x. |
| Repeatable iOS regression | Saved Maestro flows | Slower in tested login runs, but the more dependable current baseline. |
| Targeted iOS inspection/action | AXe or XcodeBuildMCP | AXe login was faster in screening, but readiness, configuration, and text-entry failures prevented general adoption. |

Read the full [screening report](../adapters/vaultwealth/runtime/REPORT.md),
[round-two comparison](../adapters/vaultwealth/runtime/ROUND2.md), and the
[expanded web](../adapters/vaultwealth/runtime/EXPANDED_WEB.md) and
[native readiness](../adapters/vaultwealth/runtime/EXPANDED_NATIVE.md) screens
before using the numbers in a decision. No tool has yet qualified as the
overall winner.

## Clone and prove the runner works

The core has no package dependencies. It needs Node.js 22 or newer.

```sh
gh repo clone sarthakagrawal927/agent-testing
cd agent-testing
npm test

node bin/agent-testing.mjs validate \
  --manifest fixtures/good.manifest.json
node bin/agent-testing.mjs run \
  --manifest fixtures/good.manifest.json \
  --out artifacts/quickstart
node bin/agent-testing.mjs summarize \
  --receipt artifacts/quickstart/receipt.json
```

The generated `artifacts/` directory is ignored. A run never overwrites a
non-empty output directory.

## Add your product

Keep the shared runner here rather than copying it into the application. Add a
directory such as `adapters/my-product/` containing:

- one manifest per journey and candidate;
- bounded commands for reset, readiness, workflow, and verification;
- any product-specific orchestration scripts;
- a README describing local startup, seed data, tool pins, and known limits;
- an opt-in patch only if the app needs debug hooks that cannot live in normal
  test code.

A minimal manifest looks like this:

```json
{
  "schemaVersion": "fleet.agent-testing.manifest.v1",
  "id": "my-product.web.search.playwright",
  "platform": "web",
  "journey": "dynamic-search",
  "candidate": "playwright-saved",
  "sample": "screening",
  "workingDirectory": "../../../my-product-worktree",
  "runs": { "warm": 5, "cold": 0 },
  "phases": {
    "reset": {
      "command": ["node", "scripts/reset-benchmark-data.mjs"],
      "timeoutMs": 10000
    },
    "readiness": {
      "command": ["node", "scripts/check-local-readiness.mjs"],
      "timeoutMs": 10000
    },
    "workflow": {
      "command": ["pnpm", "exec", "playwright", "test", "tests/search.spec.ts"],
      "timeoutMs": 120000
    },
    "verification": {
      "command": ["node", "scripts/verify-search-result.mjs"],
      "timeoutMs": 10000
    }
  }
}
```

`workingDirectory` is resolved relative to the manifest. Use a clean isolated
product worktree and a seeded non-production backend. Commands must be arrays,
must not invoke a shell, and must have bounded timeouts.

The verifier is intentionally separate from the workflow. It should check the
displayed result, persisted backend state where relevant, and explicit visual
evidence. A driver exiting successfully is not proof that the product behaved
correctly.

## Run a useful comparison

1. Choose one real journey and give every candidate the same starting state,
   interactions, assertions, and screenshot checkpoints.
2. Start with five warm screening runs. Measure cold startup separately.
3. Run clean and individually broken variants. Hide each defect from an
   exploring agent and let the independent verifier classify the outcome.
4. Record initial authoring cost separately from repeat execution.
5. Promote a candidate to 20 warm and three cold runs only when screening is
   promising.
6. Adopt only when it is at least 2x faster, or cuts model usage by at least
   50% without becoming slower, with no missed seeded defects or observed
   reliability regression.

Report median and observed p95 alongside verified completions, model calls,
spend, retries, interventions, setup effort, and workflow repair time. At these
sample sizes, tail latency and reliability estimates remain preliminary.

## Vaultwealth example

The retained Vaultwealth adapter applies only to a clean, non-main worktree:

```sh
node adapters/vaultwealth/prepare.mjs check --target /path/to/vaultwealth-worktree
node adapters/vaultwealth/prepare.mjs apply --target /path/to/vaultwealth-worktree
```

After preparation, follow the generated
`local-agent-eval/fast-testing/README.md` in that worktree. Do not merge the
experiment patch into the application merely to run the benchmark.
