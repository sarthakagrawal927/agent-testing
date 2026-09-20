import fs from 'node:fs';
import path from 'node:path';
import { optionalChromiumExecutable } from './tool-paths.mjs';
import { Stagehand } from './tools/node_modules/@browserbasehq/stagehand/dist/esm/index.js';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'artifacts', `stagehand-search-${Date.now()}`);
const base = 'http://127.0.0.1:18790';
const backend = 'http://127.0.0.1:18791';
const fault = process.argv[2] ?? 'clean';
const runs = Number(process.argv[3] ?? 5);
const useCache = process.env.STAGEHAND_CACHE === '1';
const backendFetch = (url, options = {}) =>
  fetch(url, { ...options, headers: { Connection: 'close' }, signal: AbortSignal.timeout(5000) });
if (!['clean', 'stale-search'].includes(fault)) throw Error('Supported faults: clean, stale-search');
fs.mkdirSync(out, { recursive: true });

const stagehand = new Stagehand({
  env: 'LOCAL',
  disableAPI: true,
  model: {
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
  ...(useCache ? { cacheDir: path.join(out, 'cache') } : {}),
});

const initStarted = performance.now();
await stagehand.init();
const initMs = performance.now() - initStarted;
const page = stagehand.context.pages()[0];
const results = [];
const metricKeys = [
  'actPromptTokens',
  'actCompletionTokens',
  'actReasoningTokens',
  'actCachedInputTokens',
  'actInferenceTimeMs',
  'totalPromptTokens',
  'totalCompletionTokens',
  'totalReasoningTokens',
  'totalCachedInputTokens',
  'totalInferenceTimeMs',
];
const metricDelta = (before, after) =>
  Object.fromEntries(metricKeys.map((key) => [key, (after[key] ?? 0) - (before[key] ?? 0)]));

async function waitForText(text, timeoutMs = 5000) {
  const started = performance.now();
  let body = '';
  while (performance.now() - started < timeoutMs) {
    body = await page.evaluate(() => document.body.innerText);
    if (body.includes(text)) return { body, elapsedMs: performance.now() - started, found: true };
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return { body, elapsedMs: performance.now() - started, found: false };
}

try {
  for (let run = 0; run < runs; run++) {
    const result = { run, fault, modelCalls: 0, cacheHits: 0, actions: [], status: 'failed' };
    const resetStarted = performance.now();
    await backendFetch(`${backend}/reset`, { method: 'POST', body: JSON.stringify({ fault }) });
    await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeoutMs: 15_000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('token', 'mock-login-token-final');
    });
    result.resetMs = performance.now() - resetStarted;
    const started = performance.now();
    const beforeMetrics = await stagehand.metrics;
    try {
      await page.goto(`${base}/plan/assets/add`, { waitUntil: 'domcontentloaded', timeoutMs: 15_000 });
      await page.waitForSelector('input[role="combobox"]', { timeout: 10_000 });
      const stages = [
        ['VOO', 'Vanguard S&P 500 ETF'],
        ['QQQ', 'Invesco QQQ Trust'],
        ['zz-no-match', 'No results'],
      ];
      for (const [query, expected] of stages) {
        const actionStarted = performance.now();
        const action = await stagehand.act(
          `Replace the value in the Search assets combobox with ${query}. Do not select a result.`,
          { timeout: 30_000, page, serverCache: false },
        );
        const history = await stagehand.history;
        const cacheHit = history.at(-1)?.parameters?.cacheHit === true;
        if (cacheHit) result.cacheHits++;
        else result.modelCalls++;
        const readiness = await waitForText(expected);
        result.actions.push({
          query,
          expected,
          actionMs: performance.now() - actionStarted - readiness.elapsedMs,
          readinessMs: readiness.elapsedMs,
          found: readiness.found,
          cacheHit,
          action,
        });
        if (!action.success || !readiness.found) break;
      }
      const body = await page.evaluate(() => document.body.innerText);
      const state = await (await backendFetch(`${backend}/state`)).json();
      const searches = state.requests.filter((request) => request.path.endsWith('/assets/search'));
      const queries = searches.map((request) => request.query);
      const mismatches = searches.filter((request) => request.query !== request.servedQuery);
      const functionalPass =
        body.includes('No results') &&
        !body.includes('Vanguard S&P 500 ETF') &&
        !body.includes('Invesco QQQ Trust') &&
        ['VOO', 'QQQ', 'zz-no-match'].every((query) => queries.includes(query));
      const passed = fault === 'clean' ? functionalPass : !functionalPass && mismatches.length > 0;
      result.status = fault === 'clean' ? (passed ? 'passed' : 'failed') : passed ? 'detected' : 'missed';
      result.verification = {
        functionalPass,
        passed,
        queries,
        backendSearchRequests: searches.length,
        backendQueryMismatches: mismatches.length,
        seededFaultDetected: fault === 'stale-search' && !functionalPass && mismatches.length > 0,
      };
      fs.writeFileSync(path.join(out, `run-${run}-body.txt`), body);
      fs.writeFileSync(path.join(out, `run-${run}-backend.json`), JSON.stringify(state, null, 2));
      await page.screenshot({ path: path.join(out, `run-${run}-final.png`), animations: 'disabled' });
    } catch (error) {
      result.error = String(error);
    }
    result.totalMs = performance.now() - started;
    result.metrics = metricDelta(beforeMetrics, await stagehand.metrics);
    results.push(result);
    fs.appendFileSync(path.join(out, 'results.jsonl'), `${JSON.stringify(result)}\n`);
    console.log(JSON.stringify(result));
  }
} finally {
  await stagehand.close({ force: true }).catch(() => {});
}
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify(
    {
      stagehand: '3.4.0',
      model: 'local Bonsai 2 27B PTQ1_0, explicit no-thinking',
      initMs,
      runs,
      fault,
      useCache,
      paidApiSpendUsd: 0,
      scope:
        'Prepared semantic action workflow with fixed readiness and UI/backend oracles; not unfamiliar exploration.',
    },
    null,
    2,
  ),
);
console.log(`RAW_RESULTS=${out}`);
process.exitCode = results.every((result) => result.verification?.passed) ? 0 : 1;
