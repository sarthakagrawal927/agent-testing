# Expanded saved-web screening

Completed on 20 September 2026 against the same seeded Vaultwealth search
journey and the hidden `stale-search` fault used by the original experiment.

| Candidate | Exact version | Verified clean | Workflow median | Observed p95 | Stale fault |
| --- | --- | ---: | ---: | ---: | --- |
| Puppeteer Core | 24.43.1 | 5/5 | 2.081 s | 2.146 s | detected |
| WebdriverIO | 9.31.9 | 5/5 | 2.958 s | 3.087 s | detected |
| Selenium WebDriver | 4.49.0; ChromeDriver 151.0.5 | 5/5 | 3.633 s | 3.651 s | detected |
| Nightwatch | 3.16.0 | 5/5 | 5.425 s | 5.700 s | detected |
| Taiko | 1.5.0 | 5/5 | 23.850 s | 23.921 s | detected |

The controller reset the local backend before each run. The candidate had to
search for `VOO`, then `QQQ`, then a query with no result. A separate verifier
checked the recorded request and served-query pairs and the final UI state.
The observed p95 is the maximum of five values, not a production tail estimate.

Puppeteer was the fastest added candidate, but its 2.081 second workflow median
was not 2x faster than the 2.768 second Playwright search baseline. None of the
five candidates qualified as a replacement.

TestCafe 3.7.6 was attempted, but its proxy run did not produce a bounded test
result before the 60 second harness timeout. Cypress 16.1.0 was pinned, but its
application binary was not installed in the isolated tool directory. Both are
recorded as setup-blocked, not as tool failures.

Replay while the adapter's seeded web fixture is running:

```sh
node adapters/vaultwealth/runtime/expanded-web-screen.mjs \
  /path/to/clean/vaultwealth-worktree 5 \
  puppeteer,selenium,webdriverio,nightwatch,taiko
```

Raw screenshots, logs, browser profiles, and third-party installations remain
ignored. The sanitized record is
`evidence/expanded-web-screening-2026-09-20.json`.

These are isolated experiment dependencies, not application dependencies.
`npm audit --omit=dev` reported 42 transitive findings (15 high) across the
pinned comparison set, including Taiko, Nightwatch, CodeceptJS, Puppeteer and
Stagehand dependency trees. The available automated fixes change benchmarked
major or pinned versions, so this completed historical screen records the
boundary instead of rewriting its inputs. Do not copy this tools package into
a product.
