# Vaultwealth local testing experiment

Status: native qualification interrupted by DeviceHub quitting and shutting down
the simulator; see [FOLLOWUP.md](FOLLOWUP.md). Original screening results are
retained separately. No replacement adopted and no skill installed. Benchmark
processes and owned local services are stopped; evidence is retained.
See [REPORT.md](REPORT.md).
Additional local-first candidates and current recommendations are in
[ROUND2.md](ROUND2.md).
The completed five-run Puppeteer, Selenium, WebdriverIO, Nightwatch and Taiko
search screen is in [EXPANDED_WEB.md](EXPANDED_WEB.md).
The ios-simulator-mcp, Mobile MCP and isolated idb readiness probes are in
[EXPANDED_NATIVE.md](EXPANDED_NATIVE.md).

## Standalone runner adapter

The reusable, dependency-free orchestration layer lives in the public
`agent-testing` repository. This runtime keeps the Vaultwealth-specific
journeys, fixture backend, defect toggles, UI assertions, and evidence here.
`shared-benchmark.manifest.json` is the first product adapter: it wraps the
existing saved Playwright search benchmark without moving selectors or
business assertions into shared tooling.

Set `AGENT_TESTING_HOME` to the checked-out internal tool directory, then
validate the materialized adapter from the isolated Vaultwealth worktree:

```sh
node "$AGENT_TESTING_HOME/bin/agent-testing.mjs" validate \
  --manifest local-agent-eval/fast-testing/shared-benchmark.manifest.json
```

With the existing fixture backend, web export, and Chromium processes ready,
run a new five-run screen under the shared receipt contract:

```sh
node "$AGENT_TESTING_HOME/bin/agent-testing.mjs" run \
  --manifest local-agent-eval/fast-testing/shared-benchmark.manifest.json \
  --out local-agent-eval/fast-testing/artifacts/shared-search-$(date +%s)
```

The adapter writes only its cross-phase state inside the ignored per-run output
directory. The shared receipt retains an artifact-directory reference and
allowlisted timing fields; it does not copy screenshots, backend state, command
output, or environment values into Fleet tooling. The existing benchmark owns
reset, readiness, observation, action, and independent UI/backend verification,
so `controlAndApplicationWaitMs` remains combined rather than inventing a split
the driver cannot expose.

This adapter is for future runs. It does not rewrite or relabel the historical
results in `REPORT.md` and `ROUND2.md`, whose timings predate the shared runner.

This is an experiment against Vaultwealth's actual web and React Native screens.
The loopback backend bundles the repository's existing MSW handlers and state
model into a separate Node process. It is a fixture service, not the real Go
backend: results do not establish production API or database correctness.

The experiment was developed in the isolated `chore/local-testing-experiment`
worktree from `08a2c77f593db689f5b137f56a8939edbe28d83c`. Its opt-in application
hooks and focused tests are tracked with the experiment, so another checkout
does not need an external patch. No production dependency or deployment is
part of the experiment.

## Local setup

Use Node 24.21.0 and npm 11.19.1 (the default Node 26 fails the repository's
engine gate). The experiment dependencies were explicitly approved.

Machine-specific executables and simulator identity stay outside Git. Put
Maestro and XcodeBuildMCP on `PATH`, then set the dedicated simulator at
runtime:

```sh
export IOS_SIMULATOR_UDID='<dedicated-test-simulator-udid>'
```

