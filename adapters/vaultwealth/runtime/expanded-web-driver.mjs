#!/usr/bin/env node

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.dirname(fileURLToPath(import.meta.url));
const toolsRequire = createRequire(path.join(runtimeRoot, 'tools/package.json'));
const mode = process.argv[2];
const cdpPort = Number(process.env.VAULT_CDP_PORT ?? 18792);
const cdpHost = process.env.VAULT_CDP_HOST ?? 'localhost';
const expected = [
  ['VOO', 'Vanguard S&P 500 ETF', null],
  ['QQQ', 'Invesco QQQ Trust', 'Vanguard S&P 500 ETF'],
  ['zz-no-match', 'No results', 'Invesco QQQ Trust'],
];

async function puppeteerRun() {
  const puppeteer = toolsRequire('puppeteer-core');
  const browser = await puppeteer.connect({ browserURL: `http://${cdpHost}:${cdpPort}` });
  try {
    const pages = await browser.pages();
    const page = pages.find((candidate) => candidate.url().includes('/plan/assets/add')) ?? pages[0];
    for (const [query, present, absent] of expected) {
      await page.locator('input[role="combobox"]').fill(query);
      await page.waitForFunction((text) => document.body.innerText.includes(text), { timeout: 10000 }, present);
      if (absent) {
        await page.waitForFunction((text) => !document.body.innerText.includes(text), { timeout: 10000 }, absent);
      }
    }
  } finally {
    await browser.disconnect();
  }
}

async function seleniumRun() {
  const { By, until } = toolsRequire('selenium-webdriver');
  const chrome = toolsRequire('selenium-webdriver/chrome');
  const chromedriver = path.join(runtimeRoot, 'tools/node_modules/chromedriver/lib/chromedriver/chromedriver');
  const chromeBinary = process.env.VAULT_CHROME_PATH;
  if (!chromeBinary) throw new Error('VAULT_CHROME_PATH is required');
  const options = new chrome.Options()
    .setChromeBinaryPath(chromeBinary)
    .addArguments('--headless', '--no-sandbox', '--window-size=1280,800');
  const service = new chrome.ServiceBuilder(chromedriver).build();
  const driver = chrome.Driver.createSession(options, service);
  try {
    await driver.get('http://127.0.0.1:18790/login');
    await driver.executeScript(`
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('token', 'mock-login-token-final');
    `);
    await driver.get('http://127.0.0.1:18790/plan/assets/add');
    const input = await driver.wait(until.elementLocated(By.css('input[role="combobox"]')), 10000);
    for (const [query, present, absent] of expected) {
      await input.clear();
      await input.sendKeys(query);
      await driver.wait(until.elementLocated(By.xpath(`//*[contains(normalize-space(.), ${JSON.stringify(present)})]`)), 10000);
      if (absent) {
        await driver.wait(async () => !(await driver.findElement(By.tagName('body')).getText()).includes(absent), 10000);
      }
    }
    if (process.env.VAULT_DRIVER_SCREENSHOT) {
      const screenshot = await driver.takeScreenshot();
      const { writeFile } = await import('node:fs/promises');
      await writeFile(process.env.VAULT_DRIVER_SCREENSHOT, screenshot, 'base64');
    }
    console.log(JSON.stringify({ finalText: await driver.findElement(By.tagName('body')).getText() }));
  } finally {
    await driver.quit();
  }
}

