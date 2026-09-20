import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--remote-debugging-port=18792'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname;
  return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('ERROR', e.message));
page.on('console', (e) => console.log(e.type(), e.text().slice(0, 500)));
await page.goto('http://127.0.0.1:18790/login');
await page.getByLabel('Email address', { exact: true }).waitFor({ timeout: 10000 });
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'local-agent-eval/fast-testing/artifacts/probe.png' });
console.log('PROBE_READY');
process.on('SIGTERM', () => browser.close().then(() => process.exit()));
process.on('SIGINT', () => browser.close().then(() => process.exit()));
setInterval(() => {}, 60_000);
