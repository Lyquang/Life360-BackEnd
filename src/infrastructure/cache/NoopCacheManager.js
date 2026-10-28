const { createCacheMetrics } = require('./cacheMetrics');

function createNoopCacheManager({ enabled = false, reason = 'Redis is not configured.', metrics } = {}) {
  const telemetry = createCacheMetrics(metrics);
  return {
    enabled,
    reason,
    isHealthy() {
      return false;
    },
    async get(key) {
      telemetry.request(key, 'get', 'disabled');
      return null;
    },
    async setWithTTL(key) {
      telemetry.request(key, 'set', 'disabled');
      return false;
    },
    async setIfNewerTimestamp(key) {
      telemetry.request(key, 'set', 'disabled');
      return 0;
    },
    async del(key) {
      telemetry.request(key, 'delete', 'disabled');
      return false;
    },
    async delMany() {
      telemetry.request('other', 'delete_many', 'disabled');
      return 0;
    },
    async delByPattern(pattern) {
      telemetry.request(pattern, 'delete_pattern', 'disabled');
      return 0;
    },
    async getOrSet(key, ttlSeconds, loader) {
      telemetry.request(key, 'get', 'disabled');
      return loader();
    },
    async withLock(lockKey, ttlSeconds, fn) {
      telemetry.request(lockKey, 'lock', 'disabled');
      return fn();
    },
    async close() {},
  };
}

module.exports = { createNoopCacheManager };
