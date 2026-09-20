// Six sequential, individually seeded write-fault checks; never run beside a benchmark.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'artifacts', `ios-write-faults-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
for (const fault of ['save-fails', 'wrong-value', 'duplicate']) {
  for (const mode of ['maestro', 'axe-physical-chunk1']) {
    const run = spawnSync(process.execPath, [path.join(root, 'ios-edit-benchmark.mjs'), mode, '1', fault], {
      encoding: 'utf8',
      timeout: 180000,
      maxBuffer: 8e6,
    });
    fs.writeFileSync(path.join(out, `${fault}-${mode}.log`), run.stdout + '\n' + run.stderr + '\n' + (run.error ?? ''));
    const receipt = { fault, mode, detected: false };
    if (run.error?.code === 'ETIMEDOUT') {
      receipt.status = 'timed_out';
      receipt.requiresCleanup = 'Inspect and stop owned descendant tooling before any further benchmark';
    }
    try {
      assert.equal(run.status, 0, 'Harness completed within its process bound');
      const evidence = run.stdout.trim().split('\n').at(-1);
      assert.ok(evidence.startsWith(path.join(root, 'artifacts', 'ios-edit-')));
      receipt.evidence = evidence;
      const rows = fs.readFileSync(path.join(evidence, 'results.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(rows.length, 1);
      const row = rows[0];
      assert.equal(row.status, 'failed', 'Seeded defect must reject completion');
      assert.ok(row.stages.controlAndAppWaitMs > 0, 'UI edit completed before verification rejected it');
      const state = JSON.parse(fs.readFileSync(path.join(evidence, `${mode}-0`, 'backend.json')));
      const amount = state.state.assets.find((asset) => asset.id === 'demo-cash')?.meta.amount;
      assert.ok(state.writes.every((write) => write.assets.some((asset) => asset.meta?.amount === 75000)));
      assert.equal(state.writes.length, fault === 'duplicate' ? 2 : 1);
      assert.equal(amount, fault === 'save-fails' ? 100000 : fault === 'wrong-value' ? 1 : 75000);
      assert.match(row.error, fault === 'duplicate' ? /Exactly one fixture write attempt/ : /toBe\(expected\)/);
      receipt.detected = true;
      receipt.amount = amount;
      receipt.writeAttempts = state.writes.length;
      receipt.rejection = row.error;
    } catch (error) {
      receipt.error = String(error);
    }
    fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(receipt) + '\n');
    console.log(receipt);
    if (!receipt.detected) {
      process.exitCode = 1;
      console.log(out);
      process.exit();
    }
  }
}
console.log(out);
