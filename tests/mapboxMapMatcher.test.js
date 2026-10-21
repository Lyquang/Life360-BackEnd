const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createMapboxMapMatcher } = require('../src/infrastructure/matching/MapboxMapMatcher');
const { encodePolyline6 } = require('../src/infrastructure/matching/FakeMapMatcher');
const { loadConfig, ConfigError } = require('../src/config/env');

const points = [0, 1, 2].map((index) => ({
  latitude: 10.7 + index * 0.001,
  longitude: 106.6 + index * 0.001,
  accuracy: 8,
  recordedAt: new Date(Date.UTC(2026, 9, 22, 8, 0, index * 10)),
}));
const geometry = encodePolyline6(points);
const tracepoints = points.map(() => ({ matchings_index: 0 }));

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('Mapbox matcher adapter', () => {
  it('requests polyline6 walking geometry with ordered timestamps and GPS radiuses', async () => {
    let request;
    const matcher = createMapboxMapMatcher({
      accessToken: 'test-secret',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return response({ code: 'Ok', matchings: [{ geometry, confidence: 0.9 }], tracepoints });
      },
    });
    const result = await matcher.matchWindow({ points, profile: 'walking' });
    assert.equal(result.matched, true);
    assert.equal(result.geometry, geometry);
    assert.equal(result.provider, 'mapbox');
    assert.match(request.url.pathname, /\/matching\/v5\/mapbox\/walking\//);
    assert.equal(request.url.searchParams.get('geometries'), 'polyline6');
    assert.equal(request.url.searchParams.get('overview'), 'full');
    assert.equal(request.url.searchParams.get('radiuses'), '8;8;8');
    assert.equal(request.url.searchParams.get('timestamps').split(';').length, points.length);
    assert.equal(request.options.method, 'GET');
  });

  it('never publishes a partial, ambiguous or low-confidence match', async () => {
    for (const body of [
      { code: 'NoMatch' },
      { code: 'Ok', matchings: [{ geometry, confidence: 0.5 }], tracepoints },
      { code: 'Ok', matchings: [{ geometry, confidence: 0.9 }], tracepoints: [tracepoints[0], null, tracepoints[2]] },
      { code: 'Ok', matchings: [{ geometry, confidence: 0.9 }, { geometry, confidence: 0.8 }], tracepoints },
    ]) {
      const matcher = createMapboxMapMatcher({ accessToken: 'test-secret', fetchImpl: async () => response(body) });
      assert.equal((await matcher.matchWindow({ points })).matched, false);
    }
  });

  it('omits nonascending timestamps, uses the driving profile and never leaks request URLs in errors', async () => {
    let url;
    const matcher = createMapboxMapMatcher({
      accessToken: 'test-secret',
      fetchImpl: async (request) => { url = request; return response({}, 429); },
    });
    await assert.rejects(matcher.matchWindow({
      points: points.map((point) => ({ ...point, recordedAt: points[0].recordedAt })), profile: 'driving',
    }), (error) => !error.message.includes('test-secret') && !error.message.includes('106.6'));
    assert.match(url.pathname, /\/driving\//);
    assert.equal(url.searchParams.has('timestamps'), false);
  });

  it('requires a token when map matching is enabled and rejects fake in production', () => {
    assert.throws(() => loadConfig({ JWT_SECRET: 'test', LIVE_TRAIL_MATCHER_PROVIDER: 'mapbox', LIVE_TRAIL_MATCHER_ENABLED: 'true' }), ConfigError);
    const config = loadConfig({ JWT_SECRET: 'test', LIVE_TRAIL_MATCHER_PROVIDER: 'mapbox', LIVE_TRAIL_MATCHER_ENABLED: 'true', MAPBOX_ACCESS_TOKEN: 'test-secret' });
    assert.equal(config.liveTrail.matcher.minConfidence, 0.6);
  });
});
