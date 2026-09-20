// App-process-cold journeys. Simulator/Metro remain alive; no rebuild is timed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { provenance } from './provenance.mjs';
import { maestroCli, simulatorUdid, xcodebuildMcpCli } from './tool-paths.mjs';
const root = path.dirname(new URL(import.meta.url).pathname);
const udid = simulatorUdid();
const journey = process.argv[2] ?? 'login';
assert.ok(['login', 'search', 'edit'].includes(journey));
const runs = Number(process.argv[3] ?? 3);
const out = path.join(root, 'artifacts', `ios-cold-${journey}-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const run = (bin, args, timeout = 45000) => {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 8e6,
    env: { ...process.env, FAST_RESET: '1', AXE_CHUNK_SIZE: '1' },
  });
  if (result.status !== 0) {
    const error = Error(result.stdout + '\n' + result.stderr + '\n' + result.error);
    error.code = result.error?.code;
    throw error;
  }
  return result.stdout;
};
const mcp = (command) =>
  run(xcodebuildMcpCli, [
    'simulator',
    command,
    '--simulator-id',
    udid,
    '--bundle-id',
    'com.vaultwealth.app-development',
  ]);
const modes = journey === 'login' ? ['maestro', 'axe-physical'] : ['maestro', 'axe-physical-chunk1'];
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify(
    {
      ...provenance(),
      journey,
      modes,
      runs,
      axeTypeChunkSize: journey === 'login' ? 200 : 1,
      thermalState: 'app-process cold; simulator, Metro, fixture backend warm',
      activation: 'shared Maestro hierarchy, always included in cold total',
      timing: 'from launch-app through full child verification; stop excluded; reset/navigation preparation included',
    },
    null,
    2,
  ),
);
for (let i = 0; i < runs; i++) {
  for (const mode of i % 2 ? [...modes].reverse() : modes) {
    const dir = path.join(out, `${mode}-${i}`);
    fs.mkdirSync(dir);
    const receipt = { journey, mode, run: i, status: 'failed', modelCalls: 0 };
    let started;
    try {
      const reset = await fetch('http://127.0.0.1:18791/reset', {
        method: 'POST',
        body: JSON.stringify({ fault: 'clean' }),
        signal: AbortSignal.timeout(5000),
      });
      assert.ok(reset.ok, 'clean fixture before cold launch');
      fs.writeFileSync(path.join(dir, 'stop.log'), mcp('stop'));
      started = performance.now();
      fs.writeFileSync(path.join(dir, 'launch.log'), mcp('launch-app'));
      receipt.launchMs = performance.now() - started;
      const activation = performance.now();
      fs.writeFileSync(path.join(dir, 'activation.json'), run(maestroCli, ['--device', udid, 'hierarchy']));
      receipt.activationMs = performance.now() - activation;
      const script = journey === 'login' ? 'ios-benchmark.mjs' : `ios-${journey}-benchmark.mjs`;
      const output = run(process.execPath, [path.join(root, script), mode, '1', 'clean'], 300000);
      fs.writeFileSync(path.join(dir, 'journey.log'), output);
      const evidence = output.trim().split('\n').at(-1);
      assert.ok(evidence.startsWith(path.join(root, 'artifacts', 'ios-')));
      receipt.evidence = evidence;
      const rows = fs.readFileSync(path.join(evidence, 'results.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(rows.length, 1);
      receipt.journeyResult = rows[0];
      assert.equal(rows[0].status, 'passed');
      receipt.status = 'passed';
    } catch (error) {
      receipt.error = String(error);
      if (error.code === 'ETIMEDOUT') {
        receipt.status = 'timed_out';
        receipt.requiresCleanup = 'Inspect and stop owned descendant tooling before any further benchmark';
      }
    }
    receipt.totalMs = started ? performance.now() - started : null;
    fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(receipt) + '\n');
    console.log(receipt);
    if (receipt.status !== 'passed') {
      console.log(out);
      process.exit(1);
    }
  }
}
console.log(out);
