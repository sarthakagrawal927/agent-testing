# Vaultwealth local testing — screening report

Continuation: [native follow-up](FOLLOWUP.md). Cash-edit calibration passed for
both executors, but resumed screening found another AXe text-entry failure.
Native qualification remains incomplete. [Local Bonsai](BONSAI.md) passed 25/25
synthetic typing checks in two configurations; explicit no-thinking was 4.54×
faster. Live Jev search now passes 5/5, but login is unsupported because Jev's
reader excludes password inputs. The results below
remain the original screening record and are not pooled with new runs.

## Decision

Keep Playwright for the tested web journeys. No web candidate met the proposed
adoption threshold against Playwright. AXe is faster on warm native login and
search with journey-specific settings, but cold accessibility readiness failed
three of three probes and native editing remains unqualified. Do not migrate
the native baseline on this evidence. Fresh batched-agent login exploration
also failed the reliability gate; retain stepwise observation for unfamiliar
states and saved, verified workflows for repeat execution.
No winning-tool skill has been packaged or installed. See [review disposition](REVIEW.md)
for independent-review findings and subsequent guard improvements.

## Web saved workflows (no AI)

Five warm screening trials per cell, alternating executor order. Times include
initial navigation/readiness, observation, and independent final verification.
Median / observed p95 in seconds; p95 is the largest observation at n=5.

| Journey                        | Playwright         | agent-browser direct | agent-browser batch           |
| ------------------------------ | ------------------ | -------------------- | ----------------------------- |
| Invalid + valid login          | 1.178 / 1.400; 5/5 | 2.714 / 3.846; 5/5   | 1.323 / 1.734; 5/5            |
| Edit cash + persistence/reload | 1.898 / 1.950; 5/5 | 1.762 / 1.795; 5/5   | 0/5; edit form never appeared |
| Three asynchronous searches    | 2.768 / 2.796; 5/5 | 2.826 / 2.833; 5/5   | 2.649 / 2.836; 5/5            |

Batching improved agent-browser login versus its own individual-command mode
by about 2.05x, but was about 12% slower than Playwright. Direct commands
were about 7% faster than Playwright for cash editing; this is not the 2x target.
Batch cash editing reported a successful click but timed out waiting for the
edit field in all five corrected screening trials. This is an execution/flow
failure on the clean app, not evidence of a product defect.

Search has a 500 ms keystroke debounce for each settled query. Across the three
queries, combined control/application waiting dominated the saved journey.
The data supports investigating waits/orchestration before replacing this
driver. It does not isolate pure driver latency from application waiting.

All executor arms used the same Playwright screenshot/assertion oracle and
the same independent fixture-state checks. These are saved workflows using
the Playwright library, not Playwright Test CLI startup benchmarks. This is
not a standalone agent-browser-only testing stack or proof of its own visual
reasoning capability.

## Seeded web defects

One trial per defect per viable executor; defects enabled individually.

| Fault                | Discriminating check                                            | Playwright | Direct   | Batch                                   |
| -------------------- | --------------------------------------------------------------- | ---------- | -------- | --------------------------------------- |
| Save silently fails  | Backend amount stays 100,000, not 75,000                        | Detected   | Detected | Not qualified: clean edit already fails |
| Wrong value persists | Backend amount becomes 1, not 75,000                            | Detected   | Detected | Not qualified                           |
| Duplicate write      | Two write-attempt/replay entries, expected one                  | Detected   | Detected | Not qualified                           |
| Stale search         | QQQ query still returns VOO; expected Invesco row never appears | Detected   | Detected | Detected                                |
| Clipped Continue     | Pixel comparison of inspected control reference                 | Detected   | Detected | Detected                                |

The visual fault changed 53.14% of the control pixels (2% limit, channel
tolerance 30). Screenshots outside this explicit checkpoint are evidence,
not automatic visual-defect detections. Duplicate injection replays the
fixture backend write; it does not establish real-server idempotency behavior.
This mutation phase validates fixed oracles; it is not a blinded AI exploration
result. Each baseline/direct executor caught 5/5 seeded fault types with no
clean-run false failures in the selected 15 trials. These samples do not
establish a reliable long-run defect-detection or flake rate.

## Agent interaction strategies

Five fresh web login tasks per mode, same Codex 0.155.1, `gpt-6-astra`, medium
reasoning, goal and verification requirements. Only the interaction-strategy
instruction changed. Trials ran sequentially with alternating/reversed order,
unique browser-agent sessions, a five-minute bound and a fixed recovery gate.

| Mode     | Qualified | Correct account/Home | Verified median / p95    | Median input tokens | Median uncached input | Median command events |
| -------- | --------- | -------------------- | ------------------------ | ------------------- | --------------------- | --------------------- |
| Stepwise | 5/5       | 5/5                  | 155.971 / 225.686 s      | 918,042             | 44,654                | 22                    |
| Batched  | 0/5       | 2/5                  | No qualifying completion | 398,585             | 40,823                | 10                    |