Optional overrides are `MAESTRO_CLI`, `XCODEBUILDMCP_CLI`,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`, and `EXPERIMENT_NODE`. Adaptive Codex-agent
runs additionally accept `FLEET_SKILL_RUN` and `VAULT_AGENT_WORKTREE`. Set
`JAVA_HOME` normally if the selected Maestro installation requires it. None of
these values are copied into reports by the shared Fleet runner.

```sh
npm ci --no-audit --no-fund
npm run generate:ci
npm run agent-environment:check
npm --prefix local-agent-eval/fast-testing/tools ci --no-audit --no-fund
node local-agent-eval/fast-testing/build-backend.mjs
node local-agent-eval/fast-testing/artifacts/backend.cjs
```

In another terminal, export the web app with `EXPO_NO_DOTENV=1`,
`EXPO_PUBLIC_ENABLE_MOCKS=true`, `EXPO_PUBLIC_TESTING_EXPERIMENT=true`,
`EXPO_PUBLIC_MOCK_SEED=demo`, `EXPO_PUBLIC_MOCK_INVESTED=1`,
`EXPO_PUBLIC_E2E_MOCK_PROFILE=fast`, and `EXPO_PUBLIC_APP_ENV=development`:

```sh
node local-agent-eval/fast-testing/build-web.mjs
node scripts/serve-e2e-export.mjs local-agent-eval/fast-testing/artifacts/web-final --port 18790
```

The fixture backend applies a fixed 100 ms delay to handlers that use the shared
mock-delay helper. Auth and some other handlers have no injected delay. No
external API is required. Static third-party images are blocked; local bundled
assets are served normally. This limits full-page visual conclusions.

`build-web.mjs` sets the listed flags and records build wall time separately.
Set `EXPERIMENT_NODE` to a Node 24.21.0 executable on another machine; its default
is this Mac's existing mise installation. Controllers ran with Node 26.9.0.

## Web screening

```sh
node local-agent-eval/fast-testing/probe.mjs
# Once the browser reports ready, from another terminal:
node local-agent-eval/fast-testing/benchmark.mjs login 5
node local-agent-eval/fast-testing/benchmark.mjs edit 5
node local-agent-eval/fast-testing/benchmark.mjs search 5
```

Run only one measurement command at a time, with the iOS app stopped. All arms
attach to the same isolated Chromium on port 18792. They use identical saved
actions, screenshots, account checks, and independent fixture-state checks.
Data reset is outside the warm journey; initial navigation, readiness,
observation, and final verification are included. The Playwright arm executes
saved actions with the Playwright library; this does not measure Playwright
Test's CLI startup. Screenshot capture and verification use the same Playwright
oracle for every executor arm.

`artifacts/screen-*/results.jsonl` retains successful and failed attempts.
Earlier calibration runs are authoring/debugging evidence, not qualifying
samples. `manifest.json` records the settings of the later screening sets.
No retries occur inside a trial. Keep the original failures when repairing a
workflow. CLI action duration includes driver waiting and cannot be truthfully
split into pure control versus application waiting with the current tools.

The disabled Continue button reference was visually inspected. Login trials
compare its actual pixels (channel tolerance 30; at most 2% changed pixels),
not just whether the control exists. Other screenshots are evidence until
explicitly reviewed; collecting them is not visual defect detection.

## Defect injection

`POST http://127.0.0.1:18791/reset` accepts one fault per trial:
`clean`, `save-fails`, `wrong-value`, `duplicate`, `stale-search`, or `clipped`.
`GET /state` returns independent fixture state and request/write receipts.
`clipped` is applied by the controller to the login Continue control. The
exploring agent must not receive the selected fault or controller source.

```sh
node local-agent-eval/fast-testing/benchmark.mjs edit 1 playwright wrong-value
node local-agent-eval/fast-testing/benchmark.mjs login 1 playwright clipped
```

## iOS setup

AXe is pinned to 1.8.0. Its release archive SHA-256 is
`7b76340b72e90d0f211bc7c4636f15009076eff07acef2f2b632b175debd8834`.
Download `AXe-macOS-v1.8.0-universal.tar.gz` from its GitHub release and extract
under `tools/axe/`, preserving the adjacent Frameworks directory. Its bundled
agent guidance is available using `tools/axe/axe init --print`; do not install
a new permanent skill before selecting a winner.

The runtime is the existing Vault development client on the dedicated
`vault-agent-eval-ios-20260901` simulator, iPhone 16 Pro / iOS 26.5. Simulator
management uses the installed XcodeBuildMCP CLI because the current MCP surface
does not expose simulator management tools. No device cloud or Safari test is
part of these timings.

For native Metro, use the same mock flags plus these explicit local service
URLs (native requests require absolute URLs):

- `EXPO_PUBLIC_USERBE_URL=http://127.0.0.1:18791/api/user`
- `EXPO_PUBLIC_POLARIS_URL=http://127.0.0.1:18791/api/v1/polaris`
- `EXPO_PUBLIC_IBKR_CONNECTOR_URL=http://127.0.0.1:18791/api/invest`
- `EXPO_PUBLIC_VAULTBOT_URL=http://127.0.0.1:18791/api/chat`

```sh
CI=1 node node_modules/expo/bin/cli start --dev-client --localhost --port 18793
node local-agent-eval/fast-testing/metro-ipv4.mjs
```

The second process bridges IPv4 loopback to IPv6 loopback: Metro listens on
`::1` but this development client requests bundles from `127.0.0.1`.
Experiment-only native reachability checks the actual local backend health,
instead of requiring Google's external internet probe.

The continuation uses `CI=1` to disable Metro watching/reloads. Set
`EXPERIMENT_METRO_PROFILE=ci-no-watch` on benchmark commands to record this
server profile in their manifests. Earlier watch-enabled results stay separate.

