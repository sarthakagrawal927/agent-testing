import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { provenance } from './provenance.mjs';
import { maestroCli, simulatorUdid } from './tool-paths.mjs';
const root = path.dirname(new URL(import.meta.url).pathname);
const udid = simulatorUdid();
const modes = (process.argv[2] ?? 'maestro,axe-physical').split(',');
const runs = Number(process.argv[3] ?? 5),
  fault = process.argv[4] ?? 'clean';
const out = path.join(root, 'artifacts', `ios-search-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const run = (bin, args, timeout = 90000) => {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  });
  if (r.status !== 0) throw Error(r.stdout + '\n' + r.stderr + '\n' + r.error);
  return r.stdout;
};
const axe = (command, args = []) => run(path.join(root, 'tools/axe/axe'), [command, '--udid', udid, ...args], 30000);
const chunkSize = process.env.AXE_CHUNK_SIZE ?? '2';
const batch = (steps) =>
  axe('batch', [
    '--ax-cache',
    'perStep',
    '--tap-style',
    'physical',
    '--type-chunk-size',
    chunkSize,
    '--wait-timeout',
    '10',
    ...steps.flatMap((s) => ['--step', s]),
  ]);
const tree = () => JSON.parse(axe('describe-ui'));
const flat = (xs) => xs.flatMap((n) => [n, ...flat(n.children ?? [])]);
const visible = (n) => n.frame?.x >= 0 && n.frame?.x < 402 && n.frame?.y > 0 && n.frame?.y < 790;
function wait(check, label) {
  const deadline = performance.now() + 10000;
  do {
    const t = tree();
    if (check(flat(t))) return t;
  } while (performance.now() < deadline);
  throw Error('Readiness timeout: ' + label);
}
const includes = (ns, text) => ns.some((n) => visible(n) && n.AXLabel?.includes(text));
const shot = (file) => axe('screenshot', ['--output', file]);
const backend = (endpoint, body) =>
  fetch('http://127.0.0.1:18791/' + endpoint, {
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    headers: { Connection: 'close' },
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json());
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify({ ...provenance(), modes, runs, fault, udid, chunkSize, journey: 'search' }, null, 2),
);
screening: for (let i = 0; i < runs; i++)
  for (const mode of i % 2 ? [...modes].reverse() : modes) {
    const dir = path.join(out, mode + '-' + i);
    fs.mkdirSync(dir, { recursive: true });
    const result = {
      journey: 'search',
      mode,
      run: i,
      fault,
      modelCalls: 0,
      retries: 0,
      stages: {},
      startedAt: new Date().toISOString(),
    };
    let started;
    try {
      const resetStart = performance.now();
      // The debug-only link clears cached fixture queries and opens the actual
      // starting screen; it never invokes search or writes a record.
      await backend('reset', { fault });
      const epoch = String(Date.now());
      fs.writeFileSync(
        path.join(dir, 'reset.log'),
        run(maestroCli, [
          '--device',
          udid,
          'test',
          '-e',
          `EPOCH=${epoch}`,
          '--test-output-dir',
          path.join(dir, 'reset'),
          path.join(root, 'ios-cache-reset.yaml'),
        ]),
      );
      await expect
        .poll(async () => (await backend('state')).cacheResetEpoch, { timeout: 5000, intervals: [100, 250] })
        .toBe(epoch);
      wait((ns) => ns.some((n) => n.AXUniqueId === 'asset-search-picker-input'), 'Add assets starting screen');
      batch([
        'tap --id asset-search-picker-input --element-type TextField',
        'key-combo --modifiers 227 --key 4',
        'key 42',
      ]);
      wait(
        (ns) => ns.some((n) => n.AXUniqueId === 'asset-search-picker-input' && n.AXValue === 'Search assets...'),
        'blank search',
      );
      result.resetMs = performance.now() - resetStart;
      started = performance.now();
      shot(path.join(dir, 'initial.png'));
      fs.writeFileSync(path.join(dir, 'initial.json'), JSON.stringify(tree()));
      result.stages.observationMs = performance.now() - started;
      const controlStart = performance.now();
      if (mode === 'maestro')
        fs.writeFileSync(
          path.join(dir, 'flow.log'),
          run(maestroCli, [
            '--device',
            udid,
            'test',
            '-e',
            `EVIDENCE=${dir}`,
            '--test-output-dir',
            dir,
            path.join(root, 'ios-search.yaml'),
          ]),
        );
      else
        for (const [j, query, text] of [
          [0, 'VOO', 'Vanguard S&P 500 ETF'],
          [1, 'QQQ', 'Invesco QQQ Trust'],
          [2, 'zz-no-match', 'No results'],
        ]) {
          batch([
            'tap --id asset-search-picker-input --element-type TextField',
            ...(j ? ['key-combo --modifiers 227 --key 4', 'key 42'] : []),
            `type ${query}`,
          ]);
          wait(
            (ns) =>
              ns.some(
                (n) =>
                  n.AXUniqueId === 'asset-search-picker-input' &&
                  String(n.AXValue).toLowerCase() === query.toLowerCase(),
              ),
            `exact input ${query}`,
          );
          wait(
            (ns) => includes(ns, text) && (!j || !includes(ns, j === 1 ? 'Vanguard S&P 500 ETF' : 'Invesco QQQ Trust')),
            text,
          );
          shot(path.join(dir, 'search-' + j + '.png'));
        }
      result.stages.controlAndAppWaitMs = performance.now() - controlStart;
      const verification = performance.now();
      const t = wait((ns) => includes(ns, 'No results') && !includes(ns, 'Invesco QQQ Trust'), 'final results');
      fs.writeFileSync(path.join(dir, 'final.json'), JSON.stringify(t));
      const state = await backend('state');
      fs.writeFileSync(path.join(dir, 'backend.json'), JSON.stringify(state));
      for (const query of ['VOO', 'QQQ', 'zz-no-match'])
        assert(
          state.requests.some(
            (r) =>
              r.path.endsWith('/assets/search') && r.status === 200 && r.query?.toLowerCase() === query.toLowerCase(),
          ),
          `An actual ${query} response is required`,
        );
      shot(path.join(dir, 'final.png'));
      result.stages.verificationMs = performance.now() - verification;
      result.status = 'passed';
    } catch (e) {
      result.status = 'failed';
      result.error = String(e);
      try {
        shot(path.join(dir, 'failure.png'));
        fs.writeFileSync(path.join(dir, 'failure.json'), JSON.stringify(tree()));
        fs.writeFileSync(path.join(dir, 'backend.json'), JSON.stringify(await backend('state')));
      } catch {}
    }
    result.totalMs = started ? performance.now() - started : null;
    fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(result) + '\n');
    console.log(JSON.stringify(result));
    if (!started) break screening;
  }
console.log(out);