Batched median _attempt_ time was 123.684 s (observed p95 139.657 s), including
failed/incomplete attempts; that is not a verified speedup. Three trials
stopped before completing OTP. Two reached Home but exceeded the experiment's
one-failed-command allowance. Even disregarding that recovery rule, 2/5
functional completions is a regression versus 5/5. Incorrectly predicted wait
wording and command syntax caused the failures; these were not app defects.

Total input decreased 56.6%, but uncached input decreased only 8.6%. Median
cached input was 873,728 versus 356,352; output was 2,285 versus 1,571 tokens.
These are subscription token reports, not proof of a 57% billing saving.
There were 1 versus 11 failed command events across the five trials. No parent
manual intervention occurred within a measured trial. No clean visual defect
was reported, but screenshot-inspection claims are agent reports: files exist,
while the CLI event stream does not expose image-view calls or image-token cost.

These are fresh adaptive tasks, not replays of a learned script. Saved-script
times above isolate execution; they must not be divided into the agent times
and described as a driver speedup. Initial workflow authoring/calibration is
separate and not consistently timed. Raw selected set:
`agent-screen-1789846638698`; [agent summary](artifacts/agent-summary.json)
links every child result and reports successful and failed attempts separately.

One additional blinded stepwise trial correctly reported that the Continue
control was clipped and most of its label obscured. It stopped after one
unsuccessful recovery, without claiming invalid-password or authenticated
Home verification. Detection succeeded; the blocked login was not a completed
journey. Total time including independent verification was 89.440 s; usage was
395,819 input (324,992 cached) and 1,178 output tokens. Evidence:
`agent-stepwise-1789848133812`. Its reported failure to advance is not counted
as an independently established second product defect. The earlier blinded
batched calibration also noticed the clipping but exceeded its recovery limit;
it is retained separately, not pooled with clean timings.

## Optional Jev specialist with local Bonsai

Jev `0.1.0` is pinned at commit `1231850a`; its offline suite passes 31/31.
TypeSafe selects operations and targets; local Bonsai 2 27B PTQ1_0 supplies
field text with thinking disabled. A persistent fail-closed ledger reserves
UTF-8 request bytes before each paid call against the $5 total cap. Paid calls
have no retries. The API key was consumed from the clipboard in process memory
and was not written to evidence.

Five clean authenticated dynamic-search runs passed the full fixed oracle:
VOO → Vanguard, QQQ → Invesco with Vanguard gone, then `zz-no-match` → No
results with both prior results absent. The backend independently recorded all
four search requests (including the initial empty query) each time.

| Clean Jev search                               | Result                                 |
| ---------------------------------------------- | -------------------------------------- |
| Correctness                                    | 5/5; no retries or manual intervention |
| Total median / observed p95                    | 11.101s / 11.391s                      |
| Model calls per run                            | 7 TypeSafe + 3 local Bonsai            |
| Median TypeSafe time per run                   | 6.685s                                 |
| Median Bonsai time per run                     | 3.929s                                 |
| Median remaining browser/app/verification time | about 0.480s                           |
| TypeSafe input/output tokens, five runs        | 74,535 / 4,365                         |
| Estimated TypeSafe spend, five runs            | $0.00313047                            |

Model calls dominate this specialist path. The saved Playwright search median
is 2.768s, about 4.0× faster than Jev, but that is a prepared workflow versus
an adaptive natural-language task and is not a driver-speed comparison. A fair
agent-strategy comparison still needs the same search goal run by the existing
stepwise coding agent.

One hidden `stale-search` mutation was detected: Jev ended `BLOCKED`; the fixed
oracle saw no correct QQQ/no-results states and confirmed three backend
query/served-query mismatches. The five clean runs had no false failures. This
is one mutation observation, not a defect-detection rate.

The representative invalid-then-valid login failed 0/1 after email entry and
Continue. Jev's `snapshot.js` explicitly excludes `input[type=password]`, so
the visible password field never entered its action space; the agent correctly
could not type it. This is a deterministic scope limitation, not a TypeSafe or
Bonsai latency failure. Do not adopt Jev as a general Vaultwealth web agent on
this evidence. It remains promising only for supported, authenticated forms.

Across all accepted live calls, including calibration/failure evidence, the
TypeSafe input-token spend estimate is $0.00479976. The conservative persistent
budget ledger has consumed $0.016167564 of the $5 cap; it never refunds a
pre-request reserve. Raw results are under `artifacts/jev-{login,search}-*`.

## Native saved workflows and startup diagnostic

