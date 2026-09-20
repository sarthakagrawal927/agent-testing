import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(`site/${name}`, root), 'utf8'));
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

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
            <thead><tr><th>Tool</th><th>Evidence</th><th>Cost</th><th>Observed pin</th><th>What we know</th></tr></thead>
            <tbody>${entries.map((tool) => `
              <tr id="${escapeHtml(tool.id)}">
                <td><a href="${escapeHtml(tool.url)}"><strong>${escapeHtml(tool.name)}</strong></a></td>
                <td><span class="status status-${escapeHtml(tool.evidence)}">${escapeHtml(tool.evidence)}</span></td>
                <td>${escapeHtml(tool.cost)}</td>
                <td class="mono-cell">${tool.version ? escapeHtml(tool.version) : 'Not run here'}</td>
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
        <h1>54 tools, labelled honestly.</h1>
        <p class="lede">A tool appears here because it is relevant to local web or iOS testing. Only entries marked benchmarked or screened were run in this experiment.</p>
        <dl class="dates"><div><dt>Catalogue reviewed</dt><dd>20 September 2026</dd></div><div><dt>Last experiment</dt><dd>20 September 2026</dd></div></dl>
        <p class="fine-print">Coverage is complete within the six categories below as of the review date. It is not a claim that every testing product in existence is listed.</p>
      </header>
      <section class="legend-block" aria-labelledby="evidence-key"><h2 id="evidence-key">Evidence key</h2><dl>${Object.entries(tools.evidence_states).map(([key, value]) => `<div><dt><span class="status status-${escapeHtml(key)}">${escapeHtml(key)}</span></dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>
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
      <section aria-labelledby="run-it"><h2 id="run-it">Clone and replay</h2><pre><code>gh repo clone sarthakagrawal927/agent-testing
cd agent-testing
npm test

# Validate the real-product adapter
npm run validate:vaultwealth

# Read exact setup and replay commands
open adapters/vaultwealth/runtime/README.md</code></pre><p class="fine-print">The repository is private. Product adapters use local or disposable seeded targets only.</p></section>
      <div class="experiment-list">${experimentSections}</div>
      <section class="catalog-section" aria-labelledby="versions"><h2 id="versions">Exact observed versions</h2><p>${escapeHtml(versions.machine)}. ${escapeHtml(versions.browser)}. ${escapeHtml(versions.simulator)}.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Exact observed version pins"><table class="catalog-table"><thead><tr><th>Tool or runtime</th><th>Exact observed pin</th><th>Recorded from</th></tr></thead><tbody>${versionRows}</tbody></table></div><p class="fine-print">These pins make the historical result reproducible. They are not recommendations to avoid newer versions.</p></section>
      <section class="plain-callout"><h2>What would justify rerunning</h2><p>Rerun when the application journey changes, a candidate has a material new release, the browser or simulator changes, or a five-run screen beats the current reliability and verified-feedback result. Do not rerun the whole catalogue merely because another tool exists.</p></section>
      <footer><p>Machine-readable records: <a href="/experiments.json">experiments.json</a> and <a href="/versions.json">versions.json</a>.</p></footer>`
});

await Promise.all([
  writeFile(new URL('site/tools.html', root), toolsHtml),
  writeFile(new URL('site/experiments.html', root), experimentsHtml),
]);
