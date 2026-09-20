import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const roots = ['bin', 'src', 'scripts', 'test', 'fixtures', 'adapters'];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return entry.isFile() && target.endsWith('.mjs') ? [target] : [];
  });
}

for (const root of roots) {
  for (const file of walk(root)) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
