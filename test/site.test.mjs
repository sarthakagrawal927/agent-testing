import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(`../site/${name}`, import.meta.url), 'utf8');

test('public map is agent-first, static and honest about access', async () => {
  const html = await read('index.html');

  assert.match(html, /<main id="main"/);
  assert.match(html, /gh repo clone sarthakagrawal927\/agent-testing/);
  assert.match(html, /source repository is private/i);
  assert.match(html, /A zero exit code is not a correct product state/);
  assert.match(html, /No overall replacement has qualified yet/);
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)/i);
});

test('public map ships agent and missing-route surfaces', async () => {
  const [llms, missing, headers] = await Promise.all([
    read('llms.txt'),
    read('404.html'),
    read('_headers'),
  ]);

  assert.match(llms, /## Start/);
  assert.match(llms, /## Add a product/);
  assert.match(llms, /The workflow and verifier must be separate/);
  assert.match(missing, /Route not found/);
  assert.match(headers, /Content-Security-Policy/);
});

test('layout has responsive, focus and contrast accommodations', async () => {
  const css = await read('styles.css');

  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /overflow-x: auto/);
});

