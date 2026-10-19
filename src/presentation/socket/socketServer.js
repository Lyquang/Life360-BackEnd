const { registerLocationGateway } = require('./gateways/locationGateway');
const { registerChatGateway } = require('./gateways/chatGateway');
const { registerLiveTrailGateway } = require('./gateways/liveTrailGateway');

function registerSocketServer(
  io,
  { auth, location, chat, liveTrailWatch, liveTrailAccessInvalidator, realtime, liveTrailPolicy, logger = console }
) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('missing token');
      const authenticated = await auth.authenticateToken(token);
      const user = authenticated.user;
      socket.data.user = { id: user._id.toString(), name: user.name, batteryLevel: user.batteryLevel };
      socket.data.familyId = authenticated.auth.familyId;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.log(`🟢 User connected: ${user.name} (${user.id})`);

    // Handlers are registered synchronously so events sent right after connect are never dropped.
    socket.join(realtime.rooms.user(user.id));
    if (socket.data.familyId) socket.join(realtime.rooms.session(socket.data.familyId));
    registerLocationGateway(socket, { location, logger });
    registerChatGateway(socket, { chat, logger });
    registerLiveTrailGateway(socket, {
      liveTrailWatch,
      liveTrailAccessInvalidator,
      realtime,
      policy: liveTrailPolicy,
      logger,
    });

    socket.on('disconnect', (reason) => {
      logger.log(`🔴 User disconnected: ${user.name} (${user.id}) - ${reason}`);
      location
        .disconnect({ userId: user.id, userName: user.name })
        .catch((error) => logger.error(`❌ Error handling disconnect for ${user.name}:`, error.message));
    });

    (async () => {
      const [{ groupIds }, conversationIds] = await Promise.all([
        location.connect({ userId: user.id, userName: user.name, socketId: socket.id }),
        chat.getConversationIdsForUser(user.id),
      ]);
      if (socket.disconnected) {
        // Disconnected while we were marking the user online: undo it.
        await location.disconnect({ userId: user.id, userName: user.name });
        return;
      }
      socket.join([...groupIds.map(realtime.rooms.group), ...conversationIds.map(realtime.rooms.conversation)]);
      socket.emit('session:ready', { groupIds, conversationIds });
    })().catch((error) => logger.error(`❌ Error initializing session for ${user.name}:`, error.message));
  });
}

module.exports = { registerSocketServer };
