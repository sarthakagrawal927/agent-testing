import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const experimentRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(experimentRoot, '../..');
const runDirectory = process.env.FLEET_AGENT_TEST_RUN_DIR;
const action = process.argv[2];
const journey = process.argv[3] ?? 'search';
const candidate = process.argv[4] ?? 'playwright';
const fault = process.argv[5] ?? 'clean';

if (!runDirectory) throw new Error('FLEET_AGENT_TEST_RUN_DIR is required');

const statePath = path.join(runDirectory, 'vault-adapter-state.json');

if (action === 'workflow') {
  const child = spawnSync(
    process.execPath,
    [path.join(experimentRoot, 'benchmark.mjs'), journey, '1', candidate, fault],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 110_000,
    },
  );
  if (child.status !== 0 || child.error) process.exit(2);

  const lines = child.stdout.split(/\r?\n/).filter(Boolean);
  const result = lines
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    })
    .findLast((entry) => entry.journey === journey && entry.mode === candidate);
  const outputLine = lines.findLast((line) => line.startsWith('RAW_RESULTS='));
  const outputDirectory = outputLine?.slice('RAW_RESULTS='.length);
  if (!result || !outputDirectory) process.exit(3);

  fs.writeFileSync(statePath, `${JSON.stringify({ result, outputDirectory }, null, 2)}\n`);
  const artifactDirectory = path.relative(repositoryRoot, outputDirectory);
  console.log(
    `FLEET_AGENT_TEST_RESULT=${JSON.stringify({
      metrics: {
        resetMs: result.resetMs ?? 0,
        readinessMs: result.stages?.startAndReadyMs ?? 0,
        observationMs: result.stages?.observationMs ?? 0,
        controlAndApplicationWaitMs: result.stages?.controlAndAppWaitMs ?? 0,
        verificationMs: result.stages?.verificationMs ?? 0,
        modelCalls: result.modelCalls ?? 0,
        retries: result.retries ?? 0,
        manualInterventions: 0,
      },
      artifacts: [artifactDirectory],
    })}`,
  );
} else if (action === 'verify') {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const resultsFile = path.join(state.outputDirectory, 'results.jsonl');
  if (!fs.existsSync(resultsFile) || state.result.status !== 'passed') process.exit(7);
} else {
  process.exit(2);
}
