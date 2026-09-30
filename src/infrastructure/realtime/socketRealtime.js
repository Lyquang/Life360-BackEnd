const rooms = {
  user: (userId) => `user:${userId}`,
  group: (groupId) => `group:${groupId}`,
  conversation: (conversationId) => `conversation:${conversationId}`,
};

/** Realtime port implemented with Socket.IO. Use cases only see these methods. */
function createSocketRealtime(io) {
  function to(room, exceptSocketId) {
    const operator = io.to(room);
    return exceptSocketId ? operator.except(exceptSocketId) : operator;
  }

  return {
    rooms,

    emitToUser(userId, event, payload) {
      io.to(rooms.user(userId)).emit(event, payload);
    },

    emitToGroup(groupId, event, payload, { exceptSocketId } = {}) {
      to(rooms.group(groupId), exceptSocketId).emit(event, payload);
    },

    emitToConversation(conversationId, event, payload, { exceptSocketId } = {}) {
      to(rooms.conversation(conversationId), exceptSocketId).emit(event, payload);
    },

    /** Makes every connected device of the user join the room (e.g. after joining a group). */
    subscribeUserToGroup(userId, groupId) {
      io.in(rooms.user(userId)).socketsJoin(rooms.group(groupId));
    },

    subscribeUserToConversation(userId, conversationId) {
      io.in(rooms.user(userId)).socketsJoin(rooms.conversation(conversationId));
    },

    async countGroupSockets(groupId) {
      return (await io.in(rooms.group(groupId)).fetchSockets()).length;
    },

    async countUserSockets(userId) {
      return (await io.in(rooms.user(userId)).fetchSockets()).length;
    },
  };
}

module.exports = { createSocketRealtime, rooms };
