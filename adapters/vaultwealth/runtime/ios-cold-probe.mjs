// Diagnostic only: app-process cold accessibility readiness, not a journey benchmark.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { maestroCli, simulatorUdid, xcodebuildMcpCli } from './tool-paths.mjs';
const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'artifacts', `ios-cold-probe-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const udid = simulatorUdid();
const run = (bin, args) => {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: 45000,
    maxBuffer: 8e6,
    env: process.env,
  });
  if (r.status !== 0) throw Error(r.stderr + ' ' + r.error);
  return r.stdout;
};
const mcp = (cmd) =>
  run(xcodebuildMcpCli, ['simulator', cmd, '--simulator-id', udid, '--bundle-id', 'com.vaultwealth.app-development']);
const axe = (cmd, args = []) => run(path.join(root, 'tools/axe/axe'), [cmd, '--udid', udid, ...args]);
const flat = (xs) => xs.flatMap((n) => [n, ...flat(n.children ?? [])]);
for (let i = 0; i < 3; i++) {
  const dir = path.join(out, String(i));
  fs.mkdirSync(dir);
  await fetch('http://127.0.0.1:18791/reset', { method: 'POST', body: JSON.stringify({ fault: 'clean' }) });
  fs.writeFileSync(path.join(dir, 'stop.log'), mcp('stop'));
  const started = performance.now();
  fs.writeFileSync(path.join(dir, 'launch.log'), mcp('launch-app'));
  const launchMs = performance.now() - started;
  const deadline = performance.now() + 10000;
  let nodes = [],
    polls = 0;
  do {
    nodes = JSON.parse(axe('describe-ui'));
    polls++;
    if (flat(nodes).some((n) => n.AXUniqueId === 'onboarding-login-button')) break;
  } while (performance.now() < deadline);
  const axeReady = flat(nodes).some((n) => n.AXUniqueId === 'onboarding-login-button');
  const axeReadyMs = performance.now() - started;
  fs.writeFileSync(path.join(dir, 'before-maestro.json'), JSON.stringify(nodes));
  axe('screenshot', ['--output', path.join(dir, 'before-maestro.png')]);
  const t = performance.now();
  fs.writeFileSync(path.join(dir, 'maestro-hierarchy.json'), run(maestroCli, ['--device', udid, 'hierarchy']));
  const maestroObservationMs = performance.now() - t;
  const after = JSON.parse(axe('describe-ui'));
  fs.writeFileSync(path.join(dir, 'after-maestro.json'), JSON.stringify(after));
  const row = {
    run: i,
    launchMs,
    axeReady,
    axeReadyMs,
    polls,
    maestroObservationMs,
    axeReadyAfterMaestro: flat(after).some((n) => n.AXUniqueId === 'onboarding-login-button'),
  };
  fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(row) + '\n');
  console.log(row);
}
console.log(out);
