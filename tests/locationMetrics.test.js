const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createMetrics } = require('../src/infrastructure/observability/metricsRegistry');
const { createSocketRealtime } = require('../src/infrastructure/realtime/socketRealtime');
const { createSafeMetrics } = require('../src/application/ports/metrics');
const { startTestServer } = require('./helpers/testServer');
const { createLiveTrailDeltaPublisher } = require('../src/application/location/liveTrailDeltaPublisher');

test('payload metrics sample every tenth emit, exposing only byte lengths', async () => {
  const metrics = createMetrics({ enabled: true });
  const io = { to: () => ({ emit() {} }) };
  const realtime = createSocketRealtime(io, metrics);
  let serialized = 0;
  const payload = { toJSON() { serialized++; return { secret: 'private-location-canary' }; } };
  for (let i = 0; i < 25; i++) realtime.emitToUser('private-user', 'private-event', payload);
  assert.equal(serialized, 2);
  const snapshot = await metrics.snapshot();
  assert.match(snapshot.text, /realtime_payload_bytes_count\{channel="user"\} 2/);
  assert.doesNotMatch(snapshot.text, /private-location-canary|private-user|private-event/);
  const disabled = createSocketRealtime(io, createMetrics());
  for (let i = 0; i < 20; i++) disabled.emitToUser('u', 'e', payload);
  assert.equal(serialized, 2);
  metrics.close();
});

test('monitoring failures are swallowed, including timer-driven publication errors', async () => {
  const fail = () => { throw new Error('synthetic'); };
  const safe = createSafeMetrics({ enabled: true, increment: fail, observe: fail, set: fail, addCollector: fail });
  assert.doesNotThrow(() => { safe.increment('x'); safe.observe('x'); safe.set('x'); safe.addCollector(fail); });
  const metrics = createMetrics({ enabled: true });
  const publisher = createLiveTrailDeltaPublisher({
    metrics, logger: { error() {} }, realtime: { emitToLiveTrail: fail },
    policy: { deltaFlushMs: 5, deltaMaxPoints: 10, deltaMaxBytes: 65536 },
  });
  try {
    publisher.publishRealtime({ userId: 'u', projection: { results: [{ trailId: 't', revision: 1, afterSeq: 0,
      inserted: [{ seq: 1, latitude: 1, longitude: 1, recordedAt: new Date() }] }] } });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.match((await metrics.snapshot()).text, /trail_publication_errors_total\{operation="flush"\} 1/);
  } finally { publisher.close(); metrics.close(); }
});

test('real offline batch metrics agree with partial response and repeated submission', async t => {
  const bearer = 'location-business-metrics-test-bearer';
  const server = await startTestServer({ env: { METRICS_ENABLED: 'true', METRICS_TOKEN: bearer } });
  t.after(() => server.stop());
  const user = await server.registerUser('LocationMetrics');
  const point = { pointId: randomUUID(), latitude: 10, longitude: 106, recordedAt: new Date().toISOString() };
  const body = { points: [point, { ...point, pointId: randomUUID(), latitude: 999 }] };
  const first = await server.api('POST', '/api/v1/locations/batch', { token: user.token, body });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.accepted.length, 1);
  assert.equal(first.body.data.rejected.length, 1);
  const second = await server.api('POST', '/api/v1/locations/batch', { token: user.token, body });
  assert.equal(second.body.data.duplicates.length, 1);
  const text = await (await fetch(server.baseUrl + '/metrics', { headers: { Authorization: `Bearer ${bearer}` } })).text();
  assert.match(text, /location_batch_points_total\{outcome="accepted"\} 1/);
  assert.match(text, /location_batch_points_total\{outcome="duplicates"\} 1/);
  assert.match(text, /location_batch_points_total\{outcome="rejected"\} 2/);
  assert.doesNotMatch(text, new RegExp(point.pointId));
});