Five warm screening runs per selected cell; median / observed p95 in seconds.

| Journey / configuration         | Maestro              | AXe                                            |
| ------------------------------- | -------------------- | ---------------------------------------------- |
| Login, physical AXe taps        | 32.964 / 34.775; 5/5 | 12.612 / 12.892; 5/5                           |
| Exact-input asynchronous search | 34.673 / 41.146; 5/5 | 15.279 / 15.317; 5/5 with one-character chunks |

These are approximately 2.61x and 2.27x warm speedups. The login set includes
the explicit Continue pixel check. Search verifies each entered query, each
settled result, absence of the previous result, and independent backend query
receipts. Native query cache is explicitly cleared between runs via an opt-in
debug link with a backend acknowledgment; no search or save is bypassed.
The login set uses AXe's default typing chunk size; search needed a one-character
chunk size. A single uniform AXe configuration was not qualified across both.
Maestro CLI/driver startup is included in each saved flow's warm timing;
the app and simulator stay alive. Persistent Maestro MCP interaction was not
measured by that saved-flow arm.

Configuration matters: automatic AXe taps failed a profile-navigation
calibration, and two-character chunks failed exact `zz-no-match` entry in all
five clean screening runs. Single-character chunks passed all five subsequent
runs, but that follow-up was not interleaved with Maestro. Composite typing
also failed the diagnostic input. The underlying cause of altered text has
not been established; it may involve input dispatch and/or iOS text behavior.

Three separate app-process relaunch probes all returned an empty AXe tree
for the visible onboarding screen within a 10-second post-launch readiness
bound. Each became readable immediately after a Maestro hierarchy request.
Launch itself took 1.52–1.64 seconds; the subsequent Maestro observation took
6.12–6.23 seconds. This is an app-process startup diagnostic, not three cold
journey benchmarks or simulator-boot measurements. It establishes a local
startup dependency, not a universal AXe limitation. A standalone replacement
is not qualified by these warm timings.

Raw sets: `ios-screen-1789843538780`, `ios-search-1789844719974`,
`ios-search-1789845380955`, and `ios-cold-probe-1789845751929`.
Earlier native login samples without inline visual timing and failed reset
calibrations are retained but excluded from this table.

The native clipped-control mutation was detected by the shared pixel oracle
for both arms (56.48% changed pixels, 2% limit), in
`ios-screen-1789846242474` and `ios-screen-1789846276488`. Native editing remains
unqualified: ordinary erase/input prepended the new value to the old balance;
the documented long-press/Select All alternative did not expose Select All;
one reset encountered the development-client overlay. Raw calibrations are
`ios-edit-1789845848020`, `ios-edit-1789845995851`, and
`ios-edit-1789846068470`. No clean edit timing, relaunch-persistence completion,
or native write-fault detection is claimed from these failures.

## Provenance and interpretation limits

- Base: `08a2c77f593db689f5b137f56a8939edbe28d83c`, isolated worktree.
- App build/install: Node 24.21.0, npm 11.19.1; app lockfile unchanged.
  Initial measurement controllers/backend: Node 26.9.0. Playwright 1.62.1,
  agent-browser 0.38.1, AXe 1.8.0, Maestro 2.6.1 (Java 21).
  Chromium 151.0.7922.34; XcodeBuildMCP 2.7.0. Machine: Apple M5 Pro,
  48 GiB RAM, Darwin 27.0.0. Source hashes are in later run manifests.
- Real Vaultwealth web and React Native screens, development configuration,
  dedicated Chromium 1280×800 and iPhone 16 Pro simulator / iOS 26.5.
- Backend is a separate loopback process using existing MSW handlers and
  fixture state. It survives app reload/relaunch, but is not the real Go
  backend or a durable database. Production API correctness is not tested.
- Web/simulator processes remain alive for warm runs; data reset is measured
  separately. No concurrent benchmark runs. Uncontrolled normal machine load
  remains a limitation; the whole Mac was not reserved or instrumented.
- Some fixture handlers have a fixed 100 ms delay; others, including auth,
  do not. Results are specific to this local fixture profile.
- External API calls are intercepted in the configured fixture build; the
  browser context also blocks non-loopback network requests. The original
  fixture revision did not have a fail-closed app handshake. The guarded
  revision adds one and preserves/checks fixture auth headers. The web table
  and fault matrix above were rerun against that guarded revision; older
  calibration runs are not retroactively strengthened.
  Third-party static images are blocked.
  Local bundled images load normally. No personal browser profile is used.
- Native uses an existing development-client binary, with this worktree's
  JavaScript loaded through Metro; no fresh native binary build was measured.
  Its executable SHA-256 is
  `b8443d94d00d07b67dd35ddb6523bfd1d1ce5e1b9ccc66b48b5a9a5d192f1bc0`.
