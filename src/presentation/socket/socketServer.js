const { registerLocationGateway } = require('./gateways/locationGateway');
const { registerChatGateway } = require('./gateways/chatGateway');
const { registerLiveTrailGateway } = require('./gateways/liveTrailGateway');
const { newConnectionId, newRequestId, withLogContext } = require('../../infrastructure/observability/logContext');
const { createSocketMeasurement } = require('./socketMetrics');
const { withSpan } = require('../../infrastructure/observability/tracing');

function registerSocketServer(
  io,
  { auth, location, chat, liveTrailWatch, liveTrailAccessInvalidator, realtime, liveTrailPolicy, logger = console, metrics }
) {
  const measure = createSocketMeasurement(metrics);
  if (metrics?.enabled) metrics.addCollector(() => {
    const namespace = io.of('/');
    let watches = 0;
    for (const socket of namespace.sockets.values()) watches += socket.data.watchedTrails?.size || 0;
    metrics.set('socket_connections', { scope: 'default' }, namespace.sockets.size);
    metrics.set('socket_rooms', { scope: 'default' }, namespace.adapter.rooms.size);
    metrics.set('socket_watches', { scope: 'default' }, watches);
  });
  io.use((socket, next) => measure('handshake', async (mark) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('missing token');
      const authenticated = await auth.authenticateToken(token);
      const user = authenticated.user;
      socket.data.user = { id: user._id.toString(), name: user.name, batteryLevel: user.batteryLevel };
      socket.data.familyId = authenticated.auth.familyId;
      next();
    } catch {
      mark('rejected');
      next(new Error('Authentication error'));
    }
  }));

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const connectionId = newConnectionId();
    const withEventContext = (event, callback) =>
      withLogContext({ connectionId, eventId: newRequestId(), event }, () =>
        withSpan(`socket ${event}`, { 'messaging.system': 'socket.io', 'messaging.operation.name': event },
          () => measure(event, callback)));
    withEventContext('connect', () => logger.log('SOCKET_CONNECTED'));

    // Handlers are registered synchronously so events sent right after connect are never dropped.
    socket.join(realtime.rooms.user(user.id));
    if (socket.data.familyId) socket.join(realtime.rooms.session(socket.data.familyId));
    registerLocationGateway(socket, { location, logger, withEventContext });
    registerChatGateway(socket, { chat, logger, withEventContext });
    registerLiveTrailGateway(socket, {
      liveTrailWatch,
      liveTrailAccessInvalidator,
      realtime,
      policy: liveTrailPolicy,
      logger,
      withEventContext,
    });

    socket.on('disconnect', () => withEventContext('disconnect', (mark) => {
      logger.log('SOCKET_DISCONNECTED');
      return location
        .disconnect({ userId: user.id, userName: user.name })
        .catch(() => { mark('error'); logger.error('SOCKET_DISCONNECT_FAILED'); });
    }));

    withEventContext('session:ready', (mark) => (async () => {
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
    })().catch(() => { mark('error'); logger.error('SOCKET_SESSION_INIT_FAILED'); }));
  });
}

module.exports = { registerSocketServer };
