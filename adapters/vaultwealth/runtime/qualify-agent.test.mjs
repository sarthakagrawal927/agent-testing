import assert from 'node:assert/strict';
import test from 'node:test';
import { qualifyAgent } from './qualify-agent.mjs';
const result = { exit: 0, timedOut: false, functional: 'passed', invalidRejected: true, fault: 'clean' };
const answer = {
  status: 'passed',
  accountAndDestinationVerified: true,
  invalidCredentialsRejected: true,
  visualDefects: [],
  screenshotsInspected: ['initial.png', 'final.png'],
  recoveryCount: 0,
};
test('requires all functional, process and visual checkpoints', () => {
  assert(qualifyAgent(result, answer, 0));
  for (const patch of [{ exit: 1 }, { timedOut: true }, { functional: 'failed' }, { invalidRejected: false }])
    assert(!qualifyAgent({ ...result, ...patch }, answer, 0));
  assert(!qualifyAgent(result, { ...answer, screenshotsInspected: [] }, 0));
  assert(!qualifyAgent(result, { ...answer, status: 'blocked' }, 0));
  assert(!qualifyAgent(result, answer, 2));
});
test('a hidden clipped fault needs a relevant visual report', () => {
  assert(!qualifyAgent({ ...result, fault: 'clipped' }, answer, 0));
  assert(qualifyAgent({ ...result, fault: 'clipped' }, { ...answer, visualDefects: ['Continue is clipped'] }, 1));
});
