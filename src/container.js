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
function createContainer({ config, io, supportsTransactions, logger = console }) {
  const cacheManager =
    config.redis.enabled && config.redis.url
      ? createRedisCacheManager({ config: config.redis, logger })
      : createNoopCacheManager({ reason: 'Redis is disabled or REDIS_URL is missing.' });

  const repos = {
    userRepo: createCachedUserRepository({ userRepo, cacheManager }),
    groupRepo: createCachedGroupRepository({ groupRepo, cacheManager }),
    placeRepo,
    locationHistoryRepo,
    digestRepo,
    conversationRepo,
    conversationMemberRepo,
    messageRepo,
    userSocialAccountRepo,
    refreshSessionRepo,
    liveTrailRepo,
  };
  const services = {
    unitOfWork: createUnitOfWork({ supportsTransactions, logger }),
    realtime: createSocketRealtime(io),
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
  const baseDeps = { ...repos, ...services };
  services.liveTrailProjection = createLiveTrailProjection({
    ...baseDeps,
    policy: config.liveTrail,
  });
  services.liveTrailDeltaPublisher = createLiveTrailDeltaPublisher({
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

  const useCases = {
    auth: createAuthUseCases(deps),
    groups: createGroupUseCases(deps),
    places: createPlaceUseCases(deps),
    history: createHistoryUseCases(deps),
    liveTrailWatch: createLiveTrailWatchUseCases(deps),
    privacy: createPrivacyUseCases(deps),
    digests: createDigestUseCases(deps),
    location: createLocationUseCases(deps),
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
