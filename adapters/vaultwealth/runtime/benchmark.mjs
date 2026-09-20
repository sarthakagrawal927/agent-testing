import { chromium, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { provenance as sourceProvenance } from './provenance.mjs';
import { verifyLoginControl } from './visual.mjs';
import { journeys, playwrightAction } from './web-workflows.mjs';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'artifacts', `screen-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:18790';
const backend = 'http://127.0.0.1:18791';
const backendFetch = (url, options = {}) =>
  fetch(url, { ...options, headers: { Connection: 'close' }, signal: AbortSignal.timeout(5000) });
const journey = process.argv[2] ?? 'login';
const runs = Number(process.argv[3] ?? 5);
const modes = (process.argv[4] ?? 'playwright,agent-browser-direct,agent-browser-batch').split(',');
const fault = process.argv[5] ?? 'clean';
if (process.env.RECORD_VISUAL === '1')
  throw Error('Baseline recording is forbidden during qualification; use capture-reference.mjs on a clean fixture.');
const browser = await chromium.connectOverCDP('http://127.0.0.1:18792');
const context = browser.contexts()[0];
const page = context.pages()[0];
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(15000);
const results = [];
const provenance = {
  ...sourceProvenance(),
  base,
  backend,
  journey,
  runs,
  modes,
  fault,
  browser: browser.version(),
  viewport: page.viewportSize(),
  playwright: JSON.parse(fs.readFileSync('node_modules/@playwright/test/package.json')).version,
  agentBrowser: JSON.parse(fs.readFileSync(path.join(root, 'tools/node_modules/agent-browser/package.json'))).version,
  sample: 'screening',
  processStartupIncluded: false,
  resetIncluded: false,
  visualOracle: 'Continue ROI pixel comparison',
};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(provenance, null, 2));
const cli = (commands, direct = false) => {
  const result = spawnSync(
    path.join(root, 'tools/node_modules/.bin/agent-browser'),
    ['--cdp', '18792', '--session', 'vault-testing', '--json', ...(direct ? commands[0] : ['batch', '--bail'])],
    {
      input: direct ? undefined : JSON.stringify(commands),
      encoding: 'utf8',
      timeout: 60000,
      env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: '10000' },
    },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  const response = JSON.parse(result.stdout);
  if (response.success === false || response.some?.((r) => r.success === false)) throw new Error(result.stdout);
  return result.stdout;
};
const snapshot = async (name) => {
  const text = await page.locator('body').innerText();
  fs.writeFileSync(path.join(out, `${name}.txt`), text);
  await page.screenshot({ path: path.join(out, `${name}.png`), animations: 'disabled' });
};
try {
  for (let run = 0; run < runs; run++)
    for (const mode of run % 2 ? [...modes].reverse() : modes) {
      const label = `${journey}-${mode}-${run}`;
      const result = {
        journey,
        mode,
        run,
        fault,
        modelCalls: 0,
        retries: 0,
        startedAt: new Date().toISOString(),
        stages: {},
      };
      const resetStart = performance.now();
      await backendFetch(`${backend}/reset`, { method: 'POST', body: JSON.stringify({ fault }) });
      await page.goto(base + '/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      if (journey !== 'login') await page.evaluate(() => sessionStorage.setItem('token', 'mock-login-token-final'));
      result.resetMs = performance.now() - resetStart;
      const started = performance.now();
      try {
        let t = performance.now();
        await page.goto(
          base + (journey === 'login' ? '/login' : journey === 'search' ? '/plan/assets/add' : '/plan?tab=assets'),
        );
        await (
          journey === 'login'
            ? page.getByLabel('Email address')
            : journey === 'search'
              ? page.getByRole('combobox', { name: 'Search' })
              : page.getByText('HSBC', { exact: true }).first()
        ).waitFor();
        result.stages.startAndReadyMs = performance.now() - t;
        if (journey === 'login' && fault === 'clipped')
          await page
            .getByRole('button', { name: 'Continue', exact: true })
            .evaluate((el) => (el.style.clipPath = 'inset(0 60% 0 0)'));
        t = performance.now();
        await snapshot(label + '-initial');
        if (journey === 'login')
          result.visual = await verifyLoginControl(
            page,
            path.join(root, 'artifacts/login-control-reference.png'),
            path.join(out, label + '-visual.png'),
          );
        result.stages.observationMs = performance.now() - t;
        result.stages.controlAndAppWaitMs = 0;
        for (let group = 0; group < journeys[journey].length; group++) {
          t = performance.now();
          const commands = journeys[journey][group];
          if (mode === 'playwright') for (const command of commands) await playwrightAction(page, command);
          else if (mode === 'agent-browser-batch') cli(commands);
          else for (const command of commands) cli([command], mode === 'agent-browser-direct');
          result.stages.controlAndAppWaitMs += performance.now() - t;
          if (journey === 'search') await snapshot(label + `-search-${group}`);
          if (journey === 'login' && group === 0) {
            await expect(
              page.getByText('The email and password combination are invalid', { exact: false }),
            ).toBeVisible();
            await expect(page).toHaveURL(/login/);
            await snapshot(label + '-invalid');
          }
        }
        t = performance.now();
        if (journey === 'edit')
          await expect
            .poll(
              async () => {
                const observed = await (await backendFetch(backend + '/state')).json();
                return observed.state.assets.find((a) => a.name === 'Cash Savings')?.meta.amount;
              },
              { timeout: 5000, intervals: [50, 100, 250] },
            )
            .toBe(75000);
        const state = await (await backendFetch(backend + '/state')).json();
        fs.writeFileSync(path.join(out, label + '-backend.json'), JSON.stringify(state, null, 2));
        if (journey === 'login') {
          await expect(page).toHaveURL(/\/overview$/);
          await expect(page.getByText('Welcome to your Vault Dashboard, Jane.', { exact: true })).toBeVisible();
          const account = await (
            await fetch(backend + '/api/user/v1/account', {
              headers: { Authorization: 'Bearer mock-login-token-final', Connection: 'close' },
            })
          ).json();
          expect(account.id).toBe('mock-user-id');
        } else if (journey === 'edit') {
          expect(state.state.assets.find((a) => a.name === 'Cash Savings')?.meta.amount).toBe(75000);
          expect(state.writes).toHaveLength(1);
          await page.reload();
          await expect(page.getByText('HSBC', { exact: true }).first()).toBeVisible();
          await page.getByText('HSBC', { exact: true }).first().click();
          await page.getByText('Cash Savings', { exact: true }).click();
          await expect(page.getByLabel('Balance', { exact: true })).toHaveValue('75,000.00');
        } else {
          await expect(page.getByRole('option')).toHaveCount(0);
          expect(state.requests.filter((r) => r.path.endsWith('/assets/search')).length).toBeGreaterThanOrEqual(3);
        }
        await snapshot(label + '-final');
        result.stages.verificationMs = performance.now() - t;
        result.status = 'passed';
      } catch (error) {
        result.status = 'failed';
        result.error = String(error);
        const evidence = await backendFetch(backend + '/state')
          .then((r) => r.json())
          .catch((e) => ({ evidenceError: String(e) }));
        fs.writeFileSync(path.join(out, label + '-backend-failure.json'), JSON.stringify(evidence, null, 2));
        await snapshot(label + '-failure').catch(() => {});
      }
      result.totalMs = performance.now() - started;
      results.push(result);
      fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(result) + '\n');
      console.log(JSON.stringify(result));
    }
} finally {
  await browser.close();
}
console.log(`RAW_RESULTS=${out}`);
