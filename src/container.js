const userRepo = require('./infrastructure/repositories/userRepository');
const groupRepo = require('./infrastructure/repositories/groupRepository');
const placeRepo = require('./infrastructure/repositories/placeRepository');
const locationHistoryRepo = require('./infrastructure/repositories/locationHistoryRepository');
const digestRepo = require('./infrastructure/repositories/digestRepository');
const conversationRepo = require('./infrastructure/repositories/conversationRepository');
const conversationMemberRepo = require('./infrastructure/repositories/conversationMemberRepository');
const messageRepo = require('./infrastructure/repositories/messageRepository');
const userSocialAccountRepo = require('./infrastructure/repositories/userSocialAccountRepository');
const passwordHasher = require('./infrastructure/security/passwordHasher');
const { createTokenService } = require('./infrastructure/security/tokenService');
const { createS3Storage } = require('./infrastructure/storage/s3Storage');
const { createSocketRealtime } = require('./infrastructure/realtime/socketRealtime');
const { createOAuthProviderFactory } = require('./infrastructure/oauth/oauthProviderFactory');
const { createUnitOfWork } = require('./infrastructure/database/unitOfWork');
const { createAuthUseCases } = require('./application/auth/authUseCases');
const { createGroupUseCases } = require('./application/groups/groupUseCases');
const { createPlaceUseCases } = require('./application/places/placeUseCases');
const { createHistoryUseCases } = require('./application/history/historyUseCases');
const { createDigestUseCases } = require('./application/digests/digestUseCases');
const { createLocationUseCases } = require('./application/location/locationUseCases');
const { createChatUseCases } = require('./application/chat/chatUseCases');

/** Composition root: wires infrastructure adapters into application use cases. */
function createContainer({ config, io, supportsTransactions, logger = console }) {
  const repos = {
    userRepo,
    groupRepo,
    placeRepo,
    locationHistoryRepo,
    digestRepo,
    conversationRepo,
    conversationMemberRepo,
    messageRepo,
    userSocialAccountRepo,
  };
  const services = {
    unitOfWork: createUnitOfWork({ supportsTransactions, logger }),
    realtime: createSocketRealtime(io),
    tokenService: createTokenService(config.jwt),
    passwordHasher,
    oauthProviderFactory: createOAuthProviderFactory({ config }),
    storage: config.storage ? createS3Storage(config.storage) : null,
    logger,
  };
  const deps = { ...repos, ...services };

  const useCases = {
    auth: createAuthUseCases(deps),
    groups: createGroupUseCases(deps),
    places: createPlaceUseCases(deps),
    history: createHistoryUseCases(deps),
    digests: createDigestUseCases(deps),
    location: createLocationUseCases(deps),
    chat: createChatUseCases(deps),
  };

  return { repos, services, useCases, deps };
}

module.exports = { createContainer };
