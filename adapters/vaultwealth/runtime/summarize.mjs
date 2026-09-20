import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const selected = [
  'screen-1789846378172',
  'screen-1789846425903',
  'screen-1789846495016',
  'screen-1789846539141',
  'screen-1789846552320',
  'screen-1789846565735',
  'screen-1789846569382',
  'screen-1789846603785',
];
const rows = selected.flatMap((dir) =>
  fs
    .readFileSync(path.join(root, 'artifacts', dir, 'results.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => ({ ...JSON.parse(line), source: dir })),
);
const quantile = (xs, p) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? null;
};
const groups = Map.groupBy(rows, (r) => [r.journey, r.mode, r.fault].join('/'));
const summary = [...groups].map(([key, rs]) => {
  const passed = rs.filter((r) => r.status === 'passed');
  return {
    key,
    n: rs.length,
    passed: passed.length,
    medianMs: quantile(
      passed.map((r) => r.totalMs),
      0.5,
    ),
    observedP95Ms: quantile(
      passed.map((r) => r.totalMs),
      0.95,
    ),
    attemptMedianMs: quantile(
      rs.map((r) => r.totalMs),
      0.5,
    ),
    resetMedianMs: quantile(rs.map((r) => r.resetMs).filter(Number.isFinite), 0.5),
    unassignedMedianMs: quantile(
      passed.map((r) => r.totalMs - Object.values(r.stages).reduce((a, b) => a + b, 0)),
      0.5,
    ),
    stageMedians: Object.fromEntries(
      ['startAndReadyMs', 'observationMs', 'controlAndAppWaitMs', 'verificationMs'].map((k) => [
        k,
        quantile(
          passed.map((r) => r.stages[k]).filter((x) => x !== undefined),
          0.5,
        ),
      ]),
    ),
    sources: [...new Set(rs.map((r) => r.source))],
    errors: [...new Set(rs.filter((r) => r.error).map((r) => r.error.split('\n')[0]))],
  };
});
fs.writeFileSync(path.join(root, 'artifacts/selected-results.json'), JSON.stringify({ selected, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
