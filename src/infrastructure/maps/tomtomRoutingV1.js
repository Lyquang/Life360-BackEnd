const API_ORIGIN = 'https://api.tomtom.com';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_POINTS = 10000;
const MAX_INSTRUCTIONS = 2000;

function failure(kind = 'unavailable') {
  const error = new Error('Routing provider unavailable.');
  error.kind = kind;
  return error;
}

function validPoint(point) {
  return Number.isFinite(point?.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point?.longitude) && Math.abs(point.longitude) <= 180;
}

function nonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

async function readBoundedJson(response) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (declaredLength > MAX_RESPONSE_BYTES) throw failure();
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw failure();
    try { return JSON.parse(text); } catch { throw failure(); }
  }
  const reader = response.body.getReader();
  const parts = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw failure();
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw failure(); }
}

function normalizeRoute(route, index, requestedMode) {
  const points = route?.legs?.[0]?.points;
  const summary = route?.summary;
  const sourceInstructions = route?.guidance?.instructions;
  const sourceSections = route?.sections;
  if (route?.legs?.length !== 1 || !Array.isArray(points) || points.length < 2 ||
      points.length > MAX_POINTS || !points.every(validPoint) ||
      !nonnegative(summary?.lengthInMeters) || !nonnegative(summary?.travelTimeInSeconds) ||
      !Array.isArray(sourceInstructions) || sourceInstructions.length > MAX_INSTRUCTIONS ||
      !Array.isArray(sourceSections) || sourceSections.length > 50) throw failure();

  let previousOffset = -1;
  const maneuvers = sourceInstructions.map((instruction) => {
    const code = instruction?.maneuver || instruction?.instructionType;
    const pointIndex = instruction?.pointIndex;
    const routeOffsetMeters = instruction?.routeOffsetInMeters;
    if (typeof code !== 'string' || code.length > 100 ||
        !Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= points.length ||
        !nonnegative(routeOffsetMeters) || routeOffsetMeters < previousOffset) throw failure();
    previousOffset = routeOffsetMeters;
    return {
      code,
      pointIndex,
      routeOffsetMeters,
      streetName: typeof instruction.street === 'string' ? instruction.street.slice(0, 200) : null,
    };
  });
  if (maneuvers.length === 0) throw failure();
  const modeSections = sourceSections.filter((section) => section.sectionType === 'TRAVEL_MODE').map((section) => {
    if (!Number.isInteger(section.startPointIndex) || !Number.isInteger(section.endPointIndex) ||
        section.startPointIndex < 0 || section.endPointIndex < section.startPointIndex ||
        section.endPointIndex >= points.length ||
        !['motorcycle', 'car', 'pedestrian', 'other'].includes(section.travelMode)) throw failure();
    return { startPointIndex: section.startPointIndex, endPointIndex: section.endPointIndex,
      travelMode: section.travelMode };
  });
  if (modeSections.length === 0) throw failure();

  const delay = summary.trafficDelayInSeconds;
  const trafficAvailable = requestedMode !== 'walking' && nonnegative(delay);
  return {
    id: String(index),
    distanceMeters: summary.lengthInMeters,
    durationSeconds: summary.travelTimeInSeconds,
    geometry: points.map(({ latitude, longitude }) => ({ latitude, longitude })),
    maneuvers,
    modeSections,
    traffic: {
      status: trafficAvailable ? 'provider_reported' : 'unavailable',
      delaySeconds: trafficAvailable ? delay : null,
    },
  };
}

function createTomtomRoutingV1({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  if (!apiKey || typeof fetchImpl !== 'function') throw new TypeError('TomTom Routing requires a key and fetch.');
  return {
    async calculate({ origin, destination, travelMode }) {
      if (!validPoint(origin) || !validPoint(destination) ||
          !['motorcycle', 'car', 'walking'].includes(travelMode)) throw failure();
      const mode = travelMode === 'walking' ? 'pedestrian' : travelMode;
      const path = `/routing/1/calculateRoute/${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}/json`;
      const url = new URL(path, API_ORIGIN);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('travelMode', mode);
      url.searchParams.set('routeType', 'fastest');
      url.searchParams.set('traffic', 'true');
      url.searchParams.set('maxAlternatives', '2');
      url.searchParams.set('instructionsType', 'coded');
      url.searchParams.set('sectionType', 'travelMode');
      let response;
      try {
        response = await fetchImpl(url, { method: 'GET', redirect: 'error',
          signal: AbortSignal.timeout(timeoutMs) });
      } catch {
        throw failure();
      }
      if (response.status === 429) throw failure('quota');
      if (response.status === 400) {
        const errorBody = await readBoundedJson(response).catch(() => null);
        if (errorBody?.detailedError?.code === 'NO_ROUTE_FOUND' ||
            errorBody?.detailedError?.code === 'MAP_MATCHING_FAILURE') throw failure('no_route');
      }
      if (!response.ok) throw failure();
      const body = await readBoundedJson(response);
      if (!Array.isArray(body?.routes) || body.routes.length > 3) throw failure();
      return body.routes.map((route, index) => normalizeRoute(route, index, travelMode));
    },
  };
}

module.exports = { createTomtomRoutingV1, normalizeRoute };
