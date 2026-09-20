# Independent review disposition

Reviewer: Codex gpt-6-astra, read-only, static inspection. Raw structured review
is retained at [artifacts/method-review.json](artifacts/method-review.json)
and in fleet-skill-run.
No reviewer benchmarks ran concurrently with the native screening.

- Accepted: aggregate adaptive pass must require invalid-login rejection,
  successful process completion, final UI, and the expected visual verdict.
  Qualification now checks those fields; a final Home screen remains only a
  separately named functional checkpoint. An explicit image-viewing instruction
  was added because a saved path is not evidence of screenshot inspection.
- Accepted: qualification must never overwrite a visual baseline. The benchmark
  now rejects `RECORD_VISUAL=1`; capture is a separate clean-reset command.
- Accepted: exit both native loops after a calibration failure. Fixed with a
  labeled break in the login calibration harness; selected login screening had
  no failures. The later search harness records all scheduled typing failures.
- Accepted limitation: alternate/reverse order is not fully balanced for three
  arms. The direct arm stays in the middle. Small differences are descriptive,
  not a statistically established driver advantage.
- Accepted limitation: existing fixture handlers are not an independent auth
  implementation; the original transport supplied a fixture bearer token.
  Identity checks are fixture identity checks, not proof of real authentication
  or token enforcement. The invalid-password outcome is independently observed
  in the UI and local backend status.
- Accepted wording correction: `writes` contains attempts and injected replay
  entries, not necessarily successful processed writes. Persistence is checked
  separately against state.
- Scoped permission finding: the owner explicitly approved writable access to
  the clean agent worktree plus runtime/evidence directories. The worktree itself
  is writable, not just evidence folders. The agent is instructed not to edit
  product files; check the worktree diff after runs. Network permission is not
  a security-enforced localhost allowlist for arbitrary shell commands. The
  actual browser context blocks non-loopback network requests; synthetic test
  credentials and local service URLs are used. Do not describe the entire agent
  sandbox as network-isolated.
- Mock-startup finding fixed in the guarded revision: experiment startup stays
  closed if interception fails. A nonce echo requested through an invalid host
  proves the interceptor routes to the loopback fixture before the app opens.
  Incoming auth headers are preserved and protected fixture endpoints reject
  missing/wrong fixture tokens. Eight focused startup/transport tests pass.
  This still does not test real server authentication. Earlier results are
  not retroactively upgraded to the guarded revision.
- Native search reset finding: query cache re-entry alone was insufficient.
  A debug-only cache-clear URL now acknowledges its epoch to the backend;
  exact input and per-query backend responses are required. Earlier cache-hit
  search calibrations are excluded, including a false-positive shortened query.
- Recovery accounting: agent self-reports are insufficient. More than one
  failed command disqualifies the current bounded agent protocol; the earlier
  clipped trial had three failed commands and is not a qualifying completion.
- Rejected selector finding: `['find','role','combobox','fill','VOO','--name','Search']`
  destructures `f` to `Search`, correctly. The click command destructures `e` to
  the button name. The review miscounted the tuple positions; no selector change
  is required for the current commands.
