const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { startSosOutboxScheduler } = require('../src/presentation/jobs/sosOutboxScheduler');
const { loadConfig: parseConfig } = require('../src/config/env');
const loadConfig = (env) => parseConfig({ JWT_SECRET: 'synthetic-sos-worker-test-secret', ...env });
const { createContainer } = require('../src/container');

async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Scheduler test timed out.');
    await delay(5);
  }
}

test('SOS worker config is opt-in and validates bounds', () => {
  assert.equal(loadConfig({}).sosOutbox.enabled, false);
  assert.equal(loadConfig({ SOS_OUTBOX_ENABLED: 'true' }).sosOutbox.batchSize, 20);
  for (const env of [
    { SOS_OUTBOX_BATCH_SIZE: '0' }, { SOS_OUTBOX_POLL_MS: '1' },
    { SOS_OUTBOX_MAX_ATTEMPTS: '21' }, { SOS_OUTBOX_RETRY_BASE_MS: '2000', SOS_OUTBOX_RETRY_MAX_MS: '1000' },
  ]) assert.throws(() => loadConfig(env));
});

test('SOS worker is absent by default and composed only when enabled', async () => {
  for (const enabled of ['false', 'true']) {
    const container = createContainer({ config: loadConfig({ SOS_OUTBOX_ENABLED: enabled }), io: {}, supportsTransactions: true });
    assert.equal(Boolean(container.services.sosOutboxDispatcher), enabled === 'true');
    await container.services.liveTrailMatchingService.close();
    container.services.liveTrailDeltaPublisher.close();
  }
});

test('disabled scheduler never claims and can stop repeatedly', async () => {
  let calls = 0;
  const worker = startSosOutboxScheduler({ dispatcher: { dispatchNext: () => { calls++; } }, policy: { enabled: false } });
  await worker.stop(); await worker.stop();
  assert.equal(calls, 0);
});

test('scheduler drains in-flight delivery on stop without claiming another job', async () => {
  let calls = 0, release;
  const worker = startSosOutboxScheduler({
    policy: { enabled: true, pollMs: 5, batchSize: 20 },
    dispatcher: { dispatchNext: async () => { calls++; return new Promise((resolve) => { release = resolve; }); } },
  });
  try {
    await waitFor(() => release);
    await delay(20);
    assert.equal(calls, 1);
    let stopped = false;
    const stopping = worker.stop().then(() => { stopped = true; });
    await delay(5);
    assert.equal(stopped, false);
    release({ status: 'delivered' });
    await stopping;
    await delay(15);
    assert.equal(calls, 1);
  } finally {
    release?.({ status: 'delivered' });
    await worker.stop();
  }
});

test('scheduler bounds cycles, recovers from DB errors and logs only codes', async () => {
  const logs = [];
  let calls = 0;
  const worker = startSosOutboxScheduler({
    policy: { enabled: true, pollMs: 10, batchSize: 2 },
    logger: { error: (...args) => logs.push(args) },
    dispatcher: { dispatchNext: async () => {
      calls++;
      if (calls === 1) throw new Error('private database URI');
      return { status: calls === 2 ? 'failed' : 'idle' };
    } },
  });
  try {
    await waitFor(() => calls >= 3);
    assert.deepEqual(logs, [['SOS_OUTBOX_CYCLE_FAILED'], ['SOS_OUTBOX_DELIVERY_EXHAUSTED']]);
  } finally { await worker.stop(); }
});
