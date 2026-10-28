const { createSafeMetrics } = require('../../application/ports/metrics');

function classifyCacheKey(key) {
  if (typeof key !== 'string') return 'other';
  if (key.startsWith('user:profile:')) return 'user_profile';
  if (key.startsWith('circle:members:')) return 'circle_members';
  if (key.startsWith('location:last:')) return 'location';
  if (key.startsWith('user:session:')) return 'session';
  if (key.startsWith('auth:blacklist:')) return 'blacklist';
  if (key.startsWith('media:metadata:')) return 'media';
  return 'other';
}

function createCacheMetrics(metrics) {
  if (metrics?.enabled !== true) {
    return {
      request() {},
      command() {},
      connection() {},
      blacklistFailOpen() {},
    };
  }
  const telemetry = createSafeMetrics(metrics);
  const keyTypes = new Set(['user_profile', 'circle_members', 'location', 'session', 'blacklist', 'media', 'other']);
  return {
    request(key, operation, outcome) {
      telemetry.increment('cache_requests_total', {
        key_type: keyTypes.has(key) ? key : classifyCacheKey(key), operation, outcome,
      });
    },
    command(command, outcome, durationSeconds) {
      telemetry.increment('redis_commands_total', { command, outcome });
      telemetry.observe('redis_command_duration_seconds', { command }, durationSeconds);
    },
    connection(event) {
      telemetry.increment('redis_connection_events_total', { event });
    },
    blacklistFailOpen(reason) {
      telemetry.increment('auth_blacklist_fail_open_total', { reason });
    },
  };
}

module.exports = { classifyCacheKey, createCacheMetrics };
