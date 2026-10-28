const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createSafeLogger } = require('../src/infrastructure/observability/safeLogger');
const { newRequestId, newConnectionId, withLogContext } = require('../src/infrastructure/observability/logContext');
const { assertLogger } = require('../src/application/ports/logger');
const { createUnitOfWork } = require('../src/infrastructure/database/unitOfWork');

function capture() {
  let output = '';
  const destination = { write(line) { output += line; } };
  return { destination, lines: () => output.trim().split('\n').filter(Boolean).map(JSON.parse), raw: () => output };
}

test('nested secrets, Error, arrays, cycles, and untrusted message never leave the logger', () => {
  const output = capture();
  const logger = assertLogger(createSafeLogger({ destination: output.destination }));
  const canary = randomBytes(32).toString('hex');
  const nested = { email: canary, token: canary, coordinates: [canary], body: { password: canary } };
  nested.loop = nested;
  const error = new Error(canary);
  error.data = nested;
  logger.error(`Invalid token ${canary}`, { userId: canary, latitude: 12.345678, nested, err: error, message: canary, route: '/history/' + canary });
  logger.warn('REDIS_OPERATION_FAILED', { errorCode: canary, count: 2 });
  logger.error('SENSITIVE_SECRET_CANARY');
  const lines = output.lines();
  assert.equal(lines.length, 3);
  assert.equal(lines[0].msg, 'UNCLASSIFIED_EVENT');
  assert.equal(lines[1].msg, 'REDIS_OPERATION_FAILED');
  assert.equal(lines[1].count, 2);
  assert.equal(lines[2].msg, 'UNCLASSIFIED_EVENT');
  assert.equal(output.raw().includes(canary), false, 'Sensitive canary leaked');
  for (const forbidden of ['latitude', 'coordinates', 'token', 'password', 'email', 'userId']) {
    assert.equal(output.raw().includes(`"${forbidden}"`), false);
  }
});

test('generated correlation IDs stay inside concurrent async contexts', async () => {
  const output = capture();
  const logger = createSafeLogger({ destination: output.destination });
  const ids = [newRequestId(), newRequestId()];
  assert.notEqual(ids[0], ids[1]);
  await Promise.all(ids.map(requestId => withLogContext({ requestId, connectionId: newConnectionId(), route: 'auth' }, async () => {
    await new Promise(resolve => setImmediate(resolve));
    logger.log('AUTH_LOGIN_SUCCEEDED', { statusCode: 200, durationMs: 2.6, route: 'auth' });
  })));
  const lines = output.lines();
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map(line => line.requestId).sort(), ids.sort());
  assert.ok(lines.every(line => line.route === 'auth' && line.durationMs === 3));
});

test('malformed metadata and thrown property getters fail closed', () => {
  const output = capture();
  const logger = createSafeLogger({ destination: output.destination });
  const bad = new Proxy({}, { ownKeys() { throw new Error('synthetic'); } });
  assert.doesNotThrow(() => logger.error('SAFE_EVENT', bad));
  logger.log('SAFE_EVENT', { event: 'update_location', route: 'history', statusCode: 999, count: Infinity });
  const lines = output.lines();
  assert.equal(lines.at(-1).event, 'update_location');
  assert.equal(lines.at(-1).statusCode, undefined);
});

test('auth, cache and database event codes retain meaning without leaking details', async () => {
  const output = capture();
  const logger = createSafeLogger({ destination: output.destination });
  const codes = [
    'REDIS_CONNECTED', 'DATABASE_IN_MEMORY_FALLBACK_STARTED',
    'AUTH_BLACKLIST_UNAVAILABLE', 'GROUP_REALTIME_CLEANUP_FAILED',
  ];
  for (const code of codes) {
    logger.warn(code, { userId: 'private-user', errorName: 'private-error', uri: 'private-uri' });
  }
  const unitOfWork = createUnitOfWork({ supportsTransactions: false, logger });
  assert.equal(await unitOfWork.run(async () => 1), 1);
  assert.equal(await unitOfWork.run(async () => 2), 2);
  assert.deepEqual(output.lines().map(line => line.msg), [...codes, 'DATABASE_TRANSACTIONS_UNAVAILABLE']);
  assert.doesNotMatch(output.raw(), /private-user|private-error|private-uri/);
});
