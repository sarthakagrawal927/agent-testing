# Round 2: local-first browser and native candidates

This continuation tests additional tools without changing the original decision
or packaging a winner skill. Paid general-purpose LLMs remain disabled. Jev's
existing guarded TypeSafe run remains under the owner's $5 cap; all new model
inference in this round uses the loopback Bonsai 2 27B runtime at $0.

## Outcome

Keep saved Playwright workflows as the web regression baseline. Use Jev only as
a cheap exploratory web specialist with independent fixed verification. The
new local candidates add useful options, but no replacement met the complete
adoption rule across the required journeys and faults.

Stagehand's local action cache is the most useful new result: one model-authored
semantic search workflow replayed 4/4 in 2.201 s median with zero repeat model
calls, and its cached fault replay still detected stale results. That is only
about 21% faster than the saved Playwright search median of 2.768 s, not the
required 2x. Its initial authoring run took 25.544 s. Treat it as a way to turn
semantic actions into replayable local actions, not as a general explorer.

Browser Use with Bonsai can complete and verify the journey, and it noticed the
stale QQQ result. It is too slow and preliminary reliability regressed: 4/5
clean runs passed, with one bounded 30 s model timeout before the first action.

## Dynamic-search comparison

Authentication is seeded before timing for this journey. All search input,
readiness, screenshots and fixed UI/backend verification remain in scope.
Median / observed p95 are successful warm completions; failures are reported
separately. At these sample sizes, tail estimates are preliminary.

| Mode                                             | Clean result                           | Model/API use                        | Hidden stale-search   |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------ | --------------------- |
| Saved Playwright                                 | 2.768 / 2.796 s; 5/5                   | 0 calls; $0                          | Detected              |
| agent-browser batch                              | 2.649 / 2.836 s; 5/5                   | 0 calls; $0                          | Detected              |
| Jev + local Bonsai text helper                   | 11.101 s median; 5/5                   | 7 TypeSafe calls; about $0.00063/run | Detected in 11.137 s  |
| Stagehand + Bonsai, uncached semantic actions    | 26.951 / 31.401 s; 5/5                 | 3 local calls; $0                    | Detected in 24.252 s  |
| Stagehand cached replay after 25.544 s authoring | 2.201 / 2.233 s; 4/4                   | 0 model calls; $0                    | Detected in 6.140 s   |
| Browser Use + Bonsai                             | 90.730 / 93.623 s among successes; 4/5 | 8 local calls on successes; $0       | Detected in 129.518 s |
| Puppeteer Core 24.43.1                           | 2.081 / 2.146 s; 5/5                   | 0 calls; $0                          | Detected              |
| WebdriverIO 9.31.9                               | 2.958 / 3.087 s; 5/5                   | 0 calls; $0                          | Detected              |
| Selenium WebDriver 4.49.0                        | 3.633 / 3.651 s; 5/5                   | 0 calls; $0                          | Detected              |
| Nightwatch 3.16.0                                | 5.425 / 5.700 s; 5/5                   | 0 calls; $0                          | Detected              |
| Taiko 1.5.0                                      | 23.850 / 23.921 s; 5/5                 | 0 calls; $0                          | Detected              |

The Browser Use failure was a 30.543 s first-decision model timeout; no search
was issued. Successful runs used three input decisions, three explicit wait
decisions and a final completion decision. The stale run repeatedly observed
that QQQ still showed Vanguard, then ended unsuccessful at its step bound. The
backend oracle independently confirmed the seeded mismatches.

Stagehand's uncached arm is a prepared semantic-action workflow, not unfamiliar
exploration. The local cache stores resolved actions after the authoring run.
Replays hit the cache for all three actions, reducing action resolution to
roughly 20–58 ms each. About 1.9 s of the clean replay remains application
readiness. Stagehand reported zero token metrics for this custom local endpoint,
so token counts are unavailable; cache-hit receipts and zero model invocations
are recorded explicitly.

Raw evidence:

- Browser Use clean: `browser-use-search-1789890573124`,
  `browser-use-search-1789890865043`, `browser-use-search-1789890910433`,
  `browser-use-search-1789891005682`, `browser-use-search-1789891105735`
- Browser Use fault: `browser-use-search-1789891211489`
- Stagehand uncached clean: `stagehand-search-1789891660537`
- Stagehand uncached fault: `stagehand-search-1789891810686`
- Stagehand cached clean: `stagehand-search-1789891873929`; explicit cache-hit
  receipt: `stagehand-search-1789891981150`
- Stagehand cached fault receipt: `stagehand-search-1789892020610`

`browser-use-search-1789890689989` is a retained observation-cadence
calibration and is excluded from screening. The earlier interrupted Browser Use
controller run is retained without a qualifying `result.json`.

## Other round-two findings

- Pinned `@playwright/cli` batch mode passed login 5/5 at 3.235 s median and
  edit 5/5 at 3.076 s median. Both were slower than the saved Playwright
  baseline. Search passed three attempts around 6.42 s before the attached
  browser target closed; the set is not a five-run qualification.
- Chrome DevTools MCP produced five diagnostic bundles in 0.826 s median and a
  Lighthouse snapshot in 1.243 s. It exposed an unlabeled button, low-contrast
  Terms/Privacy links, disabled zoom and crawlability/tree issues. It is a
  diagnostic companion, not a journey executor.
- XcodeBuildMCP's installed-app UI automation replaced the formatted cash field
  correctly in 5/5 probes. Candidate action median was 3.834 s and semantic
  observation median was 1.343 s, but Maestro/debug setup still took about 35 s
  and no save/relaunch journey was qualified.
- The checkout has no app-owned Xcode project/test target or Vault Detox
  configuration. XCUITest and Detox are setup-blocked here, not failed tools.
- Existing Stagehand v3 CUA work was cloud-model oriented. This round instead
  used its local DOM `act` API with the OpenAI-compatible Bonsai endpoint.
  The tested pin is 3.4.0; npm reported 4.1.0 as current, so these timings do
  not establish Stagehand v4 behavior.

## Practical recommendation

For a tool to roam the web app and discover what works, use Jev for supported
authenticated flows, cap its spend, and always apply fixed assertions/backend
checks. Browser Use is the zero-paid-API fallback when latency is acceptable,
but Bonsai 27B is not yet reliable enough to make it the default explorer.

For testing a particular change, keep Playwright. A useful hybrid is: author a
Stagehand semantic action once, inspect the resolved action, then cache/replay
it with the same fixed oracle. Promote stable important flows to ordinary
Playwright tests rather than making the cache the only regression definition.

For iOS, keep Maestro saved flows. Use AXe or XcodeBuildMCP for targeted semantic
inspection/input after accessibility is ready; neither is yet a standalone
replacement on this app.

## Next candidates

The next distinct local-first trials should be bounded in this order:

1. Skyvern local mode with Bonsai through its OpenAI-compatible/Ollama support,
   limited to one search journey before installing its heavier server stack.
2. WebOperator in a dedicated browser profile, not a personal Chrome profile;
   it offers a local Ollama/MLX agent and MCP surface.
3. A visual-agent arm only after a suitable local vision model is available.
   Magnitude requires a large visually grounded model, so text-only Bonsai is
   not a valid comparison.

Do not expand any of these to 20 warm runs until a five-run screen beats the
current reliability and verified-feedback result.
