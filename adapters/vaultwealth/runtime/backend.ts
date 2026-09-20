import { getResponse } from 'msw';
import { createServer } from 'node:http';
import { DEMO_SEED } from '../../src/mocks/demo-seed';
import handlers from '../../src/mocks/handlers';
import * as polaris from '../../src/mocks/polaris';

let fault = 'clean';
let writes: unknown[] = [];
let requests: unknown[] = [];
let cacheResetEpoch: string | null = null;
const reset = () => {
  polaris.__resetPolarisMockState();
  polaris.__seedPolarisAssets(DEMO_SEED.assets);
  polaris.__seedPolarisGoals(DEMO_SEED.goals);
  polaris.__seedPolarisProfile(DEMO_SEED.profile);
  writes = [];
  requests = [];
  cacheResetEpoch = null;
};
reset();

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  const send = (data: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  if (req.method === 'OPTIONS') return send({});
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const url = new URL(req.url!, 'http://127.0.0.1:18791');
    if (url.pathname === '/health') return send({ ready: true, kind: 'isolated-fixture-backend', fault });
    if (url.pathname === '/api/experiment/ping')
      return send({ kind: 'vault-testing-fixture', nonce: url.searchParams.get('nonce') });
    if (url.pathname === '/reset' && req.method === 'POST') {
      const next = JSON.parse(body || '{}').fault ?? 'clean';
      if (!['clean', 'save-fails', 'wrong-value', 'stale-search', 'duplicate', 'clipped'].includes(next)) {
        return send({ error: 'Unknown fault' }, 400);
      }
      reset();
      fault = next;
      return send({ ready: true });
    }
    if (url.pathname === '/cache-reset/ack' && req.method === 'POST') {
      cacheResetEpoch = url.searchParams.get('epoch');
      return send({ ready: true });
    }
    if (url.pathname === '/state')
      return send({ state: polaris.loadPolarisState(), writes, requests, cacheResetEpoch });
    const authenticated = req.headers.authorization === 'Bearer mock-login-token-final';
    if ((url.pathname.startsWith('/api/v1/polaris/') || url.pathname === '/api/user/v1/account') && !authenticated) {
      requests.push({ method: req.method, path: url.pathname, status: 401, authenticated: false, ms: 0 });
      return send({ error: 'Fixture session required' }, 401);
    }
    const isWrite = req.method === 'POST' && url.pathname.endsWith('/assets');
    const started = performance.now();
    let payload = body;
    if (isWrite) {
      writes.push(JSON.parse(body));
      if (fault === 'save-fails') return send({ message: 'Success', data: [] });
      if (fault === 'wrong-value') {
        const data = JSON.parse(body);
        for (const asset of data.assets ?? []) if (asset.meta?.amount !== undefined) asset.meta.amount = 1;
        payload = JSON.stringify(data);
      }
    }
    if (fault === 'stale-search' && url.pathname.endsWith('/assets/search')) url.searchParams.set('query', 'VOO');
    const request = () =>
      new Request(url, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization ?? '' },
        ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: payload } : {}),
      });
    const response = await getResponse(handlers, request());
    if (!response) return send({ error: `No fixture for ${req.method} ${url.pathname}` }, 501);
    if (isWrite && fault === 'duplicate') {
      await getResponse(handlers, request());
      writes.push(JSON.parse(payload));
    }
    const authStage = url.pathname.endsWith('/auth/login')
      ? JSON.parse(body).otp
        ? 'otp'
        : JSON.parse(body).password
          ? 'password'
          : 'email'
      : undefined;
    requests.push({
      query: new URL(req.url!, 'http://127.0.0.1:18791').searchParams.get('query'),
      servedQuery: url.searchParams.get('query'),
      method: req.method,
      path: url.pathname,
      status: response.status,
      authenticated,
      authStage,
      ms: performance.now() - started,
    });
    res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') ?? 'application/json' });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    send({ error: String(error) }, 500);
  }
}).listen(18791, '127.0.0.1', () => console.log('Fixture backend ready: http://127.0.0.1:18791'));
