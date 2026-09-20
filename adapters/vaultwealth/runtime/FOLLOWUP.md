# Native qualification follow-up — 20 September 2026

Resumed with user approval after DeviceHub quit shut down the simulator.
This continuation preserves original screening sets and uses new directories
for corrected workflows. No winner is selected; full qualification is incomplete.

Full cash-edit calibration `ios-edit-1789879080531` passed for both executors,
including one backend write of `75000` and UI value `75,000.00` after process
relaunch. Maestro: 67.768s total (17.675s control/waits, 49.269s verification).
AXe physical/chunk1: 57.895s total (8.223s control/waits, 48.781s verification).
This is one calibration each, not a reliability estimate. Action speedup is
about 2.15×, but verified-feedback speedup is only 1.17×. Five-run screening
follows with source hashes for the corrected cash workflows.

The subsequent gesture-based set `ios-edit-1789879300635` stopped on Maestro's
fourth attempt: three Maestro completions and four AXe completions, then a
Maestro Save tap typed `1` because the keyboard remained exposed. No write
occurred. The fifth pair was not run. Do not report this as five passing trials.
Manual review also found the Expo blue `Refreshing...` overlay in both first-pair
final screenshots. Functional checks passed, but those are not unobscured visual
passes. Artifact-triggered HMR is a hypothesis, not an established cause.

Next configuration: Metro starts with `CI=1` (the installed Expo CLI explicitly
disables watch/reloads), and both executors dismiss the keyboard by tapping the
non-interactive Updated text. They require the blurred `75,000.00` before Save.
A screenshot guard rejects a large full-width refresh-blue band; it correctly
rejects the previous Maestro screenshot. This guard is specifically for the
observed dev overlay, not a general visual-regression oracle.

## HMR-disabled results and interruption

`ios-edit-1789880323016` contains one completed pair: Maestro 68.973s and AXe
57.778s, both with zero refresh-blue rows at initial/final visual checkpoints,
one fixture write, and the correct value after app-process relaunch. These are
single observations, not medians/p95 or five-run qualification.

The next AXe trial saved successfully but failed during relaunch observation
because the entire simulator was shutting down. The macOS system log records
DeviceHub PID 1337 at `2026-09-20 10:33:02.606` IST:
`prepareForApplicationTermination(shutdownDevices:): Shutting down device
the dedicated test simulator on app quit`.
The runner stopped. No further native benchmark remains active. This is an
environment interruption, not an AXe defect; it remains in raw results.
The owned fixture backend, Metro and IPv4 bridge were then stopped gracefully.
Evidence and worktrees remain intact. Focused app-hook tests pass (8/8), the
two existing agent-qualification tests pass, new runner syntax checks pass,
and `git diff --check` passes. No tracked product-checkout change was made.

## Prepared, not executed

- `ios-write-faults.mjs`: six sequential write-fault trials; requires the intended
  UI payload, exact backend fault signature and a verification rejection.
- `ios-cold-journeys.mjs <login|search|edit> 3`: full app-process-cold journeys,
  with launch, shared Maestro accessibility activation, setup/navigation and
  final verification timed. Simulator stop is outside timing. Simulator/Metro
  remain warm, and these are explicitly hybrid cold runs.
- Both wrappers stop on unexpected failures; timeouts require inspection and
  cleanup of owned descendants before another benchmark. Neither wrapper has
  been runtime-qualified yet; syntax checks pass.
- Native 20-warm/3-cold qualification, remaining native fault checks, and native
  adaptive-agent trials have not been completed.

## Optional Jev

