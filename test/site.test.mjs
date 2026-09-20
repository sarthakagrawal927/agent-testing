import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(`../site/${name}`, import.meta.url), 'utf8');

test('public map is agent-first, static and links to its public source', async () => {
  const html = await read('index.html');

  assert.match(html, /<main id="main"/);
  assert.match(html, /The Map of<br>Browser Agent Testing/);
  assert.match(html, /Completed browser-agent experiment/);
  assert.match(html, /gh repo clone sarthakagrawal927\/agent-testing/);
  assert.match(html, /experiment records, and replay instructions are public/i);
  assert.match(html, /Open the source repository/i);
  assert.doesNotMatch(html, /private repository/i);
  assert.match(html, /A zero exit code is not a correct product state/);
  assert.match(html, /No overall replacement has qualified yet/);
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)/i);
});

test('public map ships agent and missing-route surfaces', async () => {
  const [llms, missing, headers, toolsPage, experimentsPage] = await Promise.all([
    read('llms.txt'),
    read('404.html'),
    read('_headers'),
    read('tools.html'),
    read('experiments.html'),
  ]);

  assert.match(llms, /## Start/);
  assert.match(llms, /## Add a product/);
  assert.match(llms, /The workflow and verifier must be separate/);
  assert.match(missing, /Route not found/);
  assert.match(headers, /Content-Security-Policy/);
  assert.match(toolsPage, /54 tools, labelled honestly/);
  assert.match(experimentsPage, /What was actually run/);
  assert.doesNotMatch(toolsPage, /<script\b/i);
  assert.doesNotMatch(experimentsPage, /<script\b/i);
});

test('catalogue has broad coverage without presenting research as benchmark evidence', async () => {
  const [toolsRaw, experimentsRaw, versionsRaw, toolsPage] = await Promise.all([
    read('tools.json'),
    read('experiments.json'),
    read('versions.json'),
    read('tools.html'),
  ]);
  const tools = JSON.parse(toolsRaw);
  const experiments = JSON.parse(experimentsRaw);
  const versions = JSON.parse(versionsRaw);
  const ids = new Set(tools.tools.map((tool) => tool.id));
  const categories = new Set(tools.tools.map((tool) => tool.category));

  assert.ok(tools.tools.length >= 50);
  assert.equal(ids.size, tools.tools.length);
  assert.equal(categories.size, 6);
  assert.equal(experiments.experiments.length, 8);
  assert.equal(tools.status, 'completed-experiment');
  assert.equal(experiments.status, 'completed-experiment');
  assert.ok(versions.pins.length >= 15);
  assert.equal(tools.last_experiment, '2026-09-20');
  assert.equal(experiments.last_experiment, '2026-09-20');

  for (const tool of tools.tools) {
    assert.match(tool.url, /^https:\/\//);
    assert.match(toolsPage, new RegExp(`id="${tool.id}"`));
    if (tool.evidence === 'researched-only') assert.equal(tool.version, null);
  }
});

test('layout has responsive, focus and contrast accommodations', async () => {
  const css = await read('styles.css');

  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /overflow-x: auto/);
});