async function webdriverioRun() {
  const { remote } = await import(toolsRequire.resolve('webdriverio'));
  const chromedriver = path.join(runtimeRoot, 'tools/node_modules/chromedriver/lib/chromedriver/chromedriver');
  const service = spawn(chromedriver, ['--port=9516', '--allowed-origins=*'], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 50; attempt++) {
    const ready = await fetch('http://127.0.0.1:9516/status', { signal: AbortSignal.timeout(500) })
      .then((response) => response.ok)
      .catch(() => false);
    if (ready) break;
    if (attempt === 49) throw new Error('chromedriver did not become ready');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const browser = await remote({
    automationProtocol: 'webdriver',
    logLevel: 'silent',
    hostname: '127.0.0.1',
    port: 9516,
    path: '/',
    capabilities: {
      browserName: 'chrome',
      webSocketUrl: false,
      'goog:chromeOptions': { debuggerAddress: `${cdpHost}:${cdpPort}` },
    },
  });
  try {
    const observedWindows = [];
    for (const handle of await browser.getWindowHandles()) {
      await browser.switchToWindow(handle);
      const url = await browser.getUrl();
      observedWindows.push({ handle, url });
      if (url.includes('/plan/assets/add')) break;
    }
    console.log(
      JSON.stringify({
        browserVersion: browser.capabilities.browserVersion,
        debuggerAddress: browser.capabilities['goog:chromeOptions']?.debuggerAddress,
        observedWindows,
        selectedUrl: await browser.getUrl(),
      }),
    );
    if (!(await browser.getUrl()).includes('/plan/assets/add')) {
      await browser.url('http://127.0.0.1:18790/login');
      await browser.execute(() => {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('token', 'mock-login-token-final');
      });
      await browser.url('http://127.0.0.1:18790/plan/assets/add');
    }
    const input = await browser.$('input[role="combobox"]');
    for (const [query, present, absent] of expected) {
      await input.setValue(query);
      await browser.waitUntil(async () => (await browser.$('body').getText()).includes(present), { timeout: 10000 });
      if (absent) {
        await browser.waitUntil(async () => !(await browser.$('body').getText()).includes(absent), { timeout: 10000 });
      }
    }
    if (process.env.VAULT_DRIVER_SCREENSHOT) await browser.saveScreenshot(process.env.VAULT_DRIVER_SCREENSHOT);
    console.log(JSON.stringify({ finalText: await browser.$('body').getText() }));
  } finally {
    service.kill('SIGTERM');
  }
}

async function taikoRun() {
  const taiko = toolsRequire('taiko');
  const chromeBinary = process.env.VAULT_CHROME_PATH;
  if (!chromeBinary) throw new Error('VAULT_CHROME_PATH is required');
  await taiko.openBrowser({ headless: true, args: ['--no-sandbox', '--window-size=1280,800'] });
  try {
    taiko.setConfig({ waitForNavigation: false, highlightOnAction: false, observe: false, observeTime: 0 });
    await taiko.goto('http://127.0.0.1:18790/login');
    await taiko.evaluate(taiko.$('body'), () => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('token', 'mock-login-token-final');
    });
    await taiko.goto('http://127.0.0.1:18790/plan/assets/add');
    const input = taiko.$('input[role="combobox"]');
    for (const [query, present, absent] of expected) {
      await taiko.clear(input);
      await taiko.write(query, taiko.into(input));
      await taiko.waitFor(async () => taiko.text(present).exists(), 10000);
      if (absent) await taiko.waitFor(async () => !(await taiko.text(absent).exists()), 10000);
    }
    if (process.env.VAULT_DRIVER_SCREENSHOT) await taiko.screenshot({ path: process.env.VAULT_DRIVER_SCREENSHOT });
    console.log(JSON.stringify({ finalText: await taiko.evaluate(taiko.$('body'), () => document.body.innerText) }));
  } finally {
    await taiko.closeBrowser();
  }
}

async function nightwatchRun() {
  const Nightwatch = toolsRequire('nightwatch');
  const chromedriver = path.join(runtimeRoot, 'tools/node_modules/chromedriver/lib/chromedriver/chromedriver');
  const chromeBinary = process.env.VAULT_CHROME_PATH;
  if (!chromeBinary) throw new Error('VAULT_CHROME_PATH is required');
  const client = Nightwatch.createClient({
    config: path.join(runtimeRoot, 'nightwatch.conf.cjs'),
    browserName: 'chrome',
    headless: true,
    output: false,
    silent: true,
    timeout: 10000,
    webdriver: { start_process: true, server_path: chromedriver },
    desiredCapabilities: {
      browserName: 'chrome',
      'goog:chromeOptions': { binary: chromeBinary, args: ['--headless', '--no-sandbox', '--window-size=1280,800'] },
    },
  });
  const browser = await client.launchBrowser();
  try {
    await browser.url('http://127.0.0.1:18790/login');
    await browser.execute(function prepareSession() {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('token', 'mock-login-token-final');
    });
    await browser.url('http://127.0.0.1:18790/plan/assets/add');
    await browser.waitForElementVisible('input[role="combobox"]', 10000);
    for (const [query, present, absent] of expected) {
      await browser.clearValue('input[role="combobox"]');
      await browser.setValue('input[role="combobox"]', query);
      await browser.useXpath();
      await browser.waitForElementVisible(`//*[contains(normalize-space(.), ${JSON.stringify(present)})]`, 10000);
      if (absent) {
        await browser.waitForElementNotPresent(`//*[contains(normalize-space(.), ${JSON.stringify(absent)})]`, 10000);
      }
      await browser.useCss();
    }
    const finalText = await browser.getText('body');
    if (process.env.VAULT_DRIVER_SCREENSHOT) await browser.saveScreenshot(process.env.VAULT_DRIVER_SCREENSHOT);
    console.log(JSON.stringify({ finalText }));
  } finally {
    await browser.end();
  }
}

const drivers = {
  puppeteer: puppeteerRun,
  selenium: seleniumRun,
  webdriverio: webdriverioRun,
  taiko: taikoRun,
  nightwatch: nightwatchRun,
};

if (!drivers[mode]) throw new Error(`Unknown driver: ${mode}`);
await drivers[mode]();
