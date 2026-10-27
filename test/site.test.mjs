import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = (name) => readFile(new URL(`../site/${name}`, import.meta.url), 'utf8');

test('public map is agent-first and links to its public source', async () => {
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
  assert.match(html, /Measured journey arms/);
  assert.match(html, /Accepted paid API spend/);
  assert.match(html, /data-project="agent-testing"/);
  assert.match(html, /health\.sassmaker\.com\/tracker\.js/);
  assert.match(html, /app-health-actions\.js/);
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
  assert.match(toolsPage, /80 tools, each with a verdict/);
  assert.doesNotMatch(toolsPage, /Not run here/);
  assert.match(experimentsPage, /What was actually run/);
  assert.match(experimentsPage, /Measured journey matrix/);
  assert.match(experimentsPage, /26 arms/);
  assert.match(experimentsPage, /Other measured probes/);
  for (const page of [toolsPage, experimentsPage]) {
    assert.match(page, /data-project="agent-testing"/);
    assert.match(page, /health\.sassmaker\.com\/tracker\.js/);
  }
});

test('sitemap publishes canonical direct routes for generated pages', async () => {
  const [sitemap, toolsPage, experimentsPage, indexPage] = await Promise.all([
    read('sitemap.xml'),
    read('tools.html'),
    read('experiments.html'),
    read('index.html'),
  ]);
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const canonicalUrls = [
    'https://browser-agents.sarthakagrawal.dev/',
    'https://browser-agents.sarthakagrawal.dev/tools',
    'https://browser-agents.sarthakagrawal.dev/experiments',
  ];

  assert.deepEqual(locations, canonicalUrls);
  for (const [page, canonical] of [
    [indexPage, canonicalUrls[0]],
    [toolsPage, canonicalUrls[1]],
    [experimentsPage, canonicalUrls[2]],
  ]) {
    assert.ok(page.includes(`<link rel="canonical" href="${canonical}">`));
  }
  assert.doesNotMatch(sitemap, /\.html<\/loc>/);
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

  assert.ok(tools.tools.length >= 75);
  assert.equal(ids.size, tools.tools.length);
  assert.equal(categories.size, 7);
  assert.equal(experiments.experiments.length, 10);
  assert.equal(tools.status, 'completed-experiment');
  assert.equal(experiments.status, 'completed-experiment');
  assert.ok(versions.pins.length >= 15);
  assert.equal(tools.last_experiment, '2026-09-20');
  assert.equal(experiments.last_experiment, '2026-09-20');
  assert.equal(experiments.coverage.catalogue_tools, tools.tools.length);
  const evidenceCounts = Object.fromEntries(
    [...Map.groupBy(tools.tools, (tool) => tool.evidence)].map(([key, entries]) => [key, entries.length]),
  );
  assert.equal(experiments.coverage.executed_tools, evidenceCounts.benchmarked + evidenceCounts.screened);
  assert.equal(experiments.coverage.repeated_benchmarks, evidenceCounts.benchmarked);
  assert.equal(experiments.coverage.bounded_screens, evidenceCounts.screened);
  assert.equal(experiments.coverage.setup_blocked, evidenceCounts['setup-blocked']);
  assert.equal(experiments.coverage.source_reviewed, evidenceCounts['researched-only']);
  assert.equal(experiments.coverage.experiment_records, experiments.experiments.length);
  assert.equal(experiments.journey_comparisons.length, 26);
  assert.equal(experiments.probe_comparisons.length, 7);
  const journeyTotals = experiments.journey_comparisons.reduce(
    (totals, row) => ({ passes: totals.passes + row.verified_passes, attempts: totals.attempts + row.attempts }),
    { passes: 0, attempts: 0 },
  );
  assert.equal(experiments.coverage.verified_journey_passes, journeyTotals.passes);
  assert.equal(experiments.coverage.journey_attempts, journeyTotals.attempts);

  for (const tool of tools.tools) {
    assert.match(tool.url, /^https:\/\//);
    assert.match(toolsPage, new RegExp(`id="${tool.id}"`));
    assert.ok(tool.version || tool.disposition || tools.category_boundaries[tool.category]);
  }
});

test('quantitative matrix preserves denominators and timing semantics', async () => {
  const experiments = JSON.parse(await read('experiments.json'));

  for (const row of experiments.journey_comparisons) {
    assert.ok(row.attempts > 0);
    assert.ok(row.verified_passes >= 0 && row.verified_passes <= row.attempts);
    assert.ok(row.timing_basis.length > 0);
    assert.ok(row.model_use.length > 0);
    assert.ok(row.fault_result.length > 0);
    if (row.median_seconds !== null) assert.ok(row.median_seconds > 0);
    if (row.observed_p95_seconds !== null) {
      assert.ok(row.median_seconds !== null);
      assert.ok(row.observed_p95_seconds >= row.median_seconds);
    }
  }

  const browserUse = experiments.journey_comparisons.find((row) => row.mode === 'Browser Use + Bonsai');
  assert.deepEqual([browserUse.verified_passes, browserUse.attempts], [4, 5]);
  const batched = experiments.journey_comparisons.find((row) => row.mode === 'Codex batched');
  assert.deepEqual([batched.verified_passes, batched.attempts], [0, 5]);
  assert.match(batched.timing_basis, /all attempts/);
});

test('expanded driver screen records verified results and a fault oracle', async () => {
  const evidence = JSON.parse(await readFile(new URL('../adapters/vaultwealth/runtime/evidence/expanded-web-screening-2026-09-20.json', import.meta.url), 'utf8'));

  assert.equal(evidence.status, 'completed-screening');
  assert.equal(evidence.results.length, 5);
  for (const result of evidence.results) {
    assert.equal(result.clean_verified, '5/5');
    assert.equal(result.fault_detected, true);
    assert.ok(result.workflow_median_ms > 0);
    assert.ok(result.workflow_observed_p95_ms >= result.workflow_median_ms);
  }
  assert.equal(evidence.setup_dispositions.length, 2);
});

test('expanded native screen records successful discovery and cleans up the temporary agent', async () => {
  const evidence = JSON.parse(await readFile(new URL('../adapters/vaultwealth/runtime/evidence/expanded-native-screening-2026-09-20.json', import.meta.url), 'utf8'));

  assert.equal(evidence.status, 'completed-readiness-screen');
  assert.equal(evidence.results.length, 3);
  assert.equal(evidence.results[0].accessibility_description, 'passed');
  assert.equal(evidence.results[1].accessibility_listing, 'passed');
  assert.match(evidence.results[1].device_agent, /removed afterward/);
});

test('layout has responsive, focus and contrast accommodations', async () => {
  const css = await read('styles.css');

  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /overflow-x: auto/);
});


