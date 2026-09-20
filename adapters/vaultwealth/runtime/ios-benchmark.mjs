import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { verifyNativeControl } from './ios-visual.mjs';
import { provenance } from './provenance.mjs';
import { maestroCli, simulatorUdid } from './tool-paths.mjs';
const root = path.dirname(new URL(import.meta.url).pathname);
const udid = simulatorUdid();
const out = path.join(root, 'artifacts', `ios-screen-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const modes = (process.argv[2] ?? 'maestro,axe-batch').split(',');
const runs = Number(process.argv[3] ?? 5);
const fault = process.argv[4] ?? 'clean';
const run = (bin, args, timeout = 120000) => {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout,
    env: process.env,
  });
  if (r.status !== 0) throw Error(r.stdout + '\n' + r.stderr + '\n' + (r.error ?? ''));
  return r.stdout;
};
const axe = (cmd, args = []) => run(path.join(root, 'tools/axe/axe'), [cmd, '--udid', udid, ...args], 30000);
let tapStyle = 'physical';
const batch = (steps) =>
  axe('batch', [
    '--ax-cache',
    'perStep',
    '--tap-style',
    tapStyle,
    '--wait-timeout',
    '10',
    ...steps.flatMap((s) => ['--step', s]),
  ]);
const tree = () => JSON.parse(axe('describe-ui'));
const flat = (x) => x.flatMap((n) => [n, ...flat(n.children ?? [])]);
function wait(predicate, label, timeout = 10000) {
  const end = performance.now() + timeout;
  do {
    const t = tree();
    if (predicate(flat(t))) return t;
  } while (performance.now() < end);
  throw Error('Readiness timeout: ' + label);
}
const visible = (n) => n.frame?.x >= 0 && n.frame?.x < 402 && n.frame?.y >= 0 && n.frame?.y < 874;
function fastReset() {
  let nodes = flat(tree());
  const close = nodes.find((n) => n.AXUniqueId === 'close-button');
  if (close) {
    batch([`tap -x ${close.frame.x + close.frame.width - 2} -y ${close.frame.y + close.frame.height / 2}`]);
    wait((ns) => !ns.some((n) => n.AXUniqueId === 'close-button'), 'previous sheet dismissed');
    nodes = flat(tree());
  }
  if (nodes.some((n) => n.AXUniqueId === 'onboarding-login-button')) batch(['tap --id onboarding-login-button']);
  else if (!nodes.some((n) => n.AXUniqueId === 'login-email-input')) {
    if (!nodes.some((n) => n.AXLabel === 'Log out')) {
      batch(['tap --id top-nav-profile']);
      wait((ns) => ns.some((n) => n.AXLabel === 'Jane Smith' && visible(n)), 'profile reset');
    }
    for (let scroll = 0; scroll < 8; scroll++) {
      nodes = flat(tree());
      if (nodes.some((n) => n.AXLabel === 'Log out' && visible(n) && n.frame.y + n.frame.height < 874)) break;
      axe('gesture', [
        'scroll-up',
        '--screen-width',
        '402',
        '--screen-height',
        '874',
        '--pre-delay',
        '0',
        '--post-delay',
        '0',
      ]);
    }
    wait((ns) => ns.some((n) => n.AXLabel === 'Log out' && visible(n)), 'logout reset');
    let previousY;
    let stable = 0;
    wait(
      (ns) => {
        const y = ns.find((n) => n.AXLabel === 'Log out' && visible(n))?.frame.y;
        stable = y !== undefined && previousY !== undefined && Math.abs(y - previousY) < 1 ? stable + 1 : 0;
        previousY = y;
        return stable >= 3;
      },
      'logout scroll settled',
      5000,
    );
    batch(["tap --label 'Log out' --element-type Button"]);
  }
  wait(
    (ns) => ns.filter((n) => n.AXUniqueId === 'login-email-input' && n.type === 'TextField').length === 1,
    'unique email reset',
  );
  batch(['tap --id login-email-input --element-type TextField', 'key-combo --modifiers 227 --key 4', 'key 42']);
  wait(
    (ns) => ns.some((n) => n.AXUniqueId === 'login-email-input' && n.AXValue === 'Enter your email address'),
    'empty email reset',
  );
}
const shot = (file) => axe('screenshot', ['--output', file]);
const maestro = (file, evidence) =>
  run(maestroCli, [
    '--device',
    udid,
    'test',
    '-e',
    `EVIDENCE=${evidence}`,
    '--test-output-dir',
    evidence,
    path.join(root, file),
  ]);
const backend = (endpoint, body) =>
  fetch('http://127.0.0.1:18791/' + endpoint, {
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    headers: { Connection: 'close', Authorization: 'Bearer mock-login-token-final' },
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json());
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify(
    {
      ...provenance(),
      udid,
      axe: '1.8.0',
      maestro: '2.6.1',
      runtime: 'iOS26.5',
      device: 'iPhone16Pro',
      mode: 'warm app; Maestro CLI/driver startup included',
      journey: 'login',
      runs,
      modes,
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
      journey: 'login',
      fault,
      modelCalls: 0,
      retries: 0,
      stages: {},
      startedAt: new Date().toISOString(),
    };
    let started;
    try {
      const resetStart = performance.now();
      tapStyle = 'physical';
      await backend('reset', { fault });
      const t = flat(tree());
      if (process.env.FAST_RESET === '1') fastReset();
      else if (!t.some((n) => n.AXUniqueId === 'login-email-input'))
        fs.writeFileSync(path.join(dir, 'reset.log'), maestro('ios-reset.yaml', path.join(dir, 'reset')));
      wait((ns) => ns.some((n) => n.AXUniqueId === 'login-email-input'), 'email');
      result.resetMs = performance.now() - resetStart;
      started = performance.now();
      shot(path.join(dir, 'initial.png'));
      fs.writeFileSync(path.join(dir, 'initial.json'), JSON.stringify(tree()));
      result.visual = verifyNativeControl(
        path.join(dir, 'initial.png'),
        JSON.parse(fs.readFileSync(path.join(dir, 'initial.json'))),
        path.join(root, 'artifacts/ios-screen-1789841845936/maestro-0'),
      );
      result.stages.observationMs = performance.now() - started;
      let t0 = performance.now();
      tapStyle = mode === 'axe-physical' ? 'physical' : 'automatic';
      if (mode === 'maestro') fs.writeFileSync(path.join(dir, 'flow.log'), maestro('ios-login.yaml', dir));
      else {
        batch([
          'tap --id login-email-input --element-type TextField',
          'type user@example.com',
          'tap --id login-email-continue',
          'tap --id login-password-input --element-type TextField',
          'type WrongPassword1!',
          'tap --id login-password-continue',
        ]);
        wait(
          (ns) => ns.some((n) => n.AXLabel?.includes('email and password combination are invalid')),
          'invalid rejected',
        );
        shot(path.join(dir, 'invalid.png'));
        batch([
          'tap --id login-email-continue',
          'tap --id login-password-input --element-type TextField',
          'type SecurePass1!',
          'tap --id login-password-continue',
          'tap --id otp-input-0',
          'type 123456',
          'tap --id login-otp-continue',
          'tap --id login-biometrics-skip',
        ]);
        wait((ns) => ns.some((n) => n.AXUniqueId === 'top-nav-profile' && visible(n)), 'Home');
      }
      result.stages.controlAndAppWaitMs = performance.now() - t0;
      tapStyle = 'physical';
      t0 = performance.now();
      const home = wait((ns) => ns.some((n) => n.AXLabel === 'Home' && n.AXValue === 1 && visible(n)), 'Home selected');
      fs.writeFileSync(path.join(dir, 'home.json'), JSON.stringify(home));
      batch(['tap --id top-nav-profile']);
      const account = wait((ns) => ns.some((n) => n.AXLabel === 'Jane Smith' && visible(n)), 'Jane Smith');
      fs.writeFileSync(path.join(dir, 'account.json'), JSON.stringify(account));
      const state = await backend('state');
      fs.writeFileSync(path.join(dir, 'backend.json'), JSON.stringify(state));
      assert(
        state.requests.some((r) => r.path.endsWith('/auth/login') && r.status === 400),
        'Backend must confirm invalid credentials rejected',
      );
      assert.equal((await backend('api/user/v1/account')).id, 'mock-user-id');
      shot(path.join(dir, 'final.png'));
      result.stages.verificationMs = performance.now() - t0;
      result.status = 'passed';
    } catch (e) {
      result.status = 'failed';
      result.error = String(e);
      try {
        shot(path.join(dir, 'failure.png'));
        fs.writeFileSync(path.join(dir, 'failure.json'), JSON.stringify(tree()));
      } catch {}
    }
    result.totalMs = started ? performance.now() - started : null;
    fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(result) + '\n');
    console.log(JSON.stringify(result));
    if (!started || result.status === 'failed') {
      console.log('Stopped screening after failed calibration; no automatic repair/retry.');
      break screening;
    }
  }
console.log(out);
