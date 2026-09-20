// Fixed cash edit experiment. Shared relaunch oracle uses Maestro to activate
// accessibility after process launch, then AXe for UI login and value inspection.
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { verifyNoDevRefreshOverlay } from './ios-visual.mjs';
import { provenance } from './provenance.mjs';
import { maestroCli, simulatorUdid, xcodebuildMcpCli } from './tool-paths.mjs';
const root = path.dirname(new URL(import.meta.url).pathname),
  udid = simulatorUdid();
const modes = (process.argv[2] ?? 'maestro,axe-physical-chunk1').split(','),
  runs = Number(process.argv[3] ?? 5),
  fault = process.argv[4] ?? 'clean';
const out = path.join(root, 'artifacts', `ios-edit-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const run = (bin, args, timeout = 90000) => {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 8e6,
    env: process.env,
  });
  if (r.status !== 0) throw Error(r.stdout + '\n' + r.stderr + ' ' + r.error);
  return r.stdout;
};
const axe = (cmd, args = []) => run(path.join(root, 'tools/axe/axe'), [cmd, '--udid', udid, ...args], 30000);
const batch = (steps) =>
  axe('batch', [
    '--tap-style',
    'physical',
    '--type-chunk-size',
    '1',
    '--ax-cache',
    'perStep',
    '--wait-timeout',
    '10',
    ...steps.flatMap((s) => ['--step', s]),
  ]);
const tree = () => JSON.parse(axe('describe-ui'));
const flat = (xs) => xs.flatMap((n) => [n, ...flat(n.children ?? [])]);
function wait(check, label, timeout = 10000) {
  const end = performance.now() + timeout;
  do {
    const t = tree();
    if (check(flat(t))) return t;
  } while (performance.now() < end);
  throw Error('Readiness timeout: ' + label);
}
const shot = (file) => axe('screenshot', ['--output', file]);
const backend = (endpoint, body) =>
  fetch('http://127.0.0.1:18791/' + endpoint, {
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    headers: { Connection: 'close' },
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json());
const maestro = (flow, dir, extra = []) =>
  run(maestroCli, [
    '--device',
    udid,
    'test',
    '-e',
    `EVIDENCE=${dir}`,
    ...extra,
    '--test-output-dir',
    dir,
    path.join(root, flow),
  ]);
const mcp = (cmd) =>
  run(xcodebuildMcpCli, ['simulator', cmd, '--simulator-id', udid, '--bundle-id', 'com.vaultwealth.app-development']);
async function openCash(dir) {
  const epoch = String(Date.now());
  fs.writeFileSync(
    path.join(dir, 'plan.log'),
    maestro('ios-plan-reset.yaml', path.join(dir, 'plan'), ['-e', `EPOCH=${epoch}`]),
  );
  await expect
    .poll(async () => (await backend('state')).cacheResetEpoch, { timeout: 5000, intervals: [100, 250] })
    .toBe(epoch);
  fs.writeFileSync(path.join(dir, 'open-cash.log'), maestro('ios-open-cash.yaml', path.join(dir, 'open-cash')));
  wait((ns) => ns.some((n) => n.AXUniqueId === 'edit-asset-save'), 'cash editor');
}
function login() {
  batch(['tap --id onboarding-login-button']);
  wait(
    (ns) => ns.filter((n) => n.AXUniqueId === 'login-email-input' && n.type === 'TextField').length === 1,
    'unique email field after navigation',
  );
  batch([
    'tap --id login-email-input --element-type TextField',
    'type user@example.com',
    'tap --id login-email-continue',
    'tap --id login-password-input --element-type TextField',
    'type SecurePass1!',
    'tap --id login-password-continue',
    'tap --id otp-input-0',
    'type 123456',
    'tap --id login-otp-continue',
    'tap --id login-biometrics-skip',
  ]);
  wait((ns) => ns.some((n) => n.AXLabel === 'Home' && n.AXValue === 1), 'Home after relaunch');
}
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify(
    {
      ...provenance(),
      modes,
      runs,
      fault,
      journey: 'edit',
      startingState: 'open cash editor; preparation separately timed',
      oracle: 'shared Maestro accessibility activation and AXe valid login after native process relaunch',
    },
    null,
    2,
  ),
);
screening: for (let i = 0; i < runs; i++)
  for (const mode of i % 2 ? [...modes].reverse() : modes) {
    const dir = path.join(out, mode + '-' + i);
    fs.mkdirSync(dir, { recursive: true });
    const result = {
      mode,
      run: i,
      journey: 'edit',
      fault,
      modelCalls: 0,
      retries: 0,
      stages: {},
      startedAt: new Date().toISOString(),
    };
    let started;
    try {
      const reset = performance.now();
      let ns = flat(tree());
      if (ns.some((n) => n.AXUniqueId === 'onboarding-login-button')) login();
      const close = flat(tree()).find((n) => n.AXUniqueId === 'close-button');
      if (close) {
        // The development-client gear overlaps the center, but not the right edge.
        batch([`tap -x ${close.frame.x + close.frame.width - 2} -y ${close.frame.y + close.frame.height / 2}`]);
        wait((nodes) => !nodes.some((n) => n.AXUniqueId === 'close-button'), 'editor dismissed');
      }
      await backend('reset', { fault });
      await openCash(dir);
      wait((ns) => ns.some((n) => n.type === 'TextField' && n.AXValue === '100,000.00'), 'initial balance');
      result.resetMs = performance.now() - reset;
      started = performance.now();
      shot(path.join(dir, 'initial.png'));
      result.initialVisual = verifyNoDevRefreshOverlay(path.join(dir, 'initial.png'));
      fs.writeFileSync(path.join(dir, 'initial.json'), JSON.stringify(tree()));
      result.stages.observationMs = performance.now() - started;
      const control = performance.now();
      if (mode === 'maestro') fs.writeFileSync(path.join(dir, 'flow.log'), maestro('ios-edit.yaml', dir));
      else {
        batch(["tap --value '100,000.00' --element-type TextField"]);
        // Native currency formatting changes on focus; keyboard visibility is
        // not a reliable gate when the simulator uses a hardware keyboard.
        wait((ns) => ns.some((n) => n.type === 'TextField' && n.AXValue === '100,000'), 'amount focused');
        batch(['key-combo --modifiers 227 --key 4', 'key 42']);
        wait((ns) => ns.some((n) => n.type === 'TextField' && n.AXValue === ''), 'amount cleared');
        batch(['type 75000']);
        wait((ns) => ns.some((n) => n.type === 'TextField' && n.AXValue === '75,000'), 'entered balance');
        shot(path.join(dir, 'entered.png'));
        const updated = flat(tree()).find((n) => n.AXLabel?.startsWith('Updated: '));
        assert.ok(updated && updated.frame.y > 0 && updated.frame.y < 566, 'visible non-interactive Updated text');
        batch([`tap -x ${updated.frame.x + updated.frame.width / 2} -y ${updated.frame.y + updated.frame.height / 2}`]);
        wait(
          (ns) =>
            ns.some((n) => n.type === 'TextField' && n.AXValue === '75,000.00') &&
            !ns.some((n) => n.AXUniqueId === 'inputView'),
          'amount blurred and keyboard dismissed',
        );
        batch(['tap --id edit-asset-save']);
        wait((ns) => !ns.some((n) => n.AXUniqueId === 'edit-asset-save'), 'editor closed');
      }
      result.stages.controlAndAppWaitMs = performance.now() - control;
      const verification = performance.now();
      await expect
        .poll(async () => (await backend('state')).state.assets.find((a) => a.id === 'demo-cash')?.meta.amount, {
          timeout: 5000,
          intervals: [100, 250],
        })
        .toBe(75000);
      const state = await backend('state');
      fs.writeFileSync(path.join(dir, 'saved-backend.json'), JSON.stringify(state));
      assert.equal(state.writes.length, 1, 'Exactly one fixture write attempt');
      shot(path.join(dir, 'saved.png'));
      fs.writeFileSync(path.join(dir, 'stop.log'), mcp('stop'));
      fs.writeFileSync(path.join(dir, 'launch.log'), mcp('launch-app'));
      fs.writeFileSync(path.join(dir, 'relaunch-hierarchy.json'), run(maestroCli, ['--device', udid, 'hierarchy']));
      const restored = wait(
        (ns) =>
          ns.some((n) => n.AXUniqueId === 'onboarding-login-button') ||
          (ns.some((n) => n.AXUniqueId === 'top-nav-profile') &&
            ns.some((n) => n.AXLabel === 'Home' && n.AXValue === 1)),
        'relaunch authentication state',
      );
      if (flat(restored).some((n) => n.AXUniqueId === 'onboarding-login-button')) login();
      else
        assert.ok(
          flat(restored).some((n) => n.AXLabel === 'Home' && n.AXValue === 1),
          'restored Home',
        );
      await openCash(dir);
      const t = wait(
        (ns) =>
          ns.some((n) => n.type === 'TextField' && n.AXValue === '75,000.00') &&
          ns.some((n) => n.type === 'TextField' && n.AXValue === 'Cash Savings'),
        'persisted value after relaunch',
      );
      fs.writeFileSync(path.join(dir, 'final.json'), JSON.stringify(t));
      shot(path.join(dir, 'final.png'));
      result.finalVisual = verifyNoDevRefreshOverlay(path.join(dir, 'final.png'));
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
    console.log(result);
    if (!started || result.status === 'failed') break screening;
  }
console.log(out);
