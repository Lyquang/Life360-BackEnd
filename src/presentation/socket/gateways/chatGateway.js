const { AppError, Errors } = require('../../../domain/errors');
const { formatIssues } = require('../../dto/common');
const { sendMessagePayload, markReadPayload, typingPayload } = require('../../dto/chat.schemas');

const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX_MESSAGES = 20;

function createSlidingWindowLimiter(max, windowMs) {
  const hits = [];
  return function isLimited() {
    const now = Date.now();
    while (hits.length && now - hits[0] > windowMs) hits.shift();
    if (hits.length >= max) return true;
    hits.push(now);
    return false;
  };
}

function registerChatGateway(socket, { chat, logger = console }) {
  const user = socket.data.user;
  const isRateLimited = createSlidingWindowLimiter(RATE_MAX_MESSAGES, RATE_WINDOW_MS);

  function fail(event, ack, error) {
    const known = error instanceof AppError;
    if (!known) logger.error(`❌ ${event} failed for ${user.id}:`, error);
    const body = {
      success: false,
      status: known ? error.status : 500,
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'Failed to process request.',
      ...(known && error.details && { errors: error.details }),
    };
    if (typeof ack === 'function') ack(body);
    else socket.emit('chat:error', { event, ...body });
  }

  /** Validates the payload with Zod, runs the handler and answers through the ack (or chat:error). */
  function on(event, schema, handler) {
    socket.on(event, async (payload, ack) => {
      try {
        const parsed = schema.safeParse(payload);
        if (!parsed.success) throw Errors.validation(formatIssues(parsed.error));
        const data = await handler(parsed.data);
        if (typeof ack === 'function') ack({ success: true, data });
      } catch (error) {
        fail(event, ack, error);
      }
    });
  }

  on('chat:send_message', sendMessagePayload, (dto) => {
    if (isRateLimited()) throw Errors.tooManyRequests('Too many messages. Please slow down.');
    return chat.sendMessage({
      userId: user.id,
      userName: user.name,
      conversationId: dto.conversationId,
      message: dto,
      exceptSocketId: socket.id,
    });
  });

  on('chat:mark_read', markReadPayload, (dto) =>
    chat.markRead({ userId: user.id, conversationId: dto.conversationId, messageId: dto.messageId })
  );

  // Fire-and-forget: invalid or unauthorized typing events are silently dropped.
  socket.on('chat:typing', async (payload) => {
    const parsed = typingPayload.safeParse(payload);
    if (!parsed.success) return;
    try {
      await chat.notifyTyping({
        userId: user.id,
        userName: user.name,
        conversationId: parsed.data.conversationId,
        isTyping: parsed.data.isTyping,
        exceptSocketId: socket.id,
      });
    } catch (error) {
      if (!(error instanceof AppError)) logger.error('❌ chat:typing failed:', error.message);
    }
  });
}

module.exports = { registerChatGateway, RATE_MAX_MESSAGES };