AXe batches use `--ax-cache perStep --wait-timeout 10`, with fresh accessibility
inspection after screen changes. Selector dispatch is not success: outcome
checks must verify the subsequent screen and persisted data.

Native commands (one at a time, no web benchmarks in parallel):

```sh
FAST_RESET=1 node local-agent-eval/fast-testing/ios-benchmark.mjs maestro,axe-physical 5
AXE_CHUNK_SIZE=2 node local-agent-eval/fast-testing/ios-search-benchmark.mjs maestro,axe-physical-chunk2 5
AXE_CHUNK_SIZE=1 node local-agent-eval/fast-testing/ios-search-benchmark.mjs axe-physical-chunk1 5
# Calibration only: native cash editing is currently unqualified.
node local-agent-eval/fast-testing/ios-edit-benchmark.mjs maestro,axe-physical-chunk1 5
node local-agent-eval/fast-testing/ios-cold-probe.mjs
```

Native login starts from the email screen (or resets from Home/Profile).
Search starts authenticated; the reset deep link clears fixture query cache
and opens the real Add assets screen. Edit starts at the cash editor, with
UI navigation/preparation separately timed; its final verification includes
process relaunch, ordinary UI login, and reopening the cash balance. The
shared relaunch oracle uses Maestro to activate accessibility before AXe
inspection. The standalone cold probe documents why this dependency exists.
It is not a cold journey benchmark.

The third argument after native modes/run count enables an individual fault,
for example `ios-search-benchmark.mjs maestro 1 stale-search`. Login accepts
`clipped`; edit accepts the three write faults. Failed calibration/reset runs
are retained and must not be pooled with corrected screening runs.

Adaptive web login trials use the same model and goal, with only the strategy
instruction changed:

```sh
node local-agent-eval/fast-testing/agent-run.mjs stepwise clean
node local-agent-eval/fast-testing/agent-run.mjs batched clean
node local-agent-eval/fast-testing/agent-run.mjs batched clipped
node local-agent-eval/fast-testing/agent-screen.mjs
```

These use the approved clean sibling agent worktree and unique daemon socket
sessions, a five-minute trial bound, and one recovery limit. No paid specialist
calls are permitted. `result.json` separates subscription token accounting,
shell-event time, independently verified UI/backend outcomes, and total time.
Event receipt timing is retained for diagnostics, but start/end event receipt
gaps are too small to represent actual shell execution; do not use those fields
as a control/model latency split. End-to-end wall time is the valid timing.
The CLI does not expose model call
count or actual dollar billing; these fields remain null.

Focused checks:

```sh
node node_modules/jest/bin/jest.js --runInBand src/mocks/experiment-transport.test.ts src/hooks/use-mocks-ready.experiment.test.ts
node --test local-agent-eval/fast-testing/qualify-agent.test.mjs
node_modules/.bin/tsgo -p tsconfig.web.json
node_modules/.bin/tsgo -p tsconfig.native.json
```

## Round-two local agents

Browser Use 0.13.10 is isolated in `tools/browser-use-py312`; Stagehand 3.4.0
is pinned in the experiment tools lockfile. Both point only to the loopback
Bonsai endpoint. Start the verified no-thinking runtime first as documented in
[BONSAI.md](BONSAI.md), then run one benchmark at a time:

```sh
tools/browser-use-py312/bin/python browser-use-vault-search.py clean
tools/browser-use-py312/bin/python browser-use-vault-search.py stale-search
node stagehand-bonsai-search.mjs clean 5
STAGEHAND_CACHE=1 node stagehand-bonsai-search.mjs clean 5
STAGEHAND_CACHE=1 node stagehand-bonsai-search.mjs stale-search 2
```

The first cached Stagehand iteration authors/populates the action cache; later
iterations are replays. Do not pool that authoring time with replay latency.
Each runner resets the loopback fixture and retains its own raw result,
screenshot, DOM text and backend receipts under `artifacts/`.

Jev is installed only inside `tools/jev-ultrafast` at commit `1231850a`; its
offline suite passes 31/31. The user authorized a $5 total paid-API cap. The
guarded `jev-vault-login.py` screening runner consumes the TypeSafe key from the
macOS clipboard in process memory, never writes it, permits at most 20 paid
requests and no paid retries, and uses the local no-thinking Bonsai server for
text. Its first credential attempt received HTTP 401 before any accepted model
response. A later valid-key run established the current result: search 5/5,
stale-search detected 1/1, login unsupported because password inputs are excluded.
See `REPORT.md`; do not rerun paid screening without checking `artifacts/jev-budget.json`.