- No Safari, device-cloud, browser-matrix or production-account checks were
  modified. No paid Jev/specialist calls. No commits, pushes, or deployments.
- None of the web candidates warranted expanding to 20 warm + 3 cold trials
  under the screening rule. Native larger-sample qualification was not started
  after the cold-readiness failures and unqualified edit flow. The three
  startup probes are not a substitute for cold journey trials. Tail latency
  estimates are preliminary.

## Cost and effort

Stage detail for saved web execution is in `artifacts/selected-results.json`:
reset is separate; initial start/readiness, observation, combined control/app
waiting and final verification are recorded. Additional checkpoint capture
time is shown as unassigned, not silently omitted from the total. Stage
medians need not sum to the median total. Pure driver versus application
wait time cannot be isolated by these CLI timings.

For agent trials, JSON event receipt spans are not trustworthy shell runtime
measurements: a complete command may emit its start/end records almost
together. `observedShellTimeMs` and `outsideShellTimeMs` are diagnostic only,
not an inference/control split. The report uses end-to-end elapsed time and
reported token usage; model calls and image-token billing are not exposed.

Saved execution uses zero model calls. Subscription inference is separate
from these timings. Codex API spend is not exposed; do not infer dollar cost
from subscription token usage. Jev was left disabled without a paid budget.
Child-run usage does not include this parent agent's orchestration, source
inspection or screenshot-review tokens; those are not exposed in the artifacts.

The independent Codex preflight review completed in 132.347 s and reported
72,067 tokens. Two excluded adaptive-launch attempts hit read-only filesystem
restrictions before UI interaction (59,806 and 59,798 input tokens; 291 and
218 output tokens). These are authoring/setup failures, not driver timings
or verified task completions. The owner subsequently approved scoped writable
experiment runtime/evidence directories.

Setup and repair effort is material: Node/npm engine mismatches, native
absolute loopback URL configuration, Metro IPv4/IPv6 bridging, mock network
reachability, stale UI targets, and one prematurely sampled persistence
assertion required diagnosis. Earlier runs are retained as calibration and
are excluded from the selected comparison. Per-category authoring timers
were not recorded consistently; no fabricated precise allocation is reported.
The final guarded web export took 7.918 seconds wall time with Node 24.21.0,
recorded separately in `artifacts/web-final-build.json` and its build log.

## Coverage boundary

This is a screening result, not completion of every PRD qualification cell.

| Requirement                          | Evidence / remaining gap                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Web saved login, edit, search        | Five clean runs per executor; all five fault types tested on viable executors                       |
| Native saved login and search        | Five warm runs for selected options; default/typing failures retained                               |
| Native edit and relaunch persistence | Calibration failed; no verified completion or native write-fault matrix                             |
| Native visual mutation               | Explicit pixel check detects the clipped control in both arms                                       |
| Native cold journeys                 | Three accessibility-startup probes only; full cold journeys not qualified                           |
| Adaptive exploration                 | Web login strategies only; native interaction and hidden functional-fault exploration not qualified |
| 20 warm + 3 cold expansion           | Not performed; no end-to-end candidate passed screening/coverage gates                              |
| Reusable winning-tool skill          | Not created; no replacement has met the complete adoption threshold                                 |

Final checks: eight transport/startup unit tests, two qualification-guard tests,
web/native typechecks and scoped ESLint passed. The app-hook patch applies cleanly to the
pinned base. These checks validate the experiment plumbing, not the missing
native journey/defect cells.
After measurements, the request deadline's timer was explicitly qualified with
`globalThis` to satisfy the repository's bare-timer lint rule; its existing
`finally` cleanup was preserved and unit tests rerun. No lint-disable was added.
The recorded build/timings precede that non-functional qualification change.
Experiment-owned servers, browser and agent daemons were stopped; evidence,
tools and isolated worktrees remain. The original checkout was not edited.

## Reproduction and raw evidence

See [README.md](README.md) for setup and benchmark commands. Run
`node local-agent-eval/fast-testing/summarize.mjs` to regenerate the selected
web summary. [Selected results](artifacts/selected-results.json) list exact
run directories and stage medians. Each directory retains JSONL attempts,
screenshots, rendered text, and backend state/receipts, including failures.

Selected guarded clean sets: `screen-1789846378172` (login),
`screen-1789846425903` (edit), `screen-1789846495016` (search).
Fault sets are enumerated in `summarize.mjs`. Earlier v1 results are retained
as historical/calibration evidence and not pooled into the final table.

Tool references: [Playwright CLI](https://playwright.dev/docs/test-cli),
[agent-browser](https://github.com/vercel-labs/agent-browser),
[AXe](https://www.axe-cli.com/),
[optional Jev](https://github.com/browser-use/jev-ultrafast).
