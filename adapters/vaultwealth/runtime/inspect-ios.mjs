import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { simulatorUdid } from './tool-paths.mjs';
const result = spawnSync('local-agent-eval/fast-testing/tools/axe/axe', ['describe-ui', '--udid', simulatorUdid()], {
  encoding: 'utf8',
  timeout: 30000,
  maxBuffer: 8 * 1024 * 1024,
});
fs.writeFileSync('local-agent-eval/fast-testing/artifacts/ios-last.json', result.stdout);
if (result.status !== 0) throw Error(`${result.stderr} ${result.error ?? ''}; signal=${result.signal}`);
function walk(x) {
  if (x.AXLabel || x.AXUniqueId || x.type === 'TextField')
    console.log(JSON.stringify({ type: x.type, label: x.AXLabel, id: x.AXUniqueId, value: x.AXValue, frame: x.frame }));
  for (const c of x.children ?? []) walk(c);
}
JSON.parse(result.stdout).forEach(walk);
