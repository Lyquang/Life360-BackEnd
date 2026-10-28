const rooms = {
  user: (userId) => `user:${userId}`,
  group: (groupId) => `group:${groupId}`,
  conversation: (conversationId) => `conversation:${conversationId}`,
  session: (familyId) => `session:${familyId}`,
  liveTrail: (trailId) => `journey:trail:${trailId}`,
};

/** Realtime port implemented with Socket.IO. Use cases only see these methods. */
function createSocketRealtime(io, metrics) {
  const samples = new Map();
  function record(channel, payload) {
    try {
      if (!metrics?.enabled) return;
      metrics.increment('socket_broadcasts_total', { channel });
      const next = ((samples.get(channel) || 0) + 1) % 10;
      samples.set(channel, next);
      if (next === 0) metrics.observe('realtime_payload_bytes', { channel }, Buffer.byteLength(JSON.stringify(payload)));
    } catch { /* Keep delivery independent of telemetry. */ }
  }
  function to(room, exceptSocketId) {
    const operator = io.to(room);
    return exceptSocketId ? operator.except(exceptSocketId) : operator;
  }

  return {
    rooms,

    emitToUser(userId, event, payload) {
      io.to(rooms.user(userId)).emit(event, payload);
      record('user', payload);
    },

    emitToGroup(groupId, event, payload, { exceptSocketId } = {}) {
      to(rooms.group(groupId), exceptSocketId).emit(event, payload);
      record('group', payload);
    },

    emitToConversation(conversationId, event, payload, { exceptSocketId } = {}) {
      to(rooms.conversation(conversationId), exceptSocketId).emit(event, payload);
      record('conversation', payload);
    },

    emitToLiveTrail(trailId, event, payload) {
      io.to(rooms.liveTrail(trailId)).emit(event, payload);
      record('trail', payload);
    },

    /** Makes every connected device of the user join the room (e.g. after joining a group). */
    subscribeUserToGroup(userId, groupId) {
      io.in(rooms.user(userId)).socketsJoin(rooms.group(groupId));
    },

    subscribeUserToConversation(userId, conversationId) {
      io.in(rooms.user(userId)).socketsJoin(rooms.conversation(conversationId));
    },

    unsubscribeUserFromGroup(userId, groupId) {
      io.in(rooms.user(userId)).socketsLeave(rooms.group(groupId));
    },

    unsubscribeUserFromConversation(userId, conversationId) {
      io.in(rooms.user(userId)).socketsLeave(rooms.conversation(conversationId));
    },

    async countGroupSockets(groupId) {
      return (await io.in(rooms.group(groupId)).fetchSockets()).length;
    },

    async countUserSockets(userId) {
      return (await io.in(rooms.user(userId)).fetchSockets()).length;
    },

    disconnectSession(familyId) {
      if (!familyId) return Promise.resolve();
      return io.in(rooms.session(familyId)).disconnectSockets(true);
    },

    disconnectUser(userId) {
      return io.in(rooms.user(userId)).disconnectSockets(true);
    },
  };
}

module.exports = { createSocketRealtime, rooms };
