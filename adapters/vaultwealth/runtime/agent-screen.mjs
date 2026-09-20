// Five fresh login tasks per interaction strategy, sequential on one browser.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'artifacts', `agent-screen-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
screen: for (let i = 0; i < 5; i++)
  for (const mode of i % 2 ? ['batched', 'stepwise'] : ['stepwise', 'batched']) {
    const started = Date.now();
    const r = spawnSync(process.execPath, [path.join(root, 'agent-run.mjs'), mode, 'clean'], {
      encoding: 'utf8',
      timeout: 360000,
      maxBuffer: 8e6,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    fs.writeFileSync(path.join(out, `${mode}-${i}.log`), r.stdout + '\n' + r.stderr);
    let result;
    try {
      result = JSON.parse(r.stdout.trim().split('\n').at(-1));
    } catch {}
    const row = {
      run: i,
      mode,
      startedAt: new Date(started).toISOString(),
      exit: r.status,
      wallMs: Date.now() - started,
      result,
    };
    fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify(row) + '\n');
    console.log(
      JSON.stringify({
        run: i,
        mode,
        exit: r.status,
        status: result?.status,
        totalMs: result?.totalMs,
        out: result?.out,
      }),
    );
    if (r.status !== 0 || result?.exit !== 0 || /usage limit|quota exceeded|rate limit|limit reached/i.test(r.stderr)) {
      console.log('Stopped after infrastructure/provider failure; no automatic retry.');
      break screen;
    }
  }
console.log(out);
