const MAX_SERIES = 2500;
const methods = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS', 'HEAD', 'other'];
// Callers pass a resolved route group, never a raw URL or request parameter.
const routes = ['auth', 'groups', 'privacy', 'history', 'locations', 'conversations', 'chat', 'system', 'unmatched', 'other'];
const definitions = Object.freeze({
  http_requests_total: {
    type: 'counter', help: 'Completed HTTP requests by bounded route group.',
    labels: { method: methods, route: routes, status_class: ['1xx', '2xx', '3xx', '4xx', '5xx', 'other'] },
  },
  http_request_duration_seconds: {
    type: 'histogram', help: 'HTTP duration in seconds by route group.',
    labels: { route: routes }, buckets: [0.01, 0.05, 0.2, 1, 5],
  },
  http_rate_limited_total: {
    type: 'counter', help: 'HTTP rate limited responses by route group.', labels: { route: routes },
  },
});

function normalizeLabels(definition, input = {}) {
  const result = {};
  for (const [key, allowed] of Object.entries(definition.labels)) {
    const value = input[key];
    result[key] = typeof value === 'string' && allowed.includes(value) ? value : 'other';
  }
  return result;
}

// Each histogram labelset exports finite buckets, +Inf, sum and count.
function seriesCost(definition) {
  return definition.type === 'histogram' ? definition.buckets.length + 3 : 1;
}

function maximumSeries() {
  return Object.values(definitions).reduce((total, definition) => total +
    Object.values(definition.labels).reduce((product, values) => product * values.length, 1) * seriesCost(definition), 0);
}

module.exports = { MAX_SERIES, definitions, normalizeLabels, seriesCost, maximumSeries };
