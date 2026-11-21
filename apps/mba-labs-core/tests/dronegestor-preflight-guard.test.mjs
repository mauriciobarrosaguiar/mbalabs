import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreflightRequestGuard } from '../src/lib/dronegestor-preflight-guard.ts';
test('resposta antiga não libera missão após uma edição local', () => {
  let signature = 'OS-A:clima1';
  const guard = createPreflightRequestGuard(() => signature);
  const first = guard.begin(signature);
  signature = 'OS-A:clima2';
  assert.equal(guard.isCurrent(first), false);
  const second = guard.begin(signature);
  assert.equal(guard.isCurrent(second), true);
  assert.equal(guard.isCurrent(first), false);
});
test('respostas fora de ordem e troca de OS são descartadas', () => {
  let signature = 'OS-A';
  const guard = createPreflightRequestGuard(() => signature);
  const first = guard.begin(signature);
  const retry = guard.begin(signature);
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(retry), true);
  signature = 'OS-B';
  assert.equal(guard.isCurrent(retry), false);
  const next = guard.begin(signature);
  guard.invalidate();
  assert.equal(guard.isCurrent(next), false);
});
