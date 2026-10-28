const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { createServer } = require('node:http');
const { createRequestContext } = require('../src/presentation/http/middleware/requestContext');
const { createSafeLogger } = require('../src/infrastructure/observability/safeLogger');
const { getLogContext } = require('../src/infrastructure/observability/logContext');
const { startTestServer } = require('./helpers/testServer');

test('HTTP context ignores inbound IDs and emits bounded, correlated JSON logs', async () => {
  const lines = [];
  const logger = createSafeLogger({ destination: { write(line) { lines.push(JSON.parse(line)); } } });
  const app = express();
  app.use(createRequestContext(logger));
  app.get('/api/v1/auth/probe', async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, 5));
    res.json({ requestId: getLogContext().requestId });
  });
  app.get('/metrics', (req, res) => res.sendStatus(401));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const requests = await Promise.all([
      fetch(`${baseUrl}/api/v1/auth/probe?secret=do-not-log`, { headers: { 'X-Request-Id': 'spoofed-secret' } }),
      fetch(`${baseUrl}/api/v1/auth/probe?secret=also-private`),
      fetch(`${baseUrl}/metrics`),
    ]);
    const ids = requests.map(response => response.headers.get('x-request-id'));
    assert.equal(new Set(ids).size, 3);
    ids.forEach(id => assert.match(id, /^[0-9a-f]{32}$/));
    assert.equal((await requests[0].json()).requestId, ids[0]);
    assert.equal((await requests[1].json()).requestId, ids[1]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(lines.length, 3);
    assert.deepEqual(new Set(lines.map(line => line.requestId)), new Set(ids));
    assert.ok(lines.every(line => line.msg === 'HTTP_REQUEST_COMPLETED'));
    assert.deepEqual(lines.map(line => line.route).sort(), ['auth', 'auth', 'system']);
    assert.equal(lines.find(line => line.route === 'system').statusCode, 401);
    assert.ok(lines.every(line => Number.isInteger(line.durationMs)));
    assert.doesNotMatch(JSON.stringify(lines), /spoofed-secret|do-not-log|also-private/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('real HTTP server returns a generated ID for health and protected metrics', async () => {
  const fixture = await startTestServer({ withStorage: false });
  try {
    const health = await fetch(`${fixture.baseUrl}/api/health`, { headers: { 'X-Request-Id': 'client-value' } });
    const metrics = await fetch(`${fixture.baseUrl}/metrics`);
    const healthId = health.headers.get('x-request-id');
    const metricsId = metrics.headers.get('x-request-id');
    assert.match(healthId, /^[0-9a-f]{32}$/);
    assert.match(metricsId, /^[0-9a-f]{32}$/);
    assert.notEqual(healthId, metricsId);
    assert.equal(metrics.status, 404);
  } finally {
    await fixture.stop();
  }
});
