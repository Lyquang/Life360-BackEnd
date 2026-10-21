const VERSION = 'mapbox-matching-v5';
const API_ORIGIN = 'https://api.mapbox.com';
const PROFILE = { walking: 'walking', running: 'walking', cycling: 'cycling', automotive: 'driving', driving: 'driving', auto: 'walking' };

function unmatched() {
  return { matched: false, provider: 'mapbox', version: VERSION };
}

function validPoint(point) {
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

function createMapboxMapMatcher({ accessToken, fetchImpl = globalThis.fetch, minConfidence = 0.6, origin = API_ORIGIN } = {}) {
  if (!accessToken || typeof fetchImpl !== 'function') throw new TypeError('Mapbox matcher requires an access token and fetch.');
  if (origin !== API_ORIGIN && fetchImpl === globalThis.fetch) throw new TypeError('Mapbox endpoint must be the official HTTPS API.');
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) throw new TypeError('Invalid match confidence.');

  return {
    provider: 'mapbox',
    version: VERSION,
    async matchWindow({ points, profile = 'auto', signal }) {
      if (signal?.aborted) throw signal.reason;
      if (!Array.isArray(points) || points.length < 2 || points.length > 100 || !points.every(validPoint)) return unmatched();
      const routeProfile = PROFILE[profile] || PROFILE.auto;
      const coordinates = points.map((point) => `${point.longitude},${point.latitude}`).join(';');
      const url = new URL(`/matching/v5/mapbox/${routeProfile}/${coordinates}.json`, origin);
      url.searchParams.set('access_token', accessToken);
      url.searchParams.set('geometries', 'polyline6');
      url.searchParams.set('overview', 'full');
      url.searchParams.set('radiuses', points.map((point) =>
        String(Math.max(5, Math.min(50, Number.isFinite(point.accuracy) ? point.accuracy : 20)))).join(';'));
      const seconds = points.map((point) => Math.floor(new Date(point.recordedAt).getTime() / 1000));
      if (seconds.every((second, index) => Number.isFinite(second) && (index === 0 || second > seconds[index - 1]))) {
        url.searchParams.set('timestamps', seconds.join(';'));
      }

      let response;
      try {
        response = await fetchImpl(url, { method: 'GET', signal, redirect: 'error' });
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        throw new Error('Mapbox request failed.', { cause: error?.name });
      }
      if (!response.ok) throw new Error(`Mapbox request failed with HTTP ${response.status}.`);
      let body;
      try {
        body = await response.json();
      } catch {
        throw new Error('Mapbox response was not JSON.');
      }
      if (body.code === 'NoMatch' || body.code === 'NoSegment') return unmatched();
      if (body.code !== 'Ok') throw new Error('Mapbox returned an unsuccessful response.');
      const match = body.matchings?.[0];
      const tracepoints = body.tracepoints;
      if (body.matchings?.length !== 1 || !Array.isArray(tracepoints) || tracepoints.length !== points.length ||
          tracepoints.some((point) => point == null || point.matchings_index !== 0) ||
          typeof match?.geometry !== 'string' || match.geometry.length < 2 ||
          !Number.isFinite(match.confidence) || match.confidence < minConfidence || match.confidence > 1) return unmatched();

      return {
        matched: true,
        provider: 'mapbox',
        version: VERSION,
        encoding: 'polyline6',
        geometry: match.geometry,
        confidence: match.confidence,
      };
    },
  };
}

module.exports = { createMapboxMapMatcher };
