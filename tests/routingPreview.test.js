const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createTomtomRoutingV1 } = require('../src/infrastructure/maps/tomtomRoutingV1');
const { createRoutingUseCases } = require('../src/application/routing/routingUseCases');
const { createRoutingRoutes } = require('../src/presentation/http/routes/routingRoutes');
const { createRoutingController } = require('../src/presentation/http/controllers/routingController');
const { createErrorHandler } = require('../src/presentation/http/middleware/errorHandler');
const { createRoutingPreviewLimiter } = require('../src/presentation/http/middleware/rateLimiter');
const { startTestServer } = require('./helpers/testServer');

const origin = { latitude: 21.0285, longitude: 105.8542 };
const destination = { latitude: 21.0368, longitude: 105.8342 };
const request = { origin, destination, travelMode: 'motorcycle' };
const payload = {
  routes: [{
    summary: { lengthInMeters: 1234, travelTimeInSeconds: 200, trafficDelayInSeconds: 40 },
    legs: [{ points: [origin, { latitude: 21.03, longitude: 105.85 }, destination] }],
    guidance: { instructions: [
      { pointIndex: 0, routeOffsetInMeters: 0, maneuver: 'DEPART', street: 'Road' },
      { pointIndex: 1, routeOffsetInMeters: 500, maneuver: 'TURN_RIGHT' },
      { pointIndex: 2, routeOffsetInMeters: 1234, maneuver: 'ARRIVE' },
    ] },
    sections: [
      { sectionType: 'TRAVEL_MODE', startPointIndex: 0, endPointIndex: 1, travelMode: 'motorcycle' },
      { sectionType: 'TRAVEL_MODE', startPointIndex: 1, endPointIndex: 2, travelMode: 'other' },
    ],
  }],
};

function response(status, body) {
  return { status, ok: status >= 200 && status < 300,
    headers: { get: () => null }, text: async () => JSON.stringify(body) };
}

test('TomTom adapter maps modes and retains actual other spans', async () => {
  const calls = [];
  const provider = createTomtomRoutingV1({ apiKey: 'test-only', fetchImpl: async (url) => {
    calls.push(url);
    return response(200, payload);
  } });
  const motorcycle = (await provider.calculate(request))[0];
  assert.deepEqual(motorcycle.modeSections.map((s) => s.travelMode), ['motorcycle', 'other']);
  assert.equal(motorcycle.maneuvers[1].code, 'TURN_RIGHT');
  assert.equal(motorcycle.traffic.status, 'provider_reported');
  assert.equal(calls[0].searchParams.get('travelMode'), 'motorcycle');
  assert.equal(calls[0].searchParams.get('instructionsType'), 'coded');
  const walking = (await provider.calculate({ ...request, travelMode: 'walking' }))[0];
  assert.equal(calls[1].searchParams.get('travelMode'), 'pedestrian');
  assert.equal(walking.traffic.status, 'unavailable');
  assert.equal(walking.traffic.delaySeconds, null);
});

test('TomTom adapter rejects invalid/oversized routes and never fabricates geometry', async () => {
  for (const body of [
    { routes: [{ ...payload.routes[0], legs: [{ points: [origin] }] }] },
    { routes: [{ ...payload.routes[0], guidance: { instructions: [{ pointIndex: 999, routeOffsetInMeters: 0, maneuver: 'DEPART' }] } }] },
    { routes: Array(4).fill(payload.routes[0]) },
  ]) {
    const provider = createTomtomRoutingV1({ apiKey: 'test-only', fetchImpl: async () => response(200, body) });
    await assert.rejects(() => provider.calculate(request), { kind: 'unavailable' });
  }
  const quota = createTomtomRoutingV1({ apiKey: 'test-only', fetchImpl: async () => response(429, {}) });
  await assert.rejects(() => quota.calculate(request), { kind: 'quota' });
  const noRoute = createTomtomRoutingV1({ apiKey: 'test-only', fetchImpl: async () =>
    response(400, { detailedError: { code: 'NO_ROUTE_FOUND' } }) });
  await assert.rejects(() => noRoute.calculate(request), { kind: 'no_route' });
});

test('routing use case distinguishes no route, quota and missing provider', async () => {
  assert.equal((await createRoutingUseCases({ provider: { calculate: async () => [] } }).preview(request)).reason, 'no_route');
  await assert.rejects(() => createRoutingUseCases({ provider: null }).preview(request),
    { status: 503, code: 'ROUTE_UNAVAILABLE' });
  await assert.rejects(() => createRoutingUseCases({ provider: { calculate: async () => {
    const error = new Error('quota'); error.kind = 'quota'; throw error;
  } } }).preview(request), { status: 429, code: 'ROUTE_QUOTA_EXCEEDED' });
});

test('HTTP preview requires auth, validates mode/points and applies per-user budget', async () => {
  let providerCalls = 0;
  const app = express();
  app.use(express.json());
  const routing = createRoutingUseCases({ provider: { calculate: async () => { providerCalls += 1; return []; } } });
  const authenticate = (req, res, next) => {
    if (req.headers.authorization !== 'Bearer test') return res.status(401).json({ code: 'UNAUTHORIZED' });
    req.user = { _id: 'test-user' };
    next();
  };
  app.use('/api/v1/routes', createRoutingRoutes({
    controller: createRoutingController({ routing }), authenticate,
    limiter: createRoutingPreviewLimiter(3),
  }));
  app.use(createErrorHandler({ isProduction: true, logger: { error() {} } }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1/routes/preview`;
  async function post(body, token = 'test') {
    const result = await fetch(base, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
      body: JSON.stringify(body) });
    return { status: result.status, body: await result.json() };
  }
  try {
    assert.equal((await post(request, null)).status, 401);
    assert.equal((await post({ ...request, travelMode: 'driving' })).status, 400);
    assert.equal((await post({ ...request, destination: origin })).status, 400);
    assert.equal((await post(request)).status, 200);
    assert.equal((await post(request)).status, 429);
    assert.equal(providerCalls, 1);
  } finally {
    server.close();
  }
});

test('mounted API uses real JWT and fails closed without a provider key', { timeout: 120000 }, async () => {
  const server = await startTestServer({ env: { TOMTOM_ROUTING_API_KEY: '' } });
  try {
    const user = await server.registerUser('RouteTester');
    const path = '/api/v1/routes/preview';
    assert.equal((await server.api('POST', path, { body: request })).status, 401);
    assert.equal((await server.api('POST', path, { token: user.token,
      body: { ...request, travelMode: 'driving' } })).status, 400);
    const unavailable = await server.api('POST', path, { token: user.token, body: request });
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.body.code, 'ROUTE_UNAVAILABLE');
  } finally {
    await server.stop();
  }
});
