import { chromium, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { provenance as sourceProvenance } from './provenance.mjs';
import { verifyLoginControl } from './visual.mjs';
import { journeys } from './web-workflows.mjs';

const root = path.dirname(new URL(import.meta.url).pathname);
const cliPath = path.join(root, 'tools/node_modules/.bin/playwright-cli');
const out = path.join(root, 'artifacts', `playwright-cli-${Date.now()}`);
const base = 'http://127.0.0.1:18790';
const backend = 'http://127.0.0.1:18791';
const journey = process.argv[2] ?? 'login';
const runs = Number(process.argv[3] ?? 5);
const modes = (process.argv[4] ?? 'direct,batch').split(',');
const fault = process.argv[5] ?? 'clean';
const session = `vault-cli-${process.pid}`;
const backendFetch = (url, options = {}) =>
  fetch(url, { ...options, headers: { Connection: 'close' }, signal: AbortSignal.timeout(5000) });

if (!journeys[journey]) throw Error(`Unknown journey: ${journey}`);
if (modes.some((mode) => !['direct', 'batch'].includes(mode))) throw Error('Modes must be direct or batch');
if (process.env.RECORD_VISUAL === '1') throw Error('Qualification cannot record a visual baseline');
fs.mkdirSync(out, { recursive: true });

function runCli(args, { raw = true, timeout = 60_000 } = {}) {
  const result = spawnSync(cliPath, [...(raw ? ['--raw'] : []), `-s=${session}`, ...args], {
    encoding: 'utf8',
    timeout,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  return result.stdout;
}

function targetFor(command) {
  const [verb, a, b, c, , e, f] = command;
  if (verb === 'fill' || verb === 'click') return `locator(${JSON.stringify(a)})`;
  if (verb !== 'find') throw Error(`No target for ${verb}`);
  if (a === 'label') return `getByLabel(${JSON.stringify(b)}, { exact: true })`;
  if (a === 'text') return `getByText(${JSON.stringify(b)}, { exact: true })`;
  const name = c === 'fill' ? f : e;
  return `getByRole(${JSON.stringify(b)}, { name: ${JSON.stringify(name)}, exact: true })`;
}

function commandArgs(command) {
  const [verb, a, b, c, d] = command;
  if (verb === 'fill') return ['fill', targetFor(command), b];
  if (verb === 'click') return ['click', targetFor(command)];
  if (verb === 'find') return c === 'fill' ? ['fill', targetFor(command), d] : ['click', targetFor(command)];
  if (verb === 'wait') {
    const statement =
      a === '--url'
        ? `await page.waitForURL(${JSON.stringify(b)});`
        : a === '--fn'
          ? `await page.waitForFunction(${JSON.stringify(b)});`
          : a === '--text'
            ? `await page.getByText(${JSON.stringify(b)}, { exact: false }).first().waitFor();`
            : `await page.locator(${JSON.stringify(a)}).waitFor();`;
    return ['run-code', `async (page) => { ${statement} }`];
  }
  throw Error(`Unsupported command: ${verb}`);
}

function commandStatement(command) {
  const [verb, a, b, c, d] = command;
  if (verb === 'fill') return `await page.${targetFor(command)}.fill(${JSON.stringify(b)});`;
  if (verb === 'click') return `await page.${targetFor(command)}.click();`;
  if (verb === 'find')
    return c === 'fill'
      ? `await page.${targetFor(command)}.fill(${JSON.stringify(d)});`
      : `await page.${targetFor(command)}.click();`;
  if (verb === 'wait') {
    if (a === '--url') return `await page.waitForURL(${JSON.stringify(b)});`;
    if (a === '--fn') return `await page.waitForFunction(${JSON.stringify(b)});`;
    if (a === '--text') return `await page.getByText(${JSON.stringify(b)}, { exact: false }).first().waitFor();`;
    return `await page.locator(${JSON.stringify(a)}).waitFor();`;
  }
  throw Error(`Unsupported command: ${verb}`);
}

const browser = await chromium.connectOverCDP('http://127.0.0.1:18792');
const context = browser.contexts()[0];
const page = context.pages()[0];
page.setDefaultTimeout(10_000);
page.setDefaultNavigationTimeout(15_000);
const results = [];

fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify(
    {
      ...sourceProvenance(),
      base,
      backend,
      journey,
      runs,
      modes,
      fault,
      browser: browser.version(),
      viewport: page.viewportSize(),
      playwrightCli: JSON.parse(
        fs.readFileSync(path.join(root, 'tools/node_modules/@playwright/cli/package.json'), 'utf8'),
      ).version,
      sample: 'round-2-screening',
      processStartupIncluded: false,
      resetIncluded: false,
      outputMode: 'raw',
      visualOracle: 'Continue ROI pixel comparison',
    },
    null,
    2,
  ),
);

const snapshot = async (name) => {
  fs.writeFileSync(path.join(out, `${name}.txt`), await page.locator('body').innerText());
  await page.screenshot({ path: path.join(out, `${name}.png`), animations: 'disabled' });
};

try {
  runCli(['attach', '--cdp', 'http://127.0.0.1:18792', '--idle-timeout=0'], { raw: false });
  for (let run = 0; run < runs; run++) {
    for (const mode of run % 2 ? [...modes].reverse() : modes) {
      const label = `${journey}-${mode}-${run}`;
      const result = {
        journey,
        mode: `playwright-cli-${mode}`,
        run,
        fault,
        modelCalls: 0,
        retries: 0,
        startedAt: new Date().toISOString(),
        stages: {},
      };
      const resetStart = performance.now();
      await backendFetch(`${backend}/reset`, { method: 'POST', body: JSON.stringify({ fault }) });
      await page.goto(`${base}/login`);
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      if (journey !== 'login') await page.evaluate(() => sessionStorage.setItem('token', 'mock-login-token-final'));
      result.resetMs = performance.now() - resetStart;
      const started = performance.now();
      try {
        let stageStart = performance.now();
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
        result.stages.startAndReadyMs = performance.now() - stageStart;
        if (journey === 'login' && fault === 'clipped')
          await page
            .getByRole('button', { name: 'Continue', exact: true })
            .evaluate((element) => (element.style.clipPath = 'inset(0 60% 0 0)'));
        stageStart = performance.now();
        await snapshot(`${label}-initial`);
        if (journey === 'login')
          result.visual = await verifyLoginControl(
            page,
            path.join(root, 'artifacts/login-control-reference.png'),
            path.join(out, `${label}-visual.png`),
          );
        result.stages.observationMs = performance.now() - stageStart;
        result.stages.controlAndAppWaitMs = 0;
        for (let group = 0; group < journeys[journey].length; group++) {
          stageStart = performance.now();
          if (mode === 'batch') {
            const code = `async (page) => { ${journeys[journey][group].map(commandStatement).join('\n')} }`;
            runCli(['run-code', code]);
          } else {
            for (const command of journeys[journey][group]) runCli(commandArgs(command));
          }
          result.stages.controlAndAppWaitMs += performance.now() - stageStart;
          if (journey === 'search') await snapshot(`${label}-search-${group}`);
          if (journey === 'login' && group === 0) {
            await expect(
              page.getByText('The email and password combination are invalid', { exact: false }),
            ).toBeVisible();
            await expect(page).toHaveURL(/login/);
            await snapshot(`${label}-invalid`);
          }
        }
        stageStart = performance.now();
        const state = await (await backendFetch(`${backend}/state`)).json();
        fs.writeFileSync(path.join(out, `${label}-backend.json`), JSON.stringify(state, null, 2));
        if (journey === 'login') {
          await expect(page).toHaveURL(/\/overview$/);
          await expect(page.getByText('Welcome to your Vault Dashboard, Jane.', { exact: true })).toBeVisible();
        } else if (journey === 'edit') {
          expect(state.state.assets.find((asset) => asset.name === 'Cash Savings')?.meta.amount).toBe(75000);
          expect(state.writes).toHaveLength(1);
          await page.reload();
          await page.getByText('HSBC', { exact: true }).first().click();
          await page.getByText('Cash Savings', { exact: true }).click();
          await expect(page.getByLabel('Balance', { exact: true })).toHaveValue('75,000.00');
        } else {
          await expect(page.getByRole('option')).toHaveCount(0);
          expect(
            state.requests.filter((request) => request.path.endsWith('/assets/search')).length,
          ).toBeGreaterThanOrEqual(3);
        }
        await snapshot(`${label}-final`);
        result.stages.verificationMs = performance.now() - stageStart;
        result.status = 'passed';
      } catch (error) {
        result.status = 'failed';
        result.error = String(error);
        await snapshot(`${label}-failure`).catch(() => {});
      }
      result.totalMs = performance.now() - started;
      results.push(result);
      fs.appendFileSync(path.join(out, 'results.jsonl'), `${JSON.stringify(result)}\n`);
      console.log(JSON.stringify(result));
    }
  }
} finally {
  try {
    runCli(['detach']);
  } catch {}
  await browser.close();
}

console.log(`RAW_RESULTS=${out}`);
