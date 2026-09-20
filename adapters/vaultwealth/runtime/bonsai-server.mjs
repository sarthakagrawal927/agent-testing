// Owned, loopback-only text runtime. Model preparation is outside benchmark time.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const binary = process.argv[2];
const profile = process.argv[3] ?? 'budget-only';
if (!['budget-only', 'template-no-thinking'].includes(profile)) throw Error('Unknown profile');
if (!binary || !path.resolve(binary).startsWith(path.join(root, 'tools/bonsai/'))) {
  throw Error('Provide a verified llama-server path inside tools/bonsai');
}
await new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.once('error', reject);
  socket.listen(18794, '127.0.0.1', () => socket.close(resolve));
});
const out = path.join(root, 'artifacts', `bonsai-server-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const log = fs.openSync(path.join(out, 'server.log'), 'a');
const args = [
  '-m',
  path.join(root, 'tools/bonsai/models/Ternary-Bonsai-2-27B-PTQ1_0.gguf'),
  '--host',
  '127.0.0.1',
  '--port',
  '18794',
  '--alias',
  'bonsai-2-27b',
  '-ngl',
  '999',
  '-fa',
  'on',
  '-c',
  '8192',
  '--parallel',
  '1',
  '--temp',
  '1.0',
  '--top-p',
  '0.95',
  '--top-k',
  '20',
  '--seed',
  '42',
  '--jinja',
  '--reasoning-budget',
  '0',
  ...(profile === 'template-no-thinking' ? ['--chat-template-kwargs', '{"enable_thinking":false}'] : []),
];
const started = performance.now();
const child = spawn(binary, args, { stdio: ['ignore', log, log] });
const receipt = { binary, args, profile, pid: child.pid, output: out, startedAt: new Date().toISOString() };
console.log(JSON.stringify(receipt));
fs.writeFileSync(path.join(out, 'launch.json'), JSON.stringify(receipt, null, 2));
let exited = false;
child.on('error', (error) => {
  console.error(String(error));
  exited = true;
});
child.on('exit', (code, signal) => {
  exited = true;
  fs.writeFileSync(
    path.join(out, 'exit.json'),
    JSON.stringify({ code, signal, elapsedMs: performance.now() - started }),
  );
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill('SIGTERM'));
while (!exited && performance.now() - started < 120000) {
  try {
    const response = await fetch('http://127.0.0.1:18794/health', { signal: AbortSignal.timeout(1000) });
    if (response.ok) {
      const props = await fetch('http://127.0.0.1:18794/props', { signal: AbortSignal.timeout(1000) }).then((r) =>
        r.json(),
      );
      fs.writeFileSync(path.join(out, 'props.json'), JSON.stringify(props, null, 2));
      const ready = {
        ...receipt,
        readyMs: performance.now() - started,
        scope: 'One process startup; downloaded weights may be filesystem-cached',
      };
      fs.writeFileSync(path.join(out, 'ready.json'), JSON.stringify(ready, null, 2));
      console.log(JSON.stringify(ready));
      break;
    }
  } catch {
    /* Bounded readiness polling; no inference or mutation retries. */
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!fs.existsSync(path.join(out, 'ready.json'))) {
  child.kill('SIGTERM');
  throw Error('Bonsai startup failed or exceeded 120 seconds; inspect server.log');
}
