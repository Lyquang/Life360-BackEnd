const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMetrics } = require('../src/infrastructure/observability/metricsRegistry');
const { createSocketMeasurement } = require('../src/presentation/socket/socketMetrics');
const { startTestServer, emitWithAck } = require('./helpers/testServer');

test('Socket measurement preserves result/error when monitoring fails', async () => {
  const fail = () => { throw new Error('metrics failure'); };
  const measure = createSocketMeasurement({ enabled: true, increment: fail, observe: fail });
  assert.equal(await measure('update_location', async () => 42), 42);
  const error = new Error('business failure');
  await assert.rejects(measure('update_location', async () => { throw error; }), e => e === error);
});

test('Socket metrics use bounded labels even with arbitrary event names', async () => {
  const metrics = createMetrics({ enabled: true });
  const measure = createSocketMeasurement(metrics);
  for (let i = 0; i < 1000; i++) await measure(`private-${i}`, async mark => mark('private-outcome'));
  const result = await metrics.snapshot();
  assert.equal(result.series, 9);
  assert.doesNotMatch(result.text, /private-/);
  metrics.close();
});

test('real Socket rejection is counted and connection gauges follow disconnect', async t => {
  const bearer = 'isolated-metrics-test-bearer-32bytes-long';
  const server = await startTestServer({ env: { METRICS_ENABLED: 'true', METRICS_TOKEN: bearer } });
  t.after(() => server.stop());
  const user = await server.registerUser('Metrics');
  const socket = await server.connect(user.token);
  const ack = await emitWithAck(socket, 'chat:send_message', {});
  assert.equal(ack.success, false);
  const scrape = async () => (await fetch(server.baseUrl + '/metrics', { headers: { Authorization: `Bearer ${bearer}` } })).text();
  let text = await scrape();
  assert.match(text, /socket_actions_total\{event="chat:send_message",outcome="rejected"\} 1/);
  assert.match(text, /socket_action_duration_seconds_count\{event="chat:send_message"\} 1/);
  assert.match(text, /socket_connections\{scope="default"\} 1/);
  assert.doesNotMatch(text, new RegExp(user.id));
  await server.disconnect(socket);
  text = await scrape();
  assert.match(text, /socket_connections\{scope="default"\} 0/);
});
