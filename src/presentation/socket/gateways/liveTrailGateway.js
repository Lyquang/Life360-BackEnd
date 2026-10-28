const { AppError, Errors } = require('../../../domain/errors');
const { outcomeForError } = require('../socketMetrics');
const { formatIssues } = require('../../dto/common');
const { liveTrailWatchPayload } = require('../../dto/liveTrail.schemas');

function createSlidingWindowLimiter(max, windowMs) {
  const hits = [];
  return function isLimited() {
    const now = Date.now();
    while (hits.length && now - hits[0] >= windowMs) hits.shift();
    if (hits.length >= max) return true;
    hits.push(now);
    return false;
  };
}

function registerLiveTrailGateway(
  socket,
  { liveTrailWatch, liveTrailAccessInvalidator, realtime, policy, logger = console,
    withEventContext = (event, callback) => callback() }
) {
  const requesterId = socket.data.user.id;
  const watched = new Map();
  const isRateLimited = createSlidingWindowLimiter(policy.watchActionsPerMinute, 60 * 1000);
  socket.data.watchedTrails = watched;

  function watchKey(userId, date) {
    return `${userId}:${date}`;
  }

  function failure(error) {
    const known = error instanceof AppError;
    if (!known) logger.error('LIVE_TRAIL_SOCKET_ACTION_FAILED');
    return {
      ok: false,
      status: known ? error.status : 500,
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'Failed to process live trail action.',
      ...(known && error.details && { errors: error.details }),
    };
  }

  function parse(payload) {
    const parsed = liveTrailWatchPayload.safeParse(payload);
    if (!parsed.success) throw Errors.validation(formatIssues(parsed.error));
    return parsed.data;
  }

  function enforceRateLimit() {
    if (isRateLimited()) throw Errors.tooManyRequests('Too many live trail watch actions.');
  }

  socket.on('journey:watch', (payload, ack) => withEventContext('journey:watch', async (mark = () => {}) => {
    try {
      enforceRateLimit();
      const dto = parse(payload);
      const date = liveTrailWatch.normalizeDate(dto.date);
      const key = watchKey(dto.userId, date);
      const existing = watched.get(key);
      if (!existing && watched.size >= policy.maxWatchesPerSocket) {
        throw Errors.tooManyRequests(`A socket can watch at most ${policy.maxWatchesPerSocket} live trails.`);
      }
      const result = await liveTrailWatch.watch({ requesterId, ...dto, date });
      if (existing && existing.trailId !== result.trailId) {
        await socket.leave(realtime.rooms.liveTrail(existing.trailId));
      }
      await socket.join(realtime.rooms.liveTrail(result.trailId));
      watched.set(key, result);
      if (typeof ack === 'function') ack({ ok: true, ...result });
    } catch (error) {
      mark(outcomeForError(error));
      if (typeof ack === 'function') ack(failure(error));
    }
  }));

  socket.on('journey:unwatch', (payload, ack) => withEventContext('journey:unwatch', async (mark = () => {}) => {
    try {
      enforceRateLimit();
      const dto = parse(payload);
      const date = liveTrailWatch.normalizeDate(dto.date);
      const key = watchKey(dto.userId, date);
      const existing = watched.get(key);
      if (existing) {
        watched.delete(key);
        await socket.leave(realtime.rooms.liveTrail(existing.trailId));
      }
      if (typeof ack === 'function') ack({ ok: true, removed: Boolean(existing) });
    } catch (error) {
      mark(outcomeForError(error));
      if (typeof ack === 'function') ack(failure(error));
    }
  }));

  function revalidateWatches(filter = {}) {
    return withEventContext('journey:lease', async (mark = () => {}) => {
      for (const [key, watch] of [...watched]) {
        if (filter.targetUserId && String(watch.userId) !== filter.targetUserId) continue;
        if (
          filter.memberUserId &&
          requesterId !== filter.memberUserId &&
          String(watch.userId) !== filter.memberUserId
        ) continue;
        try {
          await liveTrailWatch.revalidate({ requesterId, ...watch });
        } catch (error) {
          if (!(error instanceof AppError)) {
            mark('error');
            logger.error('LIVE_TRAIL_LEASE_REVALIDATION_FAILED');
            continue;
          }
          const reason = error.code === 'LOCATION_SHARING_PAUSED'
            ? 'sharing_paused'
            : error.status === 403
            ? 'permission_revoked'
            : 'trail_expired';
          watched.delete(key);
          await socket.leave(realtime.rooms.liveTrail(watch.trailId));
          socket.emit('journey:trail_closed', {
            userId: watch.userId,
            trailId: watch.trailId,
            reason,
          });
        }
      }
    });
  }

  const leaseTimer = setInterval(() => {
    revalidateWatches().catch(() => {
      withEventContext('journey:lease', () => logger.error('LIVE_TRAIL_LEASE_CYCLE_FAILED'));
    });
  }, policy.watchLeaseMs);
  leaseTimer.unref?.();
  const unregisterInvalidator = liveTrailAccessInvalidator.register(socket.id, revalidateWatches);

  function cleanup() {
    clearInterval(leaseTimer);
    unregisterInvalidator();
    watched.clear();
  }
  socket.once('disconnect', cleanup);
  return { cleanup, revalidateWatches };
}

module.exports = { registerLiveTrailGateway };
