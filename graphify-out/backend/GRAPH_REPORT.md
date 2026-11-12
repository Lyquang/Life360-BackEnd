# Graph Report - /tmp/backend-graph-survey.cfCrJv  (2026-11-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 882 nodes · 1597 edges · 48 communities (46 shown, 2 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 165 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ddf5c58d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46

## God Nodes (most connected - your core abstractions)
1. `createContainer()` - 36 edges
2. `configureApp()` - 31 edges
3. `createSafeMetrics()` - 29 edges
4. `Errors` - 22 edges
5. `Group` - 18 edges
6. `asyncHandler()` - 15 edges
7. `validate()` - 15 edges
8. `haversineDistance()` - 14 edges
9. `User` - 14 edges
10. `createServer()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `createGroupUseCases()` --indirect_call--> `removeMember()`  [INFERRED]
  application/groups/groupUseCases.js → infrastructure/repositories/groupRepository.js
- `createPrivacyUseCases()` --indirect_call--> `setLocationSharing()`  [INFERRED]
  application/privacy/privacyUseCases.js → infrastructure/repositories/userRepository.js
- `createContainer()` --calls--> `createAuthUseCases()`  [EXTRACTED]
  container.js → application/auth/authUseCases.js
- `createContainer()` --calls--> `createChatUseCases()`  [EXTRACTED]
  container.js → application/chat/chatUseCases.js
- `createContainer()` --calls--> `createDigestUseCases()`  [EXTRACTED]
  container.js → application/digests/digestUseCases.js

## Import Cycles
- None detected.

## Communities (48 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (51): createLocationRuntimeState(), conversationMemberRepo, conversationRepo, { createAuthUseCases }, { createCachedGroupRepository }, { createCachedUserRepository }, { createChatUseCases }, { createCloudflareR2StorageService } (+43 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (37): { AsyncLocalStorage }, getLogContext(), newConnectionId(), newRequestId(), { randomBytes }, storage, withLogContext(), createSafeLogger() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (30): createSosAccessPolicy(), { Errors }, { AppError }, { createSosAccessPolicy }, createSosOutboxDispatcher(), { toMessageView }, { assertCanOfferAssistance }, { createSosAccessPolicy } (+22 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (34): createNoopMetrics(), { configureApp }, { connectDatabase, isDatabaseConnected }, { createContainer }, { createMetrics }, { createSafeLogger }, createServer(), { createSwaggerSpec } (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (34): haversineDistance(), decision(), DEFAULT_HISTORY_PERSISTENCE_CONFIG, { haversineDistance }, isValidPoint(), shouldPersistHistoryPoint(), timestampMs(), {
  analyzeRouteGaps,
  simplifyRoute,
  sortAndDedupeHistoryPoints,
  totalDistanceMeters,
  validRouteGaps,
} (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (27): buildMemberStatus(), createDigestUseCases(), { createSafeMetrics }, { formatDuration, formatLastSeen }, { isLocationSharingEnabled }, { requireGroupMember }, createGroupUseCases(), { createSafeMetrics } (+19 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (29): assertCanOfferAssistance(), assertSosActive(), assertSosClosingStatus(), CLOSED_SOS_STATUSES, { Errors }, SOS_STATUSES, audienceSchema, incidentSchema (+21 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (27): { createAuthController }, { createAuthenticate }, {
  createAuthLimiter,
  createRefreshLimiter,
  createLocationBatchLimiter,
  createLiveTrailReadLimiter,
  createSosLimiter,
}, { createAuthRoutes }, { createChatController }, { createConversationRoutes, createChatRoutes }, { createErrorHandler, notFoundHandler }, { createGroupController } (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (21): classifyRefreshSession(), crypto, hashToken(), REFRESH_SESSION_STATUS, safeTokenHashEquals(), mongoose, { REFRESH_SESSION_STATUS }, refreshSessionSchema (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (16): { classifyRefreshSession }, { createSafeMetrics }, { Errors }, { normalizeSocialProfile }, { tokenBlacklistKey, userSessionKey, userSessionsPattern }, circleMembersKey(), crypto, mediaMetadataKey() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (20): idOrNull(), toMemberView(), toMessageView(), { createSafeMetrics }, { Errors }, {
  IMAGE_MIME_TYPES,
  VOICE_MIME_TYPES,
  extensionForMimeType,
  buildChatUploadKey,
  buildChatMediaUploadKey,
  isChatUploadKeyOwnedBy,
  isChatMediaUploadKeyOwnedBy,
}, { mediaMetadataKey }, { randomUUID } (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (14): { buildDayJourney }, { buildLiveTrailGaps, localDateFor }, createHistoryUseCases(), { Errors }, { localDayRange, formatLocalDate }, formatLocalDate(), isValidCalendarDate(), localDayRange() (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (16): { asyncHandler }, createAuthController(), { asyncHandler }, createChatController(), { asyncHandler }, createGroupController(), withConversation(), { asyncHandler } (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (17): createAuthUseCases(), createChatUseCases(), createLiveTrailDeltaPublisher(), { createSafeMetrics }, createLiveTrailProjection(), { createSafeMetrics }, { prepareLiveTrailPoints }, createSafeMetrics() (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (20): groupSchema, mongoose, addMember(), create(), findById(), findByIdWithAdmin(), findByIdWithMembers(), findByInviteCode() (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (18): MEDIA_TYPES, conversationIdParams, dimension, { IMAGE_MIME_TYPES, VOICE_MIME_TYPES, MEDIA_TYPES, MAX_IMAGE_DIMENSION, BLURHASH_REGEX }, imageMessage, listMessagesQuery, markReadBody, mediaUploadTicketBody (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (18): LiveTrail, LiveTrailMatch, liveTrailMatchSchema, LiveTrailPoint, liveTrailPointSchema, liveTrailSchema, mongoose, appendPoints() (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (14): createLiveTrailWatchUseCases(), { Errors }, { localDateFor }, createPlaceUseCases(), { requireGroupMember }, createContainer(), createSocketRealtime(), rooms (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (16): mongoose, userSchema, create(), existsByEmail(), findByEmail(), findByEmailWithPassword(), findById(), findByIdWithPassword() (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (10): attachmentSchema, ChatMessage, chatMessageSchema, MESSAGE_TYPES, mongoose, sosSchema, afterCursor(), ChatMessage (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (7): Conversation, CONVERSATION_TYPES, conversationSchema, mongoose, Conversation, directKeyFor(), findOrCreateDirect()

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (13): { assertMapMatcher }, { buildMatchWindows, segmentIdFor, sourceRevision }, createLiveTrailMatchingService(), { createSafeMetrics }, assertMapMatcher(), buildMatchWindows(), chronological(), { createHash } (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (12): AppError, liveTrailWatchPayload, { z }, { AppError, Errors }, createSlidingWindowLimiter(), { formatIssues }, { liveTrailWatchPayload }, { outcomeForError } (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.23
Nodes (13): conversationMemberSchema, mongoose, add(), addMany(), advanceLastRead(), ConversationMember, find(), listByConversationIds() (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.28
Nodes (13): mongoose, outboxSchema, claimNext(), enqueue(), hasActiveLease(), markDelivered(), markDiscarded(), ownedLease() (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (13): formatIssues(), { AppError, Errors }, batteryLevel, createParseLocationBatch(), ERROR_CODES, latitude, locationBatchPoint, longitude (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (13): accuracy, batteryLevel, latitude, longitude, motionState, recordedAt, sosPayload, updateLocationPayload (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.20
Nodes (14): configureApp(), cors, helmet, validate(), createAuthRoutes(), createChatRoutes(), createConversationRoutes(), createGroupRoutes() (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.21
Nodes (12): changePasswordBody, deviceName, email, loginBody, logoutBody, refreshBody, registerBody, socialLoginBody (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.19
Nodes (12): objectId, calendarDate, historyQuery, isoDateTime, { isValidCalendarDate }, journeyQuery, liveTrailQuery, userIdParams (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.22
Nodes (12): addPlaceBody, createGroupBody, digestListQuery, groupIdParams, groupMemberParams, joinGroupBody, notificationIntervalBody, PLACE_CATEGORIES (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.27
Nodes (11): locationHistorySchema, mongoose, create(), { createHash }, dedupeKey(), findLatestForUser(), insertBatchIdempotent(), isDuplicateKeyError() (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.24
Nodes (8): classifyCacheKey(), createCacheMetrics(), { createSafeMetrics }, { createCacheMetrics }, createNoopCacheManager(), { createCacheMetrics, classifyCacheKey }, createRedisCacheManager(), Redis

### Community 33 - "Community 33"
Cohesion: 0.26
Nodes (10): closeSosBody, createSosBody, listSosQuery, respondSosBody, sosParams, sosQuery, { z, objectId }, { createSosBody, sosParams, sosQuery, respondSosBody, closeSosBody, listSosQuery } (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (7): ConfigError, envSchema, optionalString, optionalUrl, R2_STORAGE_KEYS, STORAGE_KEYS, { z }

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (8): groupDigestSchema, memberStatusSchema, mongoose, buildFilter(), create(), findLatest(), GroupDigest, list()

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (7): httpsUrl, { z }, locationSharingBody, { z }, { Errors }, { formatIssues }, PARTS

### Community 37 - "Community 37"
Cohesion: 0.36
Nodes (7): { createSafeMetrics }, createSyncLocationBatchUseCase(), { lastLocationKey }, { stableSortByRecordedAt, recordedAtRejection }, lastLocationKey(), recordedAtRejection(), stableSortByRecordedAt()

### Community 38 - "Community 38"
Cohesion: 0.25
Nodes (7): markReadPayload, sendMessagePayload, typingPayload, { AppError, Errors }, { formatIssues }, { outcomeForError }, { sendMessagePayload, markReadPayload, typingPayload }

### Community 39 - "Community 39"
Cohesion: 0.32
Nodes (7): compress, { createHash, timingSafeEqual }, createMetricsMiddleware(), digest(), groups, { gzip }, { promisify }

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (6): createLocationUseCases(), { createSafeMetrics }, { haversineDistance, formatDuration }, { lastLocationKey }, { shouldPersistHistoryPoint }, STAY_ALERT_MILESTONES_MINUTES

### Community 41 - "Community 41"
Cohesion: 0.38
Nodes (5): favoritePlaceSchema, mongoose, create(), FavoritePlace, listByGroup()

### Community 42 - "Community 42"
Cohesion: 0.52
Nodes (6): createAuthLimiter(), createLiveTrailReadLimiter(), createLocationBatchLimiter(), createRefreshLimiter(), createSosLimiter(), rateLimit

### Community 43 - "Community 43"
Cohesion: 0.40
Nodes (4): createSystemRoutes(), express, { socketEventDocs }, socketEventDocs

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): createFakeMapMatcher(), encodePolyline6(), encodeSigned()

## Knowledge Gaps
- **346 isolated node(s):** `{ Errors }`, `{ normalizeSocialProfile }`, `{ classifyRefreshSession }`, `{ tokenBlacklistKey, userSessionKey, userSessionsPattern }`, `{ createSafeMetrics }` (+341 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Errors` connect `Community 2` to `Community 0`, `Community 36`, `Community 5`, `Community 6`, `Community 7`, `Community 38`, `Community 9`, `Community 10`, `Community 11`, `Community 17`, `Community 22`, `Community 25`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `configureApp()` connect `Community 27` to `Community 1`, `Community 3`, `Community 39`, `Community 7`, `Community 42`, `Community 43`, `Community 12`, `Community 25`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `createSafeMetrics()` connect `Community 13` to `Community 32`, `Community 3`, `Community 5`, `Community 37`, `Community 40`, `Community 9`, `Community 10`, `Community 21`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `configureApp()` (e.g. with `app.js` and `notFoundHandler()`) actually correct?**
  _`configureApp()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ Errors }`, `{ normalizeSocialProfile }`, `{ classifyRefreshSession }` to the rest of the system?**
  _346 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03838383838383838 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07171717171717172 - nodes in this community are weakly interconnected._