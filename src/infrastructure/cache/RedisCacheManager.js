const Redis = require('ioredis');

const NULL_SENTINEL = '__NULL__';

function withJitter(ttlSeconds, jitterSeconds = 0) {
  if (!jitterSeconds) return ttlSeconds;
  return ttlSeconds + Math.floor(Math.random() * (jitterSeconds + 1));
}

function createRedisCacheManager({ config, logger = console }) {
  const client = new Redis(config.url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    connectTimeout: config.connectTimeoutMs,
    keyPrefix: config.keyPrefix,
    retryStrategy(times) {
      return Math.min(times * 100, 2000);
    },
  });

  let healthy = false;

  client.on('ready', () => {
    healthy = true;
    logger.log('Redis cache connected.');
  });
  client.on('end', () => {
    healthy = false;
  });
  client.on('error', (error) => {
    healthy = false;
    logger.warn(`Redis cache error: ${error.message}`);
  });

  async function safe(operation, fallback) {
    try {
      return await operation();
    } catch (error) {
      healthy = false;
      logger.warn(`Redis cache operation skipped: ${error.message}`);
      return fallback;
    }
  }

  function encode(value) {
    if (value === null) return NULL_SENTINEL;
    return JSON.stringify(value);
  }

  function decode(value) {
    if (value === null || value === undefined) return null;
    if (value === NULL_SENTINEL) return null;
    return JSON.parse(value);
  }

  return {
    enabled: true,
    client,
    async connect() {
      if (client.status === 'wait') {
        await safe(() => client.connect(), undefined);
      }
    },
    isHealthy() {
      return healthy && client.status === 'ready';
    },
    async get(key) {
      return safe(async () => decode(await client.get(key)), null);
    },
    async setWithTTL(key, value, ttlSeconds, { jitterSeconds = 0 } = {}) {
      const ttl = Math.max(1, withJitter(ttlSeconds, jitterSeconds));
      return safe(async () => {
        await client.set(key, encode(value), 'EX', ttl);
        return true;
      }, false);
    },
    async del(key) {
      return safe(() => client.del(key), 0);
    },
    async delMany(keys) {
      const uniqueKeys = [...new Set(keys.filter(Boolean))];
      if (uniqueKeys.length === 0) return 0;
      return safe(() => client.del(...uniqueKeys), 0);
    },
    async delByPattern(pattern) {
      return safe(async () => {
        let cursor = '0';
        let deleted = 0;
        do {
          const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) deleted += await client.del(...keys);
        } while (cursor !== '0');
        return deleted;
      }, 0);
    },
    async getOrSet(key, ttlSeconds, loader, { jitterSeconds = 0, nullTtlSeconds = 30 } = {}) {
      const cached = await this.get(key);
      if (cached !== null) return cached;

      const loaded = await loader();
      if (loaded === null || loaded === undefined) {
        await this.setWithTTL(key, null, nullTtlSeconds);
        return loaded;
      }
      await this.setWithTTL(key, loaded, ttlSeconds, { jitterSeconds });
      return loaded;
    },
    async withLock(lockKey, ttlSeconds, fn) {
      const acquired = await safe(() => client.set(lockKey, '1', 'NX', 'EX', ttlSeconds), null);
      if (acquired !== 'OK') return fn({ locked: false });
      try {
        return await fn({ locked: true });
      } finally {
        await this.del(lockKey);
      }
    },
    async close() {
      if (client.status !== 'end') await client.quit();
    },
  };
}

module.exports = { createRedisCacheManager };
