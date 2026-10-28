const Redis = require('ioredis');
const { createCacheMetrics, classifyCacheKey } = require('./cacheMetrics');

const NULL_SENTINEL = '__NULL__';

function withJitter(ttlSeconds, jitterSeconds = 0) {
  if (!jitterSeconds) return ttlSeconds;
  return ttlSeconds + Math.floor(Math.random() * (jitterSeconds + 1));
}

function createRedisCacheManager({ config, logger = console, metrics, RedisClient = Redis }) {
  const client = new RedisClient(config.url, {
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
  const telemetry = createCacheMetrics(metrics);

  client.on('ready', () => {
    healthy = true;
    telemetry.connection('ready');
    logger.log('REDIS_CONNECTED');
  });
  client.on('end', () => {
    healthy = false;
    telemetry.connection('end');
  });
  client.on('error', () => {
    healthy = false;
    telemetry.connection('error');
    logger.warn('REDIS_CONNECTION_ERROR');
  });

  async function command(name, operation) {
    if (metrics?.enabled !== true) return operation();
    const startedAt = process.hrtime.bigint();
    try {
      const result = await operation();
      telemetry.command(name, 'success', Number(process.hrtime.bigint() - startedAt) / 1e9);
      return result;
    } catch (error) {
      telemetry.command(name, 'error', Number(process.hrtime.bigint() - startedAt) / 1e9);
      throw error;
    }
  }

  async function safe(operation, fallback, { key, cacheOperation, outcome = () => 'success' } = {}) {
    try {
      const result = await operation();
      if (cacheOperation) telemetry.request(key, cacheOperation, outcome(result));
      return result;
    } catch {
      healthy = false;
      if (cacheOperation) telemetry.request(key, cacheOperation, 'error');
      logger.warn('REDIS_OPERATION_FAILED');
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
      const result = await safe(
        async () => {
          const raw = await command('GET', () => client.get(key));
          return {
            value: decode(raw),
            outcome: raw === null ? 'miss' : raw === NULL_SENTINEL ? 'negative_hit' : 'hit',
          };
        },
        { value: null },
        {
          key,
          cacheOperation: 'get',
          outcome: ({ outcome }) => outcome,
        }
      );
      return result.value;
    },
    async setWithTTL(key, value, ttlSeconds, { jitterSeconds = 0 } = {}) {
      const ttl = Math.max(1, withJitter(ttlSeconds, jitterSeconds));
      return safe(async () => {
        await command('SET', () => client.set(key, encode(value), 'EX', ttl));
        return true;
      }, false, { key, cacheOperation: 'set' });
    },
    async setIfNewerTimestamp(key, value, field, ttlSeconds) {
      const script = `
        local current = redis.call('GET', KEYS[1])
        if current then
          local ok, decoded = pcall(cjson.decode, current)
          if ok and decoded[ARGV[1]] and decoded[ARGV[1]] >= ARGV[2] then
            return 0
          end
        end
        redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4])
        return 1
      `;
      return safe(
        () => command('EVAL', () => client.eval(script, 1, key, field, value[field], encode(value), Math.max(1, ttlSeconds))),
        0,
        { key, cacheOperation: 'set' }
      );
    },
    async del(key) {
      return safe(() => command('DEL', () => client.del(key)), 0, { key, cacheOperation: 'delete' });
    },
    async delMany(keys) {
      const uniqueKeys = [...new Set(keys.filter(Boolean))];
      if (uniqueKeys.length === 0) {
        telemetry.request('other', 'delete_many', 'success');
        return 0;
      }
      const keyType = new Set(uniqueKeys.map(classifyCacheKey)).size === 1 ? uniqueKeys[0] : 'other';
      return safe(() => command('DEL', () => client.del(...uniqueKeys)), 0, { key: keyType, cacheOperation: 'delete_many' });
    },
    async delByPattern(pattern) {
      return safe(async () => {
        let cursor = '0';
        let deleted = 0;
        do {
          const [nextCursor, keys] = await command('SCAN', () => client.scan(cursor, 'MATCH', pattern, 'COUNT', 100));
          cursor = nextCursor;
          if (keys.length > 0) deleted += await command('DEL', () => client.del(...keys));
        } while (cursor !== '0');
        return deleted;
      }, 0, { key: pattern, cacheOperation: 'delete_pattern' });
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
      const acquired = await safe(
        () => command('SET', () => client.set(lockKey, '1', 'NX', 'EX', ttlSeconds)),
        null,
        { key: lockKey, cacheOperation: 'lock', outcome: (result) => result === 'OK' ? 'success' : 'not_acquired' }
      );
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
