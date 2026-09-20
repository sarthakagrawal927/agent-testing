import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { provenance } from './provenance.mjs';
import { maestroCli, simulatorUdid, xcodebuildMcpCli } from './tool-paths.mjs';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'artifacts', `xcodebuildmcp-input-${Date.now()}`);
const udid = simulatorUdid();
fs.mkdirSync(out, { recursive: true });

function run(bin, args, timeout = 90_000) {
  const started = performance.now();
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 12 * 1024 * 1024,
    env: process.env,
  });
  const durationMs = performance.now() - started;
  if (result.status !== 0) throw new Error(result.stdout + result.stderr + String(result.error ?? ''));
  return { durationMs, stdout: result.stdout };
}

function xcode(command, args = []) {
  const result = run(
    xcodebuildMcpCli,
    ['ui-automation', command, '--simulator-id', udid, ...args, '--output', 'json'],
    30_000,
  );
  const parsed = JSON.parse(result.stdout);
  if (parsed.didError) throw new Error(JSON.stringify(parsed.error));
  return { ...result, parsed };
}

const backend = (endpoint, body) =>
  fetch(`http://127.0.0.1:18791/${endpoint}`, {
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    headers: { Connection: 'close' },
    signal: AbortSignal.timeout(5000),
  }).then((response) => response.json());

const maestro = (flow, evidence, extra = []) =>
  run(maestroCli, ['--device', udid, 'test', ...extra, '--test-output-dir', evidence, path.join(root, flow)]);

const result = {
  candidate: 'xcodebuildmcp-ui-automation',
  journey: 'formatted-cash-input-calibration',
  expected: '75,000',
  status: 'failed',
  stages: {},
  modelCalls: 0,
  retries: 0,
  startedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify(
    {
      ...provenance(),
      udid,
      candidate: 'XcodeBuildMCP UI Automation',
      scope: 'one input calibration; no save is attempted',
      setup: 'Maestro debug reset and navigation, excluded from candidate action timing',
      oracle: 'XcodeBuildMCP refreshed runtime snapshot plus zero backend writes',
    },
    null,
    2,
  ),
);

try {
  const setupStart = performance.now();
  await backend('reset', { fault: 'clean' });
  const epoch = String(Date.now());
  const plan = maestro('ios-plan-reset.yaml', path.join(out, 'plan'), ['-e', `EPOCH=${epoch}`]);
  fs.writeFileSync(path.join(out, 'plan.log'), plan.stdout);
  const open = maestro('ios-open-cash.yaml', path.join(out, 'open-cash'));
  fs.writeFileSync(path.join(out, 'open-cash.log'), open.stdout);
  const setupState = await backend('state');
  assert.equal(setupState.cacheResetEpoch, epoch);
  assert.equal(setupState.state.assets.find((asset) => asset.id === 'demo-cash')?.meta.amount, 100000);
  result.stages.setupMs = performance.now() - setupStart;

  const observationStart = performance.now();
  const before = xcode('snapshot-ui');
  fs.writeFileSync(path.join(out, 'before.json'), before.stdout);
  const targets = before.parsed.data.capture.targets ?? [];
  const balance = targets.find((target) => /\|typeText\|text-field\|\|100,000\.00\|/.test(target));
  assert.ok(balance, 'The initial 100,000.00 balance target is required');
  const balanceRef = balance.split('|')[0];
  result.stages.observationMs = performance.now() - observationStart;

  const actionStart = performance.now();
  const typed = xcode('type-text', ['--element-ref', balanceRef, '--text', '75000', '--replace-existing']);
  fs.writeFileSync(path.join(out, 'typed.json'), typed.stdout);
  result.stages.controlAndAppWaitMs = performance.now() - actionStart;
  const typedTargets = typed.parsed.data.capture.targets ?? [];
  const observedTarget = typedTargets.find((target) => target.startsWith(`${balanceRef}|typeText|text-field|`));
  result.observed = observedTarget?.split('|')[4] ?? null;

  const screenshot = xcode('screenshot');
  fs.writeFileSync(path.join(out, 'screenshot.json'), screenshot.stdout);
  const screenshotPath = screenshot.parsed.data.artifacts?.screenshotPath;
  if (screenshotPath) fs.copyFileSync(screenshotPath, path.join(out, 'typed.jpg'));

  const close = typedTargets.find((target) => /\|tap\|button\|Close\|\|close-button$/.test(target));
  if (close) {
    const closed = xcode('tap', ['--element-ref', close.split('|')[0]]);
    fs.writeFileSync(path.join(out, 'close.json'), closed.stdout);
  }
  const state = await backend('state');
  fs.writeFileSync(path.join(out, 'backend.json'), JSON.stringify(state, null, 2));
  assert.equal(state.writes.length, 0, 'Calibration must not save');
  assert.ok(['75,000', '75,000.00'].includes(result.observed), `Observed ${result.observed}`);
  result.status = 'passed';
} catch (error) {
  result.error = String(error);
  try {
    const state = await backend('state');
    fs.writeFileSync(path.join(out, 'backend.json'), JSON.stringify(state, null, 2));
  } catch {}
}

fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, out }));
