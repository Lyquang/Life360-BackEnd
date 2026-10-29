const userRepo = require('./infrastructure/repositories/userRepository');
const groupRepo = require('./infrastructure/repositories/groupRepository');
const placeRepo = require('./infrastructure/repositories/placeRepository');
const locationHistoryRepo = require('./infrastructure/repositories/locationHistoryRepository');
const digestRepo = require('./infrastructure/repositories/digestRepository');
const conversationRepo = require('./infrastructure/repositories/conversationRepository');
const conversationMemberRepo = require('./infrastructure/repositories/conversationMemberRepository');
const messageRepo = require('./infrastructure/repositories/messageRepository');
const userSocialAccountRepo = require('./infrastructure/repositories/userSocialAccountRepository');
const refreshSessionRepo = require('./infrastructure/repositories/refreshSessionRepository');
const liveTrailRepo = require('./infrastructure/repositories/liveTrailRepository');
const sosRepo = require('./infrastructure/repositories/sosRepository');
const outboxRepo = require('./infrastructure/repositories/sosOutboxRepository');
const { createSosOutboxDispatcher } = require('./application/sos/sosOutboxDispatcher');
const { createSosUseCases } = require('./application/sos/sosUseCases');
const { Errors } = require('./domain/errors');
const { createSosSocketLimiter } = require('./infrastructure/security/sosSocketLimiter');
const { createNoopCacheManager } = require('./infrastructure/cache/NoopCacheManager');
const { createRedisCacheManager } = require('./infrastructure/cache/RedisCacheManager');
const { createCachedUserRepository } = require('./infrastructure/cache/cachedUserRepository');
const { createCachedGroupRepository } = require('./infrastructure/cache/cachedGroupRepository');
const passwordHasher = require('./infrastructure/security/passwordHasher');
const { createTokenService } = require('./infrastructure/security/tokenService');
const { createS3Storage } = require('./infrastructure/storage/s3Storage');
const { createCloudflareR2StorageService } = require('./infrastructure/storage/CloudflareR2StorageService');
const { createSocketRealtime } = require('./infrastructure/realtime/socketRealtime');
const { createLiveTrailAccessInvalidator } = require('./infrastructure/realtime/liveTrailAccessInvalidator');
const { createOAuthProviderFactory } = require('./infrastructure/oauth/oauthProviderFactory');
const { createUnitOfWork } = require('./infrastructure/database/unitOfWork');
const { instrumentMongoRepositories } = require('./infrastructure/database/mongoRepositoryMetrics');
const { createAuthUseCases } = require('./application/auth/authUseCases');
const { createGroupUseCases } = require('./application/groups/groupUseCases');
const { createPlaceUseCases } = require('./application/places/placeUseCases');
const { createHistoryUseCases } = require('./application/history/historyUseCases');
const { createLiveTrailWatchUseCases } = require('./application/history/liveTrailWatchUseCases');
const { createLocationAccessPolicy } = require('./application/privacy/locationAccessPolicy');
const { createPrivacyUseCases } = require('./application/privacy/privacyUseCases');
const { createDigestUseCases } = require('./application/digests/digestUseCases');
const { createLocationUseCases } = require('./application/location/locationUseCases');
const { createSyncLocationBatchUseCase } = require('./application/location/syncLocationBatchUseCase');
const { createLiveTrailProjection } = require('./application/location/liveTrailProjection');
const { createLiveTrailDeltaPublisher } = require('./application/location/liveTrailDeltaPublisher');
const { createLiveTrailMatchingService } = require('./application/location/liveTrailMatchingService');
const { createLocationRuntimeState } = require('./application/location/locationRuntimeState');
const { createChatUseCases } = require('./application/chat/chatUseCases');
const { createNoopMapMatcher } = require('./infrastructure/matching/NoopMapMatcher');
const { createFakeMapMatcher } = require('./infrastructure/matching/FakeMapMatcher');
const { createMapboxMapMatcher } = require('./infrastructure/matching/MapboxMapMatcher');

