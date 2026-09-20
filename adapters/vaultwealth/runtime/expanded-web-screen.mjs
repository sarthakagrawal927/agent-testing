#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(process.argv[2] ?? '');
const runs = Number(process.argv[3] ?? 5);
const modes = (process.argv[4] ?? 'puppeteer,selenium,webdriverio,nightwatch,taiko').split(',');
if (!target || !fs.existsSync(path.join(target, 'package.json'))) {
  throw new Error('Usage: expanded-web-screen.mjs <vaultwealth-worktree> [runs] [comma-separated-modes]');
}

const targetRequire = createRequire(path.join(target, 'package.json'));
const { chromium, expect } = targetRequire('@playwright/test');
const chromePath = chromium.executablePath();
const outputRoot = path.join(runtimeRoot, 'artifacts', `expanded-web-${Date.now()}`);
fs.mkdirSync(outputRoot, { recursive: true });
const base = 'http://127.0.0.1:18790';
const backend = 'http://127.0.0.1:18791';
const context = await chromium.launchPersistentContext(path.join(outputRoot, 'browser-profile'), {
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=18792'],
});
await context.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname;
  return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
});
const browserVersion = context.browser()?.version() ?? 'unknown';
const page = context.pages()[0] ?? (await context.newPage());
page.setDefaultTimeout(10000);

const backendFetch = (pathname, options = {}) =>
  fetch(backend + pathname, { ...options, headers: { Connection: 'close' }, signal: AbortSignal.timeout(5000) });

async function setup(fault) {
  await backendFetch('/reset', { method: 'POST', body: JSON.stringify({ fault }) });
  await page.goto(base + '/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'mock-login-token-final');
  });
  await page.goto(base + '/plan/assets/add');
  await page.getByRole('combobox', { name: 'Search' }).waitFor();
}

async function runDriver(mode, screenshotPath) {
  const executable = mode === 'testcafe' ? path.join(runtimeRoot, 'tools/node_modules/.bin/testcafe') : process.execPath;
  const args =
    mode === 'testcafe'
      ? [
          'chrome:headless',
          path.join(runtimeRoot, 'tools/testcafe-search.js'),
          '--disable-native-automation',
          '--selector-timeout',
          '10000',
          '--assertion-timeout',
          '10000',
          '--page-load-timeout',
          '15000',
          '--reporter',
          'spec',
        ]
      : [path.join(runtimeRoot, 'expanded-web-driver.mjs'), mode];
  const child = spawn(executable, args, {
    cwd: mode === 'testcafe' ? path.join(runtimeRoot, 'tools') : runtimeRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VAULT_CDP_HOST: 'localhost',
      VAULT_CDP_PORT: '18792',
      VAULT_CHROME_PATH: chromePath,
      TAIKO_BROWSER_PATH: chromePath,
      VAULT_DRIVER_SCREENSHOT: screenshotPath,
      NODE_PATH: path.join(runtimeRoot, 'tools/node_modules'),
    },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const code = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve(124);
    }, 60000);
    child.once('exit', (status) => {
      clearTimeout(timeout);
      resolve(status ?? 1);
    });
  });
  return { code, stdout: stdout.slice(-6000), stderr: stderr.slice(-6000) };
}

async function verify(fault, mode, driver) {
  const state = await (await backendFetch('/state')).json();
  const ownBrowserModes = new Set(['selenium', 'webdriverio', 'nightwatch', 'taiko', 'testcafe', 'cypress']);
  const body = ownBrowserModes.has(mode) ? '' : await page.locator('body').innerText();
  const requests = state.requests.filter((request) => request.path.endsWith('/assets/search'));
  const backendCorrect =
    requests.some((request) => request.query === 'VOO' && request.servedQuery === 'VOO') &&
    requests.some((request) => request.query === 'QQQ' && request.servedQuery === 'QQQ') &&
    requests.some((request) => request.query === 'zz-no-match' && request.servedQuery === 'zz-no-match');
  const pageCorrect =
    body.includes('No results') &&
    !body.includes('Vanguard S&P 500 ETF') &&
    !body.includes('Invesco QQQ Trust');
  const driverReportedFinalUi =
    driver.code === 0 &&
    driver.stdout.includes('No results') &&
    !driver.stdout.includes('Vanguard S&P 500 ETF') &&
    !driver.stdout.includes('Invesco QQQ Trust');
  const functional = backendCorrect && (ownBrowserModes.has(mode) ? driverReportedFinalUi : pageCorrect);
  if (fault === 'clean') expect(functional).toBe(true);
  else expect(functional).toBe(false);
  return { functional, requests: requests.map(({ query, servedQuery }) => ({ query, servedQuery })) };
}

const results = [];
try {
  for (const mode of modes) {
    for (let iteration = 0; iteration < runs; iteration++) {
      const result = { mode, iteration, fault: 'clean', startedAt: new Date().toISOString() };
      const totalStarted = performance.now();
      try {
        let phaseStarted = performance.now();
        await setup('clean');
        result.setupMs = performance.now() - phaseStarted;
        phaseStarted = performance.now();
        result.driver = await runDriver(mode, path.join(outputRoot, `${mode}-${iteration}-driver.png`));
        result.workflowMs = performance.now() - phaseStarted;
        phaseStarted = performance.now();
        result.oracle = await verify('clean', mode, result.driver);
        result.verificationMs = performance.now() - phaseStarted;
        result.status = result.driver.code === 0 ? 'passed' : 'failed';
      } catch (error) {
        result.status = 'failed';
        result.error = String(error);
      }
      result.totalMs = performance.now() - totalStarted;
      await page
        .screenshot({ path: path.join(outputRoot, `${mode}-${iteration}-${result.status}.png`), animations: 'disabled' })
        .catch(() => {});
      fs.appendFileSync(path.join(outputRoot, 'results.jsonl'), `${JSON.stringify(result)}\n`);
      console.log(JSON.stringify(result));
      results.push(result);
      if (result.status === 'failed') break;
    }

    const faultResult = { mode, iteration: 0, fault: 'stale-search', startedAt: new Date().toISOString() };
    const totalStarted = performance.now();
    try {
      await setup('stale-search');
      faultResult.driver = await runDriver(mode, path.join(outputRoot, `${mode}-fault-driver.png`));
      faultResult.oracle = await verify('stale-search', mode, faultResult.driver);
      faultResult.status = !faultResult.oracle.functional ? 'detected' : 'missed';
    } catch (error) {
      faultResult.status = 'failed';
      faultResult.error = String(error);
    }
    faultResult.totalMs = performance.now() - totalStarted;
    fs.appendFileSync(path.join(outputRoot, 'results.jsonl'), `${JSON.stringify(faultResult)}\n`);
    console.log(JSON.stringify(faultResult));
    results.push(faultResult);
  }
} finally {
  await context.close();
}

fs.writeFileSync(
  path.join(outputRoot, 'manifest.json'),
  JSON.stringify(
    {
      targetCommit: execFileSync('git', ['-C', target, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      target,
      base,
      backend,
      browser: browserVersion,
      runs,
      modes,
      sample: 'expanded-screening',
      processStartupIncluded: false,
      resetIncluded: false,
      oracle: 'separate Playwright DOM and fixture-backend verification',
    },
    null,
    2,
  ),
);
fs.writeFileSync(path.join(outputRoot, 'summary.json'), JSON.stringify({ runs, modes, results }, null, 2));
console.log(`RAW_RESULTS=${outputRoot}`);
