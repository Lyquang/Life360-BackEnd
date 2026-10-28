const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const mongoose = require('mongoose');
const { createMetrics } = require('../src/infrastructure/observability/metricsRegistry');
const { attachMongoMetricsObserver } = require('../src/infrastructure/database/mongoMetricsObserver');
const { instrumentMongoRepositories, operationClass } = require('../src/infrastructure/database/mongoRepositoryMetrics');
const { createUnitOfWork } = require('../src/infrastructure/database/unitOfWork');

test('Mongo pool observer counts only allowlisted driver events and detaches cleanly', async () => {
  const metrics = createMetrics({ enabled: true });
  const client = new EventEmitter();
  const detach = attachMongoMetricsObserver(client, metrics);
  client.emit('connectionPoolCreated');
  client.emit('connectionReady');
  client.emit('connectionCheckOutFailed');
  client.emit('commandStarted', { commandName: 'find', command: { secret: 'must-not-leak' } });
  detach();
  client.emit('connectionPoolReady');

  const { text } = await metrics.snapshot();
  assert.match(text, /familytracker_mongo_pool_events_total\{event="pool_created"\} 1/);
  assert.match(text, /familytracker_mongo_pool_events_total\{event="connection_ready"\} 1/);
  assert.match(text, /familytracker_mongo_pool_events_total\{event="checkout_failed"\} 1/);
  assert.doesNotMatch(text, /secret|must-not-leak|commandStarted/);
  assert.doesNotMatch(text, /event="ready"/);
  metrics.close();
});

test('repository instrumentation records bounded operation classes and preserves values/errors', async () => {
  const metrics = createMetrics({ enabled: true });
  const canary = 'sensitive-query-value';
  const repositories = {
    users: {
      findById: async (id) => ({ id }),
      insertBatchIdempotent: async () => { throw new Error(canary); },
      arbitraryMethod: () => 7,
    },
  };
  const measured = instrumentMongoRepositories(repositories, metrics);
  assert.notEqual(measured, repositories);
  assert.deepEqual(await measured.users.findById(canary), { id: canary });
  await assert.rejects(measured.users.insertBatchIdempotent(), new RegExp(canary));
  assert.equal(measured.users.arbitraryMethod(), 7);
  assert.equal(operationClass('listRangePage'), 'bulk_read');

  const { text } = await metrics.snapshot();
  assert.match(text, /familytracker_mongo_repository_operations_total\{operation="read",outcome="success"\} 1/);
  assert.match(text, /familytracker_mongo_repository_operations_total\{operation="bulk_write",outcome="error"\} 1/);
  assert.match(text, /familytracker_mongo_repository_operations_total\{operation="other",outcome="success"\} 1/);
  assert.match(text, /familytracker_mongo_repository_duration_seconds_count\{operation="read"\} 1/);
  assert.doesNotMatch(text, new RegExp(canary));
  metrics.close();
});

test('repository instrumentation is absent when metrics are disabled', () => {
  const repositories = { users: { findById: (id) => id } };
  assert.equal(instrumentMongoRepositories(repositories, createMetrics()).users, repositories.users);
});

test('unit of work records success, errors and standalone fallback without changing results', async () => {
  const metrics = createMetrics({ enabled: true });
  const originalTransaction = mongoose.connection.transaction;
  mongoose.connection.transaction = async (work) => work({ id: 'test-session' });
  try {
    const transactional = createUnitOfWork({ supportsTransactions: true, metrics });
    assert.equal(await transactional.run(async (session) => session.id), 'test-session');
    await assert.rejects(transactional.run(async () => { throw new Error('operation failed'); }), /operation failed/);

    const standalone = createUnitOfWork({ supportsTransactions: false, metrics, logger: { warn() {} } });
    assert.equal(await standalone.run(async (session) => session), null);
    const { text } = await metrics.snapshot();
    assert.match(text, /familytracker_mongo_transactions_total\{outcome="success"\} 1/);
    assert.match(text, /familytracker_mongo_transactions_total\{outcome="error"\} 1/);
    assert.match(text, /familytracker_mongo_transactions_total\{outcome="unsupported"\} 1/);
    assert.doesNotMatch(text, /operation failed|test-session/);
  } finally {
    mongoose.connection.transaction = originalTransaction;
    metrics.close();
  }
});
