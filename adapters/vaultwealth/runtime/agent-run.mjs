import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { provenance } from './provenance.mjs';
import { qualifyAgent } from './qualify-agent.mjs';
import { fleetSkillRun } from './tool-paths.mjs';

const root = path.dirname(new URL(import.meta.url).pathname);
const agentWorktree = process.env.VAULT_AGENT_WORKTREE ?? path.resolve(root, '../../../webapp-testing-agent');
const mode = process.argv[2] ?? 'stepwise';
if (!['stepwise', 'batched'].includes(mode)) throw Error('Choose stepwise or batched');
const fault = process.argv[3] ?? 'clean';
const out = path.join(root, 'artifacts', `agent-${mode}-${Date.now()}`);
const session = 'vault-testing-' + path.basename(out);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(provenance(), null, 2));
fs.mkdirSync('/tmp/vault-testing-agent-sockets', { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:18792');
const page = browser.contexts()[0].pages()[0];
await fetch('http://127.0.0.1:18791/reset', {
  method: 'POST',
  body: JSON.stringify({ fault }),
  headers: { Connection: 'close' },
});
await page.goto('http://127.0.0.1:18790/login');
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload();
await page.getByLabel('Email address', { exact: true }).waitFor();
if (fault === 'clipped')
  await page
    .getByRole('button', { name: 'Continue', exact: true })
    .evaluate((el) => (el.style.clipPath = 'inset(0 60% 0 0)'));
const cli = path.join(root, 'tools/node_modules/.bin/agent-browser');
const policy =
  mode === 'stepwise'
    ? 'STEPWISE: after every UI action, run snapshot -i and inspect its result before choosing your next UI action. Exactly one UI action per tool invocation. Do not batch or chain UI actions.'
    : 'BATCHED: observe initially, then submit predictable sequences using batch --bail with intermediate bounded waits. Observe again at a stage boundary or unexpected state. Do not reason after every predictable action.';
const prompt = `GOAL: Test Vaultwealth login through the UI. Use user@example.com, first reject WrongPassword1!, then log in with SecurePass1! and OTP 123456. Verify the correct account (Jane) and Home destination. Report any functional or visual defects.
SCOPE: ONLY interact with the existing isolated browser using ${cli} --cdp 18792 --session ${session}. The only permitted website is http://127.0.0.1:18790. No code reading or edits, no git operations, no backend calls, no secrets/auth stores, no installs. Do not read experiment/controller sources or other agents' results. Screenshots may be saved under ${out}.
STRATEGY: ${policy}
VERIFY: inspect an initial screenshot for obscured/clipped controls, verify invalid credentials are rejected, and verify the successful account/destination from the UI. You MUST open each checkpoint screenshot with an image viewing tool; saving a PNG or listing its path is not visual inspection. If image viewing is unavailable, report that limitation and do not claim a visual pass. Use normal UI input, never inject auth or invoke application functions. No arbitrary sleeps. At most one recovery attempt after an unexpected state; stop if it does not recover. Include and view a final screenshot.
RETURN: concise observed result, evidence paths, defects, and recovery count. Do not claim a pass merely because clicks completed. The parent will independently verify. Start immediately with the existing browser; do not explore the repository.`;
const started = performance.now();
const child = spawn(
  fleetSkillRun,
  [
    'exec',
    '--skill',
    'call-codex',
    '--project',
    'vaultwealth-testing-experiment',
    '--output-file',
    path.join(out, 'answer.txt'),
    '--',
    'codex',
    'exec',
    '-s',
    'workspace-write',
    '--add-dir',
    out,
    '--add-dir',
    '/tmp/vault-testing-agent-sockets',
    '-C',
    agentWorktree,
    '--ephemeral',
    '-m',
    'gpt-6-astra',
    '-c',
    'model_reasoning_effort=medium',
    '-c',
    'sandbox_workspace_write.network_access=true',
    '--output-schema',
    path.join(root, 'agent-result.schema.json'),
    '--json',
    '-o',
    path.join(out, 'answer.txt'),
    prompt,
  ],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: {
      ...process.env,
      AGENT_BROWSER_SOCKET_DIR: '/tmp/vault-testing-agent-sockets',
      AGENT_BROWSER_DEFAULT_TIMEOUT: '10000',
    },
  },
);
let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {}
}, 300000);
const events = fs.createWriteStream(path.join(out, 'events.jsonl'));
const timedEvents = fs.createWriteStream(path.join(out, 'timed-events.jsonl'));
const commandStarts = new Map();
let observedShellTimeMs = 0;
let pending = '';
const stderr = fs.createWriteStream(path.join(out, 'stderr.log'));
let raw = '';
child.stdout.on('data', (chunk) => {
  raw += chunk;
  events.write(chunk);
  pending += chunk;
  let newline;
  while ((newline = pending.indexOf('\n')) >= 0) {
    const line = pending.slice(0, newline);
    pending = pending.slice(newline + 1);
    try {
      const event = JSON.parse(line),
        receivedMs = performance.now() - started;
      timedEvents.write(JSON.stringify({ receivedMs, event }) + '\n');
      if (event.item?.type === 'command_execution') {
        if (event.type === 'item.started') commandStarts.set(event.item.id, receivedMs);
        if (event.type === 'item.completed' && commandStarts.has(event.item.id))
          observedShellTimeMs += receivedMs - commandStarts.get(event.item.id);
      }
    } catch {}
  }
});
child.stderr.pipe(stderr);
const exit = await new Promise((resolve) => child.on('exit', resolve));
clearTimeout(timer);
events.end();
timedEvents.end();
stderr.end();
const rows = raw.split('\n').flatMap((line) => {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
});
const result = {
  mode,
  fault,
  exit,
  timedOut,
  agentMs: performance.now() - started,
  observedShellTimeMs,
  outsideShellTimeMs: performance.now() - started - observedShellTimeMs,
  model: 'gpt-6-astra',
  reasoning: 'medium',
  usage: rows.filter((r) => r.type === 'turn.completed').map((r) => r.usage),
  modelCalls: null,
  toolInvocations: null,
  reportedCommandEvents: rows.filter((r) => r.type === 'item.completed' && r.item?.type === 'command_execution').length,
  apiSpend: null,
  subscriptionUsage: 'See usage; billing not exposed',
};
const verification = performance.now();
try {
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByText('Welcome to your Vault Dashboard, Jane.', { exact: true })).toBeVisible();
  result.functional = 'passed';
} catch (e) {
  result.functional = 'failed';
  result.verificationError = String(e);
}
await page.screenshot({ path: path.join(out, 'independent-final.png'), animations: 'disabled' });
const state = await (await fetch('http://127.0.0.1:18791/state', { headers: { Connection: 'close' } })).json();
fs.writeFileSync(path.join(out, 'backend.json'), JSON.stringify(state, null, 2));
result.invalidRejected = state.requests.some((r) => r.path.endsWith('/auth/login') && r.status === 400);
try {
  result.agentAnswer = JSON.parse(fs.readFileSync(path.join(out, 'answer.txt'), 'utf8'));
} catch {
  result.agentAnswer = null;
}
result.visualVerdictMatches =
  fault === 'clipped'
    ? Boolean(result.agentAnswer?.visualDefects?.some((d) => /continue|clip|obscur/i.test(d)))
    : result.agentAnswer?.visualDefects?.length === 0;
result.qualified =
  exit === 0 &&
  !timedOut &&
  result.functional === 'passed' &&
  result.invalidRejected &&
  result.agentAnswer?.accountAndDestinationVerified === true &&
  result.agentAnswer?.invalidCredentialsRejected === true &&
  result.visualVerdictMatches &&
  result.agentAnswer?.screenshotsInspected?.length >= 2 &&
  result.agentAnswer?.recoveryCount <= 1;
result.qualified = result.qualified && (fault !== 'clean' || result.agentAnswer?.status === 'passed');
result.commandFailures = rows.filter(
  (r) => r.type === 'item.completed' && r.item?.type === 'command_execution' && r.item.exit_code !== 0,
).length;
result.qualified = qualifyAgent(result, result.agentAnswer, result.commandFailures);
// A final Home screen is partial evidence, never a whole-task pass by itself.
result.status = result.qualified ? 'passed' : 'failed';
result.verificationMs = performance.now() - verification;
result.totalMs = performance.now() - started;
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, out }));
await browser.close();