test('catalogue regeneration retains a full-width footer without reopening data capture', async () => {
  const before = await Promise.all(['tools.json', 'experiments.json', 'versions.json', '_headers'].map(read));
  const script = fileURLToPath(new URL('../scripts/render-catalog.mjs', import.meta.url));
  const first = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(first.status, 0, first.stderr);
  const pages = await Promise.all(['index.html', 'tools.html', 'experiments.html', '404.html'].map(read));
  for (const page of pages) {
    const mainEnd = page.indexOf('</main>');
    const hostStart = page.indexOf('<fleet-footer-extension');
    assert.ok(hostStart > mainEnd && mainEnd > 0, 'the complete footer must sit outside the reading column');
    assert.equal((page.match(/<fleet-footer-extension\b/g) ?? []).length, 1);
    assert.match(page, /font-base="\/fonts\/fleet-footer-precise-v1\/"/);
    assert.match(page, /art-src="\/footer-art\/agent-testing.webp"/);
    assert.match(page, /data-capture="false"/);
    for (const route of ['/', '/tools', '/experiments', '/llms.txt', '/tools.json', '/experiments.json', '/versions.json']) {
      assert.ok(page.slice(hostStart).includes(`href="${route}"`), `retained native route ${route}`);
    }
  }
  const second = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(await Promise.all(['index.html', 'tools.html', 'experiments.html', '404.html'].map(read)), pages);
  assert.deepEqual(await Promise.all(['tools.json', 'experiments.json', 'versions.json', '_headers'].map(read)), before);
});
