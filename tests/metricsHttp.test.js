const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const http = require('node:http');
const { gunzipSync } = require('node:zlib');
const express = require('express');
const { startTestServer } = require('./helpers/testServer');
const { createMetrics } = require('../src/infrastructure/observability/metricsRegistry');
const { createMetricsMiddleware } = require('../src/presentation/http/middleware/metrics');
const { loadConfig } = require('../src/config/env');

function rawGet(url, headers) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

test('real server exposes private gzip metrics without CORS, secrets, IDs or Swagger paths', async t => {
  const token = randomBytes(32).toString('hex');
  const server = await startTestServer({ env: { METRICS_ENABLED: 'true', METRICS_TOKEN: token } });
  t.after(() => server.stop());
  const url = server.baseUrl + '/metrics';
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url + '?token=' + token)).status, 401);
  assert.equal((await fetch(url, { method: 'OPTIONS' })).status, 405);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const canary = randomBytes(16).toString('hex');
  for (let i = 0; i < 50; i++) await fetch(server.baseUrl + '/api/v1/history/' + canary + i + '/missing');
  await fetch(server.baseUrl + '/api/v1/auth/me');
  const swagger = await (await fetch(server.baseUrl + '/api-docs.json')).json();
  assert.equal(Object.hasOwn(swagger.paths, '/metrics'), false);
  const headers = { Authorization: `Bearer ${token}`, Origin: 'https://example.invalid', 'Accept-Encoding': 'gzip' };
  const response = await rawGet(url, headers);
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-encoding'], 'gzip');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  const plain = gunzipSync(response.bytes);
  const text = plain.toString();
  assert.equal(text.includes(token) || text.includes(canary), false, 'Private input reached metrics');
  assert.match(text, /route="unmatched"/);
  assert.match(text, /route="auth"/);
  assert.match(text, /familytracker_process_resident_memory_bytes /);
  assert.match(text, /familytracker_event_loop_delay_p99_seconds /);
  const lines = text.split('\n').filter(line => line && !line.startsWith('#'));
  assert.ok(lines.length <= 2500);
  t.diagnostic(JSON.stringify({ fixture: '50 unmatched + auth + swagger', series: lines.length, plainBytes: plain.length, gzipBytes: response.bytes.length }));
  const identity = await rawGet(url, { ...headers, 'Accept-Encoding': 'gzip;q=0, identity;q=1' });
  assert.equal(identity.headers['content-encoding'], undefined);
  assert.equal(identity.status, 200);
  for (let i = 0; i < 8; i++) assert.equal((await rawGet(url, headers)).status, 200);
  const limited = await rawGet(url, headers);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers['retry-after']) > 0);
});

test('disabled endpoint stays hidden and enabled config requires its own bearer', async t => {
  assert.throws(() => loadConfig({ JWT_SECRET: 'test', METRICS_ENABLED: 'true' }));
  const sharedSecret = randomBytes(32).toString('hex');
  assert.throws(() => loadConfig({ JWT_SECRET: sharedSecret, METRICS_ENABLED: 'true', METRICS_TOKEN: sharedSecret }));
  const server = await startTestServer();
  t.after(() => server.stop());
  const response = await fetch(server.baseUrl + '/metrics');
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('observer exceptions do not change application responses; failed scrape returns 503', async t => {
  const app = express();
  const fail = () => { throw new Error('synthetic'); };
  app.use(createMetricsMiddleware({ enabled: true, increment: fail, observe: fail, snapshot: fail }, 'test'));
  app.get('/ok', (req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(base + '/ok')).json(), { ok: true });
  assert.equal((await fetch(base + '/metrics', { headers: { Authorization: 'Bearer test' } })).status, 503);
});

test('runtime observers close idempotently and series accounting includes all runtime gauges', async () => {
  const metrics = createMetrics({ enabled: true, runtime: true });
  const snapshot = await metrics.snapshot();
  assert.equal(snapshot.series, 16);
  assert.equal(snapshot.text.split('\n').filter(line => line && !line.startsWith('#')).length, 16);
  metrics.close();
  metrics.close();
  assert.equal((await metrics.snapshot()).series, 0);
});
