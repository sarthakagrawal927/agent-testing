# Vaultwealth adapter

This adapter preserves the local web and native iOS benchmark without merging
experiment code into Vaultwealth. It materializes the saved runtime at
`local-agent-eval/fast-testing/` and applies opt-in app hooks in a clean,
non-main Vaultwealth worktree.

Historical results and limitations are retained in
[`runtime/REPORT.md`](runtime/REPORT.md) and
[`runtime/ROUND2.md`](runtime/ROUND2.md). They predate the standalone runner
and must not be relabeled as standalone-runner measurements.

The migration also preserved 3,000 raw evidence files (223 MiB) on the owner
Mac at `artifacts/vaultwealth-2026-09-20/`. That directory is intentionally
ignored because it contains generated screenshots, traces, and run output.
Four 42 MiB web build directories and the 6.3 GiB third-party tool installs
were not duplicated; both are rebuildable from the retained workflows and
pin/provenance files. The closed experiment branch remains the fallback copy.

## Prepare an isolated worktree

```sh
node adapters/vaultwealth/prepare.mjs check --target /path/to/vaultwealth-worktree
node adapters/vaultwealth/prepare.mjs apply --target /path/to/vaultwealth-worktree
```

The command refuses:

- a dirty target;
- `main` or `master`;
- a target that is not the Vaultwealth repository;
- an incompatible app-hook patch; or
- an existing experiment runtime directory.

After preparation, follow `local-agent-eval/fast-testing/README.md` inside the
isolated worktree. Tool installations, models, builds, and evidence stay in
ignored directories. Delete the disposable worktree when finished; do not
turn the experiment patch into an application PR.

The patch was extracted from closed Vaultwealth PR
`vaultwealth-ltd/webapp#2374` at commit
`bdd56fbfe7f20bf23349cbc43b9a5051e44319b7` and checked against base
`90ab1a5ae0850c1b380b13a7a5138bd90b8e976c`. Patch applicability, not the
recorded base alone, is the compatibility gate.
