import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const node = process.env.EXPERIMENT_NODE ?? process.execPath;
const version = spawnSync(node, ['--version'], { encoding: 'utf8' }).stdout.trim();
if (version !== 'v24.21.0') throw Error('Set EXPERIMENT_NODE to pinned Node 24.21.0');
const out = path.join(root, 'artifacts', 'web-final');
const started = performance.now();
const result = spawnSync(node, ['node_modules/expo/bin/cli', 'export', '-p', 'web', '--output-dir', out], {
  encoding: 'utf8',
  timeout: 180000,
  maxBuffer: 16e6,
  env: {
    ...process.env,
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_ENABLE_MOCKS: 'true',
    EXPO_PUBLIC_TESTING_EXPERIMENT: 'true',
    EXPO_PUBLIC_MOCK_SEED: 'demo',
    EXPO_PUBLIC_MOCK_INVESTED: '1',
    EXPO_PUBLIC_E2E_MOCK_PROFILE: 'fast',
    EXPO_PUBLIC_APP_ENV: 'development',
  },
});
fs.writeFileSync(path.join(root, 'artifacts', 'web-final-build.log'), result.stdout + '\n' + result.stderr);
const record = {
  node: version,
  startedAt: new Date(Date.now() - (performance.now() - started)).toISOString(),
  wallMs: performance.now() - started,
  exit: result.status,
  error: String(result.error ?? ''),
  output: out,
};
fs.writeFileSync(path.join(root, 'artifacts', 'web-final-build.json'), JSON.stringify(record, null, 2));
console.log(record);
if (result.status !== 0) process.exitCode = 1;
