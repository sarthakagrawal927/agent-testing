import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
export function provenance() {
  const files = [
    'backend.ts',
    'benchmark.mjs',
    'web-workflows.mjs',
    'visual.mjs',
    'ios-benchmark.mjs',
    'ios-login.yaml',
    'ios-visual.mjs',
    'agent-run.mjs',
    'qualify-agent.mjs',
    'tool-paths.mjs',
    'artifacts/login-control-reference.png',
    'ios-search-benchmark.mjs',
    'ios-search.yaml',
    'ios-cache-reset.yaml',
    'ios-edit-benchmark.mjs',
    'ios-edit.yaml',
    'ios-plan-reset.yaml',
    'ios-open-cash.yaml',
    'artifacts/ios-screen-1789841845936/maestro-0/initial.png',
    '../../src/mocks/experiment-reset.native.ts',
    '../../src/mocks/experiment-transport.ts',
    '../../src/mocks/interceptor.ts',
    '../../src/mocks/interceptor.native.ts',
    '../../src/hooks/use-mocks-ready.ts',
    '../../src/pages/login/steps/01-email.native.tsx',
  ];
  return {
    metroProfile: process.env.EXPERIMENT_METRO_PROFILE ?? 'unspecified',
    node: process.version,
    os: os.release(),
    cpu: os.cpus()[0]?.model,
    memoryBytes: os.totalmem(),
    sourceHashes: Object.fromEntries(
      files.map((file) => [
        file,
        createHash('sha256')
          .update(fs.readFileSync(path.join(root, file)))
          .digest('hex'),
      ]),
    ),
  };
}