The user has a TypeSafe key and approved a $5 total paid-API cap, covering Jev
and typing-model calls. No paid request, credential access, or Jev install has
occurred. The user selected local Bonsai 27B (Free AI is an allowed fallback)
and approved isolated setup/downloads. TypeSafe secure credential setup is still
pending; no keys are read from existing stores or requested in chat.
The [official experiment](https://github.com/browser-use/jev-ultrafast)
uses TypeSafe Jev for action/target selection and a separate text model for
typing. Its profile-sharing default must not be used with personal Chrome data.

Jev `0.1.0` is now pinned at commit `1231850a` in the experiment tools and its
31 offline tests pass. `jev-vault-login.py` provides a one-run login screening
with a 20-request limit, no paid retries, conservative pre-request accounting
against the $5 cap, local Bonsai text generation, and fixed post-run checks.
The initial browser/credential failures remain as calibration evidence. With a
valid clipboard key, clean authenticated search passed 5/5 at 11.101s median /
11.391s observed p95, and one hidden stale-search mutation was detected by the
fixed oracle. Login failed because upstream Jev intentionally excludes password
inputs from its DOM action space. See the main report for timing/cost breakdown.
All owned Jev browser, web server, and Bonsai processes are stopped.

## Resumed screening and local model preparation

`ios-edit-1789881352563` contains one Maestro completion (67.996s) followed by
an AXe input failure (13.154s): expected `75,000`, observed `000`, zero fixture
writes. Both initial screenshots passed the refresh-overlay guard. This is a
workflow failure, not a seeded defect detection or successful completion.
Timing is paused while the isolated model artifacts download.

The next AXe revision separates focus, clear, and type with intermediate
accessibility checks. The native CurrencyInput implementation changes the
display from `100,000.00` to `100,000` on focus; keyboard visibility is not a
required gate. This revision passes syntax checking but is not runtime-qualified.

`bonsai-typing-probe.mjs` completed two configurations, 25/25 exact responses
each. Explicit template no-thinking reduced pooled median from 4.907s to 1.082s
and sampled peak server RSS from 9.252 GB to 7.305 GB. See [Bonsai report](BONSAI.md)
for per-case p95, tokens, provenance, reproduction and raw evidence paths.
It made no TypeSafe request and cannot establish application completion, visual
detection, or driver speedup. Its null case requires missing information to be
refused (Jev rejects null without typing). Memory is sampled server RSS, not
total unified-memory consumption. Both owned model servers are now stopped.

## Calibration findings

- The simulator had been shut down. The existing application launched after
  boot; no reinstall or rebuild was necessary. The native executable hash still
  matches the original manifest (`b8443d94…192f1bc0`). Metro rebuilt the JS bundle
  separately from the measured journeys.
- `ios-edit-1789878627225` stopped in preparation on a transient duplicate email
  accessibility match. The relaunch login helper now waits for one email field.
- `ios-edit-1789878688183` demonstrated that focusing the amount changes
  `100,000.00` to `100,000`. Center tapping places the cursor before the number.
  The corrected Maestro flow refreshes the focused selector, taps its right
  edge, erases seven displayed characters, and requires exactly `75,000`.
- The cursor-repair probe exposed Save underneath the numeric keyboard: the
  tap typed `1`, no backend write occurred, and the editor-close assertion failed.
  `hideKeyboard` also failed. A bounded sheet swipe exposes Save and the
  scroll-repair probe completed with exactly one write and amount `75000`.
  These are calibration attempts, not benchmark samples.
- `ios-edit-1789878967515` passed UI saving and backend verification, then failed
  because the draft relaunch oracle expected onboarding but the app restored
  signed-in Home. The corrected oracle permits either state, then reopens the
  record and requires its persisted value. It does not inject authentication.
- The original cold-probe trees were checked directly: all three before-Maestro
  trees contain only the application root, while all three after-Maestro trees
  expose onboarding. That evidence is not explained by the restored-Home case.

The [Maestro relative-point command](https://docs.maestro.dev/reference/commands-available/tapon)
supports targeting the right side of the identified field. Coordinates for the
sheet swipe remain pinned to the same 402×874 simulator viewport.

An independent read-only teammate researched cold accessibility recovery.
No documented AXe initialization command was found. Maestro-assisted cold
observation remains an explicitly labeled hybrid, with its cost included in
relaunch verification; it is not proof of standalone AXe cold readiness.
