const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createMetrics } = require('../src/infrastructure/observability/metricsRegistry');
const { createNoopCacheManager } = require('../src/infrastructure/cache/NoopCacheManager');
const { createRedisCacheManager } = require('../src/infrastructure/cache/RedisCacheManager');
const { createAuthUseCases } = require('../src/application/auth/authUseCases');

class FakeRedis extends EventEmitter {
  constructor() {
    super();
    this.status = 'wait';
    this.values = new Map();
    this.failNextGet = false;
  }

  async connect() { this.status = 'ready'; this.emit('ready'); }
  async get(key) {
    if (this.failNextGet) { this.failNextGet = false; throw new Error('private redis error'); }
    return this.values.get(key) ?? null;
  }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }
  async eval(_script, _keyCount, key, _field, _timestamp, value) { this.values.set(key, value); return 1; }
  async del(...keys) {
    let deleted = 0;
    for (const key of keys) if (this.values.delete(key)) deleted++;
    return deleted;
  }
  async scan(_cursor, _match, pattern) {
    const prefix = pattern.replace('*', '');
    return ['0', [...this.values.keys()].filter((key) => key.startsWith(prefix))];
  }
  async quit() { this.status = 'end'; this.emit('end'); }
}

test('Noop cache reports disabled with bounded key categories, never key values', async () => {
  const metrics = createMetrics({ enabled: true });
  const cache = createNoopCacheManager({ metrics });
  const privateKey = 'user:profile:private-user-id';
  await cache.get(privateKey);
  await cache.del(privateKey);
  const { text } = await metrics.snapshot();
  assert.match(text, /familytracker_cache_requests_total\{key_type="user_profile",operation="get",outcome="disabled"\} 1/);
  assert.match(text, /familytracker_cache_requests_total\{key_type="user_profile",operation="delete",outcome="disabled"\} 1/);
  assert.doesNotMatch(text, /private-user-id/);
  metrics.close();
});

test('Redis adapter records hit, miss, negative hit, command timing, and fail-soft errors', async () => {
  const metrics = createMetrics({ enabled: true });
  let fakeClient;
  const cache = createRedisCacheManager({
    config: { url: 'redis://local', maxRetriesPerRequest: 1, connectTimeoutMs: 100, keyPrefix: '' },
    metrics,
    RedisClient: class extends FakeRedis { constructor(...args) { super(...args); fakeClient = this; } },
    logger: { log() {}, warn() {} },
  });
  await cache.connect();
  await cache.setWithTTL('user:profile:private-user-id', { name: 'test' }, 30);
  assert.deepEqual(await cache.get('user:profile:private-user-id'), { name: 'test' });
  assert.equal(await cache.get('location:last:missing-user-id'), null);
  await cache.setWithTTL('circle:members:private-circle-id', null, 30);
  assert.equal(await cache.get('circle:members:private-circle-id'), null);
  await cache.withLock('other:private-lock-key', 10, async ({ locked }) => assert.equal(locked, true));

  fakeClient.failNextGet = true;
  assert.equal(await cache.get('auth:blacklist:private-token-hash'), null);
  fakeClient.values.set('media:metadata:private-media-key', '{invalid-json');
  assert.equal(await cache.get('media:metadata:private-media-key'), null);
  assert.equal(cache.isHealthy(), false);

  const { text } = await metrics.snapshot();
  assert.match(text, /key_type="user_profile",operation="get",outcome="hit"/);
  assert.match(text, /key_type="location",operation="get",outcome="miss"/);
  assert.match(text, /key_type="circle_members",operation="get",outcome="negative_hit"/);
  assert.match(text, /key_type="blacklist",operation="get",outcome="error"/);
  assert.match(text, /familytracker_redis_commands_total\{command="GET",outcome="error"\} 1/);
  assert.match(text, /key_type="media",operation="get",outcome="error"/);
  assert.match(text, /familytracker_redis_command_duration_seconds_count\{command="GET"\} 5/);
  assert.match(text, /familytracker_redis_connection_events_total\{event="ready"\} 1/);
  assert.doesNotMatch(text, /private-user-id|private-circle-id|private-token-hash|private-lock-key|private-media-key|private redis error/);
  await cache.close();
  metrics.close();
});

test('auth blacklist records disabled and unavailable fail-open separately', async () => {
  const metrics = createMetrics({ enabled: true });
  const makeAuth = (cacheManager) => createAuthUseCases({
    userRepo: { findById: async (id) => ({ _id: id }) },
    cacheManager,
    metrics,
    tokenService: { verify: () => ({ id: 'user-id' }), hashToken: () => 'opaque-hash' },
  });
  const disabled = createNoopCacheManager({ metrics });
  const unavailable = {
    enabled: true,
    isHealthy: () => false,
    async get() { return null; },
  };

  await makeAuth(disabled).authenticateToken('access-token');
  await makeAuth(unavailable).authenticateToken('access-token');
  const { text } = await metrics.snapshot();
  assert.match(text, /familytracker_auth_blacklist_fail_open_total\{reason="disabled"\} 1/);
  assert.match(text, /familytracker_auth_blacklist_fail_open_total\{reason="unavailable"\} 1/);
  metrics.close();
});
