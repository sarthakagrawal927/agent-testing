import { chromium } from '@playwright/test';
import path from 'node:path';
import { verifyLoginControl } from './visual.mjs';
const root = path.dirname(new URL(import.meta.url).pathname);
await fetch('http://127.0.0.1:18791/reset', {
  method: 'POST',
  body: JSON.stringify({ fault: 'clean' }),
  headers: { Connection: 'close' },
});
const browser = await chromium.connectOverCDP('http://127.0.0.1:18792');
try {
  const page = browser.contexts()[0].pages()[0];
  await page.goto('http://127.0.0.1:18790/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByLabel('Email address', { exact: true }).waitFor();
  await verifyLoginControl(
    page,
    path.join(root, 'artifacts/login-control-reference.png'),
    path.join(root, 'artifacts/reference-capture.png'),
    true,
  );
  console.log('Reference captured from clean fixture. Visually inspect it before qualification.');
} finally {
  await browser.close();
}
