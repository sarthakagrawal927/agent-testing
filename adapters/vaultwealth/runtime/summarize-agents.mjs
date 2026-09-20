import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname),
  artifacts = path.join(root, 'artifacts');
const selected =
  process.argv[2] ??
  fs
    .readdirSync(artifacts)
    .filter((n) => /^agent-screen-\d+$/.test(n))
    .sort()
    .at(-1);
if (!selected) throw Error('No agent screening set');
const raw = fs
  .readFileSync(path.join(artifacts, selected, 'results.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map(JSON.parse);
const rows = raw.map((row) => {
  const r = row.result ?? {},
    u = r.usage?.[0] ?? {};
  const screenshots = r.agentAnswer?.screenshotsInspected ?? [];
  const screenshotsExist =
    screenshots.length >= 2 &&
    screenshots.every(
      (f) =>
        typeof f === 'string' &&
        path.resolve(f).startsWith(path.resolve(r.out) + path.sep) &&
        fs.existsSync(f) &&
        fs.statSync(f).size > 100,
    );
  return {
    run: row.run,
    mode: row.mode,
    source: r.out,
    qualified: r.qualified === true && screenshotsExist,
    functional: r.functional,
    invalidRejected: r.invalidRejected,
    totalMs: r.totalMs,
    inputTokens: u.input_tokens ?? null,
    cachedInputTokens: u.cached_input_tokens ?? null,
    uncachedInputTokens: u.input_tokens === undefined ? null : u.input_tokens - (u.cached_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? null,
    commandEvents: r.reportedCommandEvents,
    commandFailures: r.commandFailures,
    reportedRecoveries: r.agentAnswer?.recoveryCount,
    reportedScreenshotInspections: screenshots.length,
    screenshotsExist,
    visualDefects: r.agentAnswer?.visualDefects ?? [],
    limitations: r.agentAnswer?.limitations ?? [],
  };
});
const q = (xs, p) => {
  xs = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return xs[Math.max(0, Math.ceil(xs.length * p) - 1)] ?? null;
};
const summary = ['stepwise', 'batched'].map((mode) => {
  const rs = rows.filter((r) => r.mode === mode),
    good = rs.filter((r) => r.qualified);
  return {
    mode,
    n: rs.length,
    qualified: good.length,
    functionalCompletions: rs.filter((r) => r.functional === 'passed').length,
    medianVerifiedMs: q(
      good.map((r) => r.totalMs),
      0.5,
    ),
    observedP95VerifiedMs: q(
      good.map((r) => r.totalMs),
      0.95,
    ),
    medianAttemptMs: q(
      rs.map((r) => r.totalMs),
      0.5,
    ),
    p95AttemptMs: q(
      rs.map((r) => r.totalMs),
      0.95,
    ),
    medianInputTokens: q(
      rs.map((r) => r.inputTokens),
      0.5,
    ),
    medianCachedInputTokens: q(
      rs.map((r) => r.cachedInputTokens),
      0.5,
    ),
    medianUncachedInputTokens: q(
      rs.map((r) => r.uncachedInputTokens),
      0.5,
    ),
    medianOutputTokens: q(
      rs.map((r) => r.outputTokens),
      0.5,
    ),
    medianCommandEvents: q(
      rs.map((r) => r.commandEvents),
      0.5,
    ),
    totalCommandFailures: rs.reduce((n, r) => n + (r.commandFailures ?? 0), 0),
    totalInputTokens: rs.reduce((n, r) => n + (r.inputTokens ?? 0), 0),
    totalOutputTokens: rs.reduce((n, r) => n + (r.outputTokens ?? 0), 0),
  };
});
const result = {
  selected,
  modelCalls: null,
  imageTokenInputs: null,
  apiSpend: null,
  eventTiming: 'receipt spans only; not a valid execution/model split',
  visualInspection: 'reported by agent; screenshot files checked; CLI event stream does not expose image-view calls',
  summary,
  rows,
};
fs.writeFileSync(path.join(artifacts, 'agent-summary.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(summary, null, 2));
