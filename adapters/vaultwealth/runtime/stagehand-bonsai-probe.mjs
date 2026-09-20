import fs from 'node:fs';
import path from 'node:path';
import { optionalChromiumExecutable } from './tool-paths.mjs';
import { Stagehand } from './tools/node_modules/@browserbasehq/stagehand/dist/esm/index.js';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'artifacts', `stagehand-bonsai-${Date.now()}`);
const base = 'http://127.0.0.1:18790';
const backend = 'http://127.0.0.1:18791';
const backendFetch = (url, options = {}) =>
  fetch(url, { ...options, headers: { Connection: 'close' }, signal: AbortSignal.timeout(5000) });

fs.mkdirSync(out, { recursive: true });
await backendFetch(`${backend}/reset`, { method: 'POST', body: JSON.stringify({ fault: 'clean' }) });
const stagehand = new Stagehand({
  env: 'LOCAL',
  disableAPI: true,
  model: {
    // The local llama.cpp endpoint accepts the model field but serves only the
    // pinned Bonsai alias. The legacy OpenAI path uses chat/completions rather
    // than the newer Responses API, which this local runtime does not expose.
    modelName: 'gpt-4o-mini',
    apiKey: 'local-only',
    baseURL: 'http://127.0.0.1:18794/v1',
  },
  localBrowserLaunchOptions: {
    headless: true,
    ...optionalChromiumExecutable(),
    viewport: { width: 1440, height: 900 },
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--no-first-run',
    ],
  },
  actTimeoutMs: 30_000,
  domSettleTimeout: 10_000,
  verbose: 0,
  disablePino: true,
  serverCache: false,
  selfHeal: false,
});

let result;
try {
  const initStarted = performance.now();
  await stagehand.init();
  const initMs = performance.now() - initStarted;
  await stagehand.context.addInitScript(() => {
    if (location.origin === 'http://127.0.0.1:18790') sessionStorage.setItem('token', 'mock-login-token-final');
  });
  const page = stagehand.context.pages()[0];
  const setupStarted = performance.now();
  await page.goto(`${base}/plan/assets/add`, { waitUntil: 'domcontentloaded', timeoutMs: 15_000 });
  await page.waitForSelector('input[role="combobox"]', { timeout: 10_000 });
  const setupMs = performance.now() - setupStarted;
  const actionStarted = performance.now();
  const action = await stagehand.act('Type VOO into the Search assets combobox. Do not select a result.', {
    timeout: 30_000,
    page,
    serverCache: false,
  });
  const actionMs = performance.now() - actionStarted;
  const readyStarted = performance.now();
  let body = '';
  while (performance.now() - readyStarted < 5000) {
    body = await page.evaluate(() => document.body.innerText);
    if (body.includes('Vanguard S&P 500 ETF')) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const state = await (await backendFetch(`${backend}/state`)).json();
  const requests = state.requests.filter((request) => request.path.endsWith('/assets/search'));
  const passed =
    action.success && body.includes('Vanguard S&P 500 ETF') && requests.some((request) => request.query === 'VOO');
  await page.screenshot({ path: path.join(out, 'final.png'), animations: 'disabled' });
  fs.writeFileSync(path.join(out, 'body.txt'), body);
  fs.writeFileSync(path.join(out, 'backend.json'), JSON.stringify(state, null, 2));
  result = {
    status: passed ? 'passed' : 'failed',
    stagehand: '3.4.0',
    model: 'local Bonsai 2 27B PTQ1_0, explicit no-thinking',
    initMs,
    setupMs,
    actionMs,
    readinessMs: performance.now() - readyStarted,
    action,
    backendSearchRequests: requests.length,
    passed,
    paidApiSpendUsd: 0,
    scope: 'Compatibility gate: one natural-language input action plus fixed UI/backend oracle.',
  };
} catch (error) {
  result = { status: 'failed', error: String(error), paidApiSpendUsd: 0 };
} finally {
  await stagehand.close({ force: true }).catch(() => {});
}
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
console.log(out);
process.exitCode = result.status === 'passed' ? 0 : 1;
