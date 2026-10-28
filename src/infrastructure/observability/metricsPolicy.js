const MAX_SERIES = 2500;
const methods = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS', 'HEAD', 'other'];
// Callers pass a resolved route group, never a raw URL or request parameter.
const routes = ['auth', 'groups', 'privacy', 'history', 'locations', 'conversations', 'chat', 'system', 'unmatched', 'other'];
const definitions = Object.freeze({
  location_history_decisions_total: { type: 'counter', help: 'Realtime history persistence decisions, not inserted-document counts.', labels: { outcome: ['persist', 'throttled', 'other'] } },
  location_timestamp_fallbacks_total: { type: 'counter', help: 'Out-of-range measured timestamps replaced with server time.', labels: { reason: ['too_old', 'too_far_in_future', 'other'] } },
  location_batch_points_total: { type: 'counter', help: 'Point outcomes in completed batch responses, including retries.', labels: { outcome: ['accepted', 'duplicates', 'rejected', 'other'] } },
  trail_projection_total: { type: 'counter', help: 'Projection results per date group; disabled counts calls.', labels: { outcome: ['disabled', 'success', 'error', 'other'] } },
  trail_matcher_total: { type: 'counter', help: 'Matcher calls, durable hits and queue events.', labels: { outcome: ['matched', 'unmatched', 'error', 'timeout', 'circuit_open', 'cache_hit', 'queue_drop', 'coalesced', 'job_error', 'other'] } },
  trail_matcher_state: { type: 'gauge', help: 'Matcher process-local state at scrape time.', labels: { state: ['active', 'queued', 'pendingTriggers', 'circuitOpen', 'other'] } },
  trail_publication_errors_total: { type: 'counter', help: 'Failed Live Trail publication operations.', labels: { operation: ['realtime', 'batch', 'flush', 'other'] } },
  mongo_pool_events_total: { type: 'counter', help: 'MongoDB driver pool and connection lifecycle events observed by this process.', labels: { event: ['pool_created', 'pool_ready', 'pool_closed', 'connection_created', 'connection_ready', 'connection_closed', 'checkout_failed', 'other'] } },
  mongo_repository_operations_total: { type: 'counter', help: 'Mongo repository operation outcomes grouped into bounded operation classes.', labels: { operation: ['read', 'write', 'bulk_read', 'bulk_write', 'other'], outcome: ['success', 'error', 'other'] } },
  mongo_repository_duration_seconds: { type: 'histogram', help: 'Mongo repository operation duration in seconds grouped into bounded operation classes.', labels: { operation: ['read', 'write', 'bulk_read', 'bulk_write', 'other'] }, buckets: [0.005, 0.02, 0.1, 0.5, 2] },
  mongo_transactions_total: { type: 'counter', help: 'MongoDB unit-of-work transaction outcomes.', labels: { outcome: ['success', 'error', 'unsupported', 'other'] } },
  realtime_payload_bytes: { type: 'histogram', help: 'JSON byte size of every tenth realtime adapter emit per channel; not wire bytes.', labels: { channel: ['user', 'group', 'conversation', 'trail', 'other'] }, buckets: [1024, 4096, 16384, 65536, 262144] },
  socket_broadcasts_total: { type: 'counter', help: 'Successful emit calls, not recipient or delivered-message counts.', labels: { channel: ['user', 'group', 'conversation', 'trail', 'other'] } },
  socket_connections: { type: 'gauge', help: 'Connected sockets in the default namespace.', labels: { scope: ['default', 'other'] } },
  socket_rooms: { type: 'gauge', help: 'Default namespace rooms including per-socket rooms.', labels: { scope: ['default', 'other'] } },
  socket_watches: { type: 'gauge', help: 'Active watch registrations across connected sockets.', labels: { scope: ['default', 'other'] } },
  socket_actions_total: {
    type: 'counter', help: 'Completed server Socket actions; success does not imply client delivery.',
    labels: { event: ['handshake', 'connect', 'disconnect', 'session:ready', 'update_location', 'sos_alert', 'chat:send_message', 'chat:mark_read', 'chat:typing', 'journey:watch', 'journey:unwatch', 'journey:lease', 'other'], outcome: ['success', 'rejected', 'error', 'other'] },
  },
  socket_action_duration_seconds: {
    type: 'histogram', help: 'Server Socket action duration, excluding network delivery.',
    labels: { event: ['handshake', 'connect', 'disconnect', 'session:ready', 'update_location', 'sos_alert', 'chat:send_message', 'chat:mark_read', 'chat:typing', 'journey:watch', 'journey:unwatch', 'journey:lease', 'other'] },
    buckets: [0.01, 0.05, 0.2, 1, 5],
  },
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
