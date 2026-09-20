#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const adapterRoot = path.dirname(fileURLToPath(import.meta.url));
const runtimeSource = path.join(adapterRoot, 'runtime');
const patchPath = path.join(adapterRoot, 'patches', 'app-hooks.patch');

function usage() {
  console.error('Usage: node adapters/vaultwealth/prepare.mjs <check|apply> --target <clean-worktree>');
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function git(target, args, options = {}) {
  return execFileSync('git', ['-C', target, ...args], {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function preflight(target) {
  if (!existsSync(target)) throw new Error(`target does not exist: ${target}`);
  const root = realpathSync(git(target, ['rev-parse', '--show-toplevel']));
  if (root !== target) throw new Error(`target must be the worktree root: ${root}`);
  const remote = git(target, ['remote', 'get-url', 'origin']);
  if (!/vaultwealth-ltd\/webapp(?:\.git)?$/.test(remote)) throw new Error('target is not vaultwealth-ltd/webapp');
  const branch = git(target, ['branch', '--show-current']);
  if (!branch || branch === 'main' || branch === 'master') {
    throw new Error('target must be a named non-main experiment branch');
  }
  if (git(target, ['status', '--porcelain', '--untracked-files=all'])) {
    throw new Error('target worktree must be clean');
  }
  const runtimeTarget = path.join(target, 'local-agent-eval', 'fast-testing');
  if (existsSync(runtimeTarget)) throw new Error(`refusing to overwrite existing runtime: ${runtimeTarget}`);
  execFileSync('git', ['-C', target, 'apply', '--check', patchPath], { stdio: 'pipe' });
  return { branch, runtimeTarget };
}

const mode = process.argv[2];
const rawTarget = argument('--target');
if (!['check', 'apply'].includes(mode) || !rawTarget) {
  usage();
  process.exit(2);
}

try {
  const target = realpathSync(path.resolve(rawTarget));
  const { branch, runtimeTarget } = preflight(target);
  if (mode === 'apply') {
    execFileSync('git', ['-C', target, 'apply', patchPath], { stdio: 'inherit' });
    cpSync(runtimeSource, runtimeTarget, { recursive: true, errorOnExist: true, force: false });
  }
  const provenance = JSON.parse(readFileSync(path.join(adapterRoot, 'provenance.json'), 'utf8'));
  console.log(
    JSON.stringify(
      {
        status: mode === 'apply' ? 'prepared' : 'compatible',
        target,
        branch,
        sourceCommit: provenance.sourceCommit,
        runtimeTarget: mode === 'apply' ? runtimeTarget : null,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`vaultwealth adapter: ${error.message}`);
  process.exit(1);
}
