import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(`site/${name}`, root), 'utf8'));
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const formatDate = (value) => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00Z`));
const evidenceLabel = (value) => value === 'researched-only' ? 'source reviewed' : value;
const formatSeconds = (value) => value === null ? '—' : `${Number(value).toFixed(3)} s`;

const layout = ({ title, description, body }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#f7f2e8">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <main id="main" class="page wide-page">
      <nav class="site-nav" aria-label="Primary navigation">
        <a href="/">Browser Agent Testing</a>
        <span><a href="/tools">Tools</a> · <a href="/experiments">Experiments</a> · <a href="/llms.txt">Agent summary</a></span>
      </nav>
      ${body}
    </main>
  </body>
</html>
`;

const tools = await readJson('tools.json');
const experiments = await readJson('experiments.json');
const versions = await readJson('versions.json');

const categories = Map.groupBy(tools.tools, (tool) => tool.category);
const toolSections = [...categories.entries()].map(([category, entries]) => `
      <section class="catalog-section" aria-labelledby="${escapeHtml(category.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'))}">
        <h2 id="${escapeHtml(category.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'))}">${escapeHtml(category)} <small>${entries.length}</small></h2>
        <div class="table-wrap" tabindex="0" role="region" aria-label="${escapeHtml(category)} tools">
          <table class="catalog-table">
            <thead><tr><th>Tool</th><th>Evidence</th><th>Cost</th><th>Version or boundary</th><th>What we know</th></tr></thead>
            <tbody>${entries.map((tool) => `
              <tr id="${escapeHtml(tool.id)}">
                <td><a href="${escapeHtml(tool.url)}"><strong>${escapeHtml(tool.name)}</strong></a></td>
                <td><span class="status status-${escapeHtml(tool.evidence)}">${escapeHtml(evidenceLabel(tool.evidence))}</span></td>
                <td>${escapeHtml(tool.cost)}</td>
                <td class="mono-cell">${escapeHtml(tool.version ?? tool.disposition ?? tools.category_boundaries[tool.category])}</td>
                <td>${escapeHtml(tool.note)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>`).join('');

const toolsHtml = layout({
  title: 'Tools — Map of Browser Agent Testing',
  description: 'A dated, evidence-labelled catalogue of web, iOS, visual and agent testing tools.',
  body: `
      <header class="plain-header">
        <p class="eyebrow">Completed experiment · tool catalogue</p>
        <h1>${tools.tools.length} tools, each with a verdict.</h1>
        <p class="lede">A dated map of practical browser-agent and iOS-agent testing choices. Every row has either local execution evidence or a concrete fit boundary; there are no placeholder “not run” rows.</p>
        <dl class="dates"><div><dt>Catalogue reviewed</dt><dd>${formatDate(tools.catalogue_reviewed)}</dd></div><div><dt>Last experiment</dt><dd>${formatDate(tools.last_experiment)}</dd></div></dl>
        <p class="fine-print">Coverage is exhaustive within the seven named categories as of the review date, using maintained official projects and materially relevant reference tools. It is a dated map, not a claim that every testing product in existence belongs here.</p>
      </header>
      <section class="legend-block" aria-labelledby="evidence-key"><h2 id="evidence-key">Evidence key</h2><dl>${Object.entries(tools.evidence_states).map(([key, value]) => `<div><dt><span class="status status-${escapeHtml(key)}">${escapeHtml(evidenceLabel(key))}</span></dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>
      ${toolSections}
      <footer><p>Machine-readable catalogue: <a href="/tools.json">tools.json</a>. Experiment record: <a href="/experiments">/experiments</a>.</p></footer>`
});

const experimentSections = experiments.experiments.map((experiment, index) => `
      <article class="experiment" id="${escapeHtml(experiment.id)}">
        <p class="section-label">Experiment ${String(index + 1).padStart(2, '0')} · ${escapeHtml(experiment.status)}</p>
        <h2>${escapeHtml(experiment.title)}</h2>
        <p><strong>Arms:</strong> ${experiment.arms.map(escapeHtml).join(' · ')}</p>
        <p>${escapeHtml(experiment.result)}</p>
        <ul>${experiment.measurements.map((measurement) => `<li>${escapeHtml(measurement)}</li>`).join('')}</ul>
        <p class="fine-print">Evidence: <code>${escapeHtml(experiment.evidence)}</code></p>
      </article>`).join('');

const coverageItems = [
  ['Tools mapped', experiments.coverage.catalogue_tools],
  ['Tools executed', experiments.coverage.executed_tools],
  ['Measured journey arms', experiments.journey_comparisons.length],
  ['Verified journey attempts', `${experiments.coverage.verified_journey_passes}/${experiments.coverage.journey_attempts}`],
  ['Seeded defect types', experiments.coverage.seeded_defect_types],
  ['Accepted paid API spend', `$${experiments.coverage.estimated_paid_api_spend_usd.toFixed(5)}`],
];
const coverageCards = coverageItems.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');

const journeyRows = experiments.journey_comparisons.map((row) => `
              <tr>
                <td>${escapeHtml(row.platform)}</td>
                <td>${escapeHtml(row.journey)}</td>
                <td><strong>${escapeHtml(row.mode)}</strong><small>${escapeHtml(row.timing_basis)}</small></td>
                <td class="mono-cell">${formatSeconds(row.median_seconds)}</td>
                <td class="mono-cell">${formatSeconds(row.observed_p95_seconds)}</td>
                <td class="mono-cell">${escapeHtml(`${row.verified_passes}/${row.attempts}`)}</td>
                <td>${escapeHtml(row.model_use)}</td>
                <td>${escapeHtml(row.fault_result)}</td>
              </tr>`).join('');

const probeRows = experiments.probe_comparisons.map((row) => `
              <tr>
                <td><strong>${escapeHtml(row.probe)}</strong></td>
                <td class="mono-cell">${formatSeconds(row.median_seconds)}</td>
                <td class="mono-cell">${formatSeconds(row.observed_p95_seconds)}</td>
                <td class="mono-cell">${escapeHtml(row.passes)}</td>
                <td>${escapeHtml(row.numeric_detail)}</td>
                <td>${escapeHtml(row.boundary)}</td>
              </tr>`).join('');

const versionRows = versions.pins.map((pin) => `<tr><td><strong>${escapeHtml(pin.name)}</strong></td><td class="mono-cell">${escapeHtml(pin.version)}</td><td>${escapeHtml(pin.source)}</td></tr>`).join('');

const experimentsHtml = layout({
  title: 'Experiments — Map of Browser Agent Testing',
  description: 'Vaultwealth agent-testing benchmark results, limitations, version pins and replay paths.',
  body: `
      <header class="plain-header">
        <p class="eyebrow">Completed experiment · experiment record</p>
        <h1>What was actually run.</h1>
        <p class="lede">Vaultwealth web and iOS Simulator, seeded local fixtures, one Mac, bounded runs, and an independent correctness oracle.</p>
        <dl class="dates"><div><dt>Last experiment</dt><dd>20 September 2026</dd></div><div><dt>Current decision</dt><dd>Keep Playwright + Maestro</dd></div></dl>
      </header>
      <section class="plain-callout"><h2>Bottom line</h2><p>${escapeHtml(experiments.decision)}</p><p>Promising results remain screening evidence. None completed the planned 20 warm and three cold qualification set across every journey.</p></section>
      <section aria-labelledby="coverage"><h2 id="coverage">Coverage in numbers</h2><div class="evidence coverage-evidence">${coverageCards}</div><p class="fine-print">Executed means benchmarked or bounded-screened locally. The other ${experiments.coverage.source_reviewed} catalogue entries retain source-backed fit boundaries; they are not assigned synthetic scores.</p></section>
      <section class="catalog-section" aria-labelledby="journey-matrix"><h2 id="journey-matrix">Measured journey matrix <small>${experiments.journey_comparisons.length} arms</small></h2><p>Median and observed p95 include the timing basis shown under each mode. At these sample sizes, observed p95 is usually the maximum. A dash means the report did not establish that number.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Measured web and iOS journey comparison"><table class="catalog-table result-table"><thead><tr><th>Platform</th><th>Journey</th><th>Mode</th><th>Median</th><th>Observed p95</th><th>Verified</th><th>Model / cost</th><th>Seeded fault</th></tr></thead><tbody>${journeyRows}</tbody></table></div></section>
      <section class="catalog-section" aria-labelledby="probe-matrix"><h2 id="probe-matrix">Other measured probes <small>${experiments.probe_comparisons.length}</small></h2><p>These numbers are useful, but they are not comparable end-to-end application journeys.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Measured readiness diagnostic and local model probes"><table class="catalog-table result-table"><thead><tr><th>Probe</th><th>Median</th><th>Observed p95</th><th>Passes</th><th>Numeric detail</th><th>Boundary</th></tr></thead><tbody>${probeRows}</tbody></table></div></section>
      <section aria-labelledby="run-it"><h2 id="run-it">Clone and replay</h2><pre><code>gh repo clone sarthakagrawal927/agent-testing
cd agent-testing
npm test

# Validate the real-product adapter
npm run validate:vaultwealth

# Read exact setup and replay commands
open adapters/vaultwealth/runtime/README.md</code></pre><p class="fine-print">The source repository is public. Product adapters must still use local or disposable seeded targets only.</p></section>
      <div class="experiment-list">${experimentSections}</div>
      <section class="catalog-section" aria-labelledby="versions"><h2 id="versions">Exact observed versions</h2><p>${escapeHtml(versions.machine)}. ${escapeHtml(versions.browser)}. ${escapeHtml(versions.simulator)}.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Exact observed version pins"><table class="catalog-table"><thead><tr><th>Tool or runtime</th><th>Exact observed pin</th><th>Recorded from</th></tr></thead><tbody>${versionRows}</tbody></table></div><p class="fine-print">These pins make the historical result reproducible. They are not recommendations to avoid newer versions.</p></section>
      <section class="plain-callout"><h2>What would justify rerunning</h2><p>Rerun when the application journey changes, a candidate has a material new release, the browser or simulator changes, or a five-run screen beats the current reliability and verified-feedback result. Do not rerun the whole catalogue merely because another tool exists.</p></section>
      <footer><p>Machine-readable records: <a href="/experiments.json">experiments.json</a> and <a href="/versions.json">versions.json</a>.</p></footer>`
});

await Promise.all([
  writeFile(new URL('site/tools.html', root), toolsHtml),
  writeFile(new URL('site/experiments.html', root), experimentsHtml),
]);
