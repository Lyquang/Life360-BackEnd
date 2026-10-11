function createNoopCacheManager({ enabled = false, reason = 'Redis is not configured.' } = {}) {
  return {
    enabled,
    reason,
    isHealthy() {
      return false;
    },
    async get() {
      return null;
    },
    async setWithTTL() {
      return false;
    },
    async del() {
      return false;
    },
    async delMany() {
      return 0;
    },
    async delByPattern() {
      return 0;
    },
    async getOrSet(key, ttlSeconds, loader) {
      return loader();
    },
    async withLock(lockKey, ttlSeconds, fn) {
      return fn();
    },
    async close() {},
  };
}

module.exports = { createNoopCacheManager };
