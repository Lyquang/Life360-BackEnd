const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createMetrics } = require('../src/infrastructure/observability/metricsRegistry');
const { definitions, maximumSeries } = require('../src/infrastructure/observability/metricsPolicy');
const { loadConfig } = require('../src/config/env');

test('metrics are disabled by default and Noop never inspects sensitive input', async () => {
  assert.equal(loadConfig({ JWT_SECRET: randomUUID() }).metrics.enabled, false);
  const metrics = createMetrics();
  const badInput = new Proxy({}, { get() { throw new Error(); } });
  metrics.increment('http_requests_total', badInput);
  metrics.observe('http_request_duration_seconds', badInput, 1);
  assert.equal(metrics.enabled, false);
  assert.deepEqual(await metrics.snapshot(), { text: '', series: 0 });
});

test('unknown labels and forbidden fields cannot create unbounded series or expose input', async () => {
  const metrics = createMetrics({ enabled: true });
  const canary = randomUUID();
  for (let i = 0; i < 10000; i++) {
    metrics.increment('http_requests_total', { method: canary + i, route: canary + i, status_class: canary, userId: canary });
    metrics.observe('http_request_duration_seconds', { route: canary + i, token: canary }, 0.1);
    metrics.increment(canary, { route: canary });
  }
  const result = await metrics.snapshot();
  assert.equal(result.series, 9);
  assert.equal(result.text.includes(canary), false, 'Telemetry leaked canary');
  assert.equal(result.text.includes('userId'), false);
  assert.match(result.text, /familytracker_http_requests_total\{method="other",route="other",status_class="other"\} 10000/);
  metrics.close();
});

test('all approved HTTP label combinations stay within the reserved budget', async () => {
  const metrics = createMetrics({ enabled: true });
  const { method, route, status_class: statuses } = definitions.http_requests_total.labels;
  for (const r of route) {
    for (const m of method) for (const s of statuses) metrics.increment('http_requests_total', { route: r, method: m, status_class: s });
    metrics.observe('http_request_duration_seconds', { route: r }, 0.2);
    metrics.increment('http_rate_limited_total', { route: r });
  }
  const result = await metrics.snapshot();
  assert.ok(maximumSeries() <= 2500);
  assert.equal(result.series, 570);
  const lines = result.text.split('\n').filter(line => line && !line.startsWith('#'));
  assert.equal(lines.length, result.series);
  metrics.close();
});

test('hard cap, bad input and closure are fail-soft; registries remain isolated', async () => {
  const metrics = createMetrics({ enabled: true, maxSeries: 1 });
  metrics.observe('http_request_duration_seconds', { route: 'chat' }, 1);
  metrics.increment('http_requests_total', { route: 'chat' });
  metrics.increment('http_requests_total', { route: 'auth' });
  metrics.increment('http_requests_total', null);
  metrics.observe('http_request_duration_seconds', {}, NaN);
  metrics.increment('http_requests_total', {}, Infinity);
  metrics.increment('http_requests_total', new Proxy({}, { get() { throw new Error(); } }));
  assert.equal((await metrics.snapshot()).series, 1);
  const second = createMetrics({ enabled: true });
  assert.equal((await second.snapshot()).series, 0);
  metrics.close();
  metrics.increment('http_requests_total', {});
  assert.equal((await metrics.snapshot()).text, '');
  metrics.close();
  second.close();
});
