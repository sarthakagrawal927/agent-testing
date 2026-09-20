import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { provenance } from './provenance.mjs';

const root = path.dirname(new URL(import.meta.url).pathname);
const cli = path.join(root, 'tools/node_modules/.bin/chrome-devtools');
const out = path.join(root, 'artifacts', `chrome-devtools-${Date.now()}`);
const runs = Number(process.argv[2] ?? 5);
fs.mkdirSync(out, { recursive: true });

function invoke(args) {
  const started = performance.now();
  const result = spawnSync(cli, args, {
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  const durationMs = performance.now() - started;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  if (/Could not connect to Chrome|\"isError\"\s*:\s*true|### Error/i.test(result.stdout))
    throw new Error(result.stdout);
  return { durationMs, stdout: result.stdout, stderr: result.stderr };
}

const pages = invoke(['list_pages', '--output-format', 'json']);
const parsedPages = JSON.parse(pages.stdout);
const pageText = Array.isArray(parsedPages) ? parsedPages.map((block) => block.text ?? '').join('\n') : '';
const pageId = Number(
  parsedPages.pages?.find((page) => page.url?.startsWith('http://127.0.0.1:18790/'))?.id ??
    pageText.match(/(?:^|\n)(\d+):.*http:\/\/127\.0\.0\.1:18790\//)?.[1] ??
    1,
);
const results = [];

fs.writeFileSync(
  path.join(out, 'manifest.json'),
  JSON.stringify(
    {
      ...provenance(),
      chromeDevtoolsMcp: JSON.parse(
        fs.readFileSync(path.join(root, 'tools/node_modules/chrome-devtools-mcp/package.json'), 'utf8'),
      ).version,
      pageId,
      runs,
      role: 'diagnostic-companion-not-journey-driver',
      usageStatistics: false,
      performanceCrux: false,
      networkHeadersRedacted: true,
    },
    null,
    2,
  ),
);

for (let run = 0; run < runs; run++) {
  const result = { run, status: 'passed', stages: {} };
  try {
    const snapshot = invoke(['take_snapshot', String(pageId), '--output-format', 'json']);
    const consoleMessages = invoke([
      'list_console_messages',
      String(pageId),
      '--types',
      'error',
      'warn',
      '--includeStackTraces',
      '--output-format',
      'json',
    ]);
    const network = invoke(['list_network_requests', String(pageId), '--pageSize', '200', '--output-format', 'json']);
    result.stages.snapshotMs = snapshot.durationMs;
    result.stages.consoleMs = consoleMessages.durationMs;
    result.stages.networkMs = network.durationMs;
    result.totalMs = snapshot.durationMs + consoleMessages.durationMs + network.durationMs;
    result.bytes = {
      snapshot: Buffer.byteLength(snapshot.stdout),
      console: Buffer.byteLength(consoleMessages.stdout),
      network: Buffer.byteLength(network.stdout),
    };
    if (run === 0) {
      fs.writeFileSync(path.join(out, 'snapshot.json'), snapshot.stdout);
      fs.writeFileSync(path.join(out, 'console.json'), consoleMessages.stdout);
      fs.writeFileSync(path.join(out, 'network.json'), network.stdout);
    }
  } catch (error) {
    result.status = 'failed';
    result.error = String(error);
  }
  results.push(result);
  fs.appendFileSync(path.join(out, 'results.jsonl'), `${JSON.stringify(result)}\n`);
  console.log(JSON.stringify(result));
}

console.log(`RAW_RESULTS=${out}`);
