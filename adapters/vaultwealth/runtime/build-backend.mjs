import { build } from 'esbuild';
await build({
  entryPoints: ['local-agent-eval/fast-testing/backend.ts'],
  outfile: 'local-agent-eval/fast-testing/artifacts/backend.cjs',
  platform: 'node',
  format: 'cjs',
  bundle: true,
  packages: 'external',
  tsconfig: 'tsconfig.json',
  banner: {
    js: 'globalThis.window = globalThis; globalThis.location = {search: ""}; globalThis.__e2eMockLatencyMs = 100;',
  },
  define: { 'process.env.EXPO_PUBLIC_MOCK_INVESTED': '"1"' },
});