/** Composition root: wires infrastructure adapters into application use cases. */
function createContainer({ config, io, supportsTransactions, logger = console, metrics }) {
  const cacheManager =
    config.redis.enabled && config.redis.url
      ? createRedisCacheManager({ config: config.redis, logger, metrics })
      : createNoopCacheManager({ reason: 'Redis is disabled or REDIS_URL is missing.', metrics });

  const measuredRepositories = instrumentMongoRepositories({
    userRepo,
    groupRepo,
    placeRepo,
    locationHistoryRepo,
    digestRepo,
    conversationRepo,
    conversationMemberRepo,
    messageRepo,
    userSocialAccountRepo,
    refreshSessionRepo,
    liveTrailRepo,
  }, metrics);
  const repos = {
    userRepo: createCachedUserRepository({ userRepo: measuredRepositories.userRepo, cacheManager }),
    groupRepo: createCachedGroupRepository({ groupRepo: measuredRepositories.groupRepo, cacheManager }),
    placeRepo: measuredRepositories.placeRepo,
    locationHistoryRepo: measuredRepositories.locationHistoryRepo,
    digestRepo: measuredRepositories.digestRepo,
    conversationRepo: measuredRepositories.conversationRepo,
    conversationMemberRepo: measuredRepositories.conversationMemberRepo,
    messageRepo: measuredRepositories.messageRepo,
    userSocialAccountRepo: measuredRepositories.userSocialAccountRepo,
    refreshSessionRepo: measuredRepositories.refreshSessionRepo,
    liveTrailRepo: measuredRepositories.liveTrailRepo,
  };
  const services = {
    metrics,
    unitOfWork: createUnitOfWork({ supportsTransactions, logger, metrics }),
    realtime: createSocketRealtime(io, metrics),
    liveTrailAccessInvalidator: createLiveTrailAccessInvalidator({ logger }),
    tokenService: createTokenService(config.jwt),
    passwordHasher,
    oauthProviderFactory: createOAuthProviderFactory({ config }),
    storage: config.storage
      ? config.storage.provider === 'cloudflare-r2'
        ? createCloudflareR2StorageService(config.storage)
        : createS3Storage(config.storage)
      : null,
    cacheManager,
    locationCacheTtlSeconds: config.redis.locationTtlSeconds,
    locationRuntimeState: createLocationRuntimeState(),
    historyPersistencePolicy: config.locationHistory,
    journeyGeometryPolicy: config.journeyGeometry,
    historyTimeZone: config.timeZone,
    historyRangePolicy: config.historyRange,
    liveTrailPolicy: {
      ...config.liveTrail,
      gapThresholdSeconds: config.journeyGeometry.gapThresholdSeconds,
      stayRadiusMeters: config.journeyGeometry.stayRadiusMeters,
    },
    authMaxActiveSessions: config.authMaxActiveSessions,
    logger,
  };
  services.locationAccessPolicy = createLocationAccessPolicy({ ...repos, ...services });
  services.sosOutboxDispatcher = config.sosOutbox?.enabled
    ? createSosOutboxDispatcher({
      ...repos, sosRepo, outboxRepo, policy: config.sosOutbox,
      deliver: ({ recipientId, event, payload }) => services.realtime.emitToUser(recipientId, event, payload),
    }) : null;
  const baseDeps = { ...repos, ...services };
  services.liveTrailProjection = createLiveTrailProjection({
    ...baseDeps,
    policy: config.liveTrail,
  });
  services.liveTrailDeltaPublisher = createLiveTrailDeltaPublisher({
    metrics,
    realtime: services.realtime,
    policy: config.liveTrail,
    logger,
  });
  services.mapMatcher = config.liveTrail.matcher.enabled && config.liveTrail.matcher.provider === 'mapbox'
    ? createMapboxMapMatcher({
      accessToken: config.liveTrail.matcher.accessToken,
      minConfidence: config.liveTrail.matcher.minConfidence,
    })
    : config.liveTrail.matcher.provider === 'fake' ? createFakeMapMatcher() : createNoopMapMatcher();
  services.liveTrailMatchingService = createLiveTrailMatchingService({
    metrics,
    liveTrailRepo,
    matcher: services.mapMatcher,
    liveTrailDeltaPublisher: services.liveTrailDeltaPublisher,
    policy: {
      ...config.liveTrail.matcher,
      gapThresholdSeconds: config.journeyGeometry.gapThresholdSeconds,
      stayRadiusMeters: config.journeyGeometry.stayRadiusMeters,
    },
    logger,
  });
  const deps = {
    ...baseDeps,
    liveTrailProjection: services.liveTrailProjection,
    liveTrailDeltaPublisher: services.liveTrailDeltaPublisher,
    liveTrailMatchingService: services.liveTrailMatchingService,
  };

  const unavailableSos = async () => { throw Errors.serviceUnavailable('SOS assistance is not available on this server.'); };
  const sos = config.sos?.enabled && supportsTransactions
    ? createSosUseCases({ ...deps, sosRepo, outboxRepo, policy: config.sos })
    : { create: unavailableSos, get: unavailableSos, respond: unavailableSos, close: unavailableSos, list: unavailableSos };
  const useCases = {
    sos,
    auth: createAuthUseCases(deps),
    groups: createGroupUseCases(deps),
    places: createPlaceUseCases(deps),
    history: createHistoryUseCases(deps),
    liveTrailWatch: createLiveTrailWatchUseCases(deps),
    privacy: createPrivacyUseCases(deps),
    digests: createDigestUseCases(deps),
    location: createLocationUseCases({ ...deps, sosAssistance: config.sos?.enabled ? sos : null,
      sosActionLimiter: createSosSocketLimiter({ limit: config.sos?.rateLimit }) }),
    chat: createChatUseCases(deps),
  };
  useCases.location.syncBatch = createSyncLocationBatchUseCase({
    ...deps,
    policy: {
      maxAgeMs: config.locationBatch.maxAgeMs,
      maxFutureMs: config.locationBatch.maxFutureMs,
    },
  });

  return { repos, services, useCases, deps };
}

module.exports = { createContainer };
