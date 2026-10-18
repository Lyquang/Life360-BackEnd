function createLiveTrailDeltaPublisher({ realtime, policy, logger = console }) {
  const pending = new Map();

  function publicPoint(point) {
    return {
      seq: point.seq,
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt: point.recordedAt,
      ...(point.accuracy !== undefined && { accuracy: point.accuracy }),
      ...(point.motionState !== undefined && { motionState: point.motionState }),
      ...(point.pointId !== undefined && { pointId: point.pointId }),
    };
  }

  function payloadFor(queue, points = queue.points) {
    return {
      userId: queue.userId,
      trailId: queue.trailId,
      revision: queue.revision,
      afterSeq: queue.afterSeq,
      fromSeq: points[0].seq,
      toSeq: points.at(-1).seq,
      points,
      matchedUpdates: [],
    };
  }

  function clearTimer(queue) {
    if (queue?.timer) clearTimeout(queue.timer);
  }

  function flush(trailId) {
    const queue = pending.get(trailId);
    if (!queue || queue.points.length === 0) return;
    pending.delete(trailId);
    clearTimer(queue);
    realtime.emitToLiveTrail(trailId, 'journey:trail_delta', payloadFor(queue));
  }

  function schedule(queue) {
    queue.timer = setTimeout(() => flush(queue.trailId), policy.deltaFlushMs);
    queue.timer.unref?.();
  }

  function newQueue({ userId, result, afterSeq }) {
    const queue = {
      userId: String(userId),
      trailId: result.trailId,
      revision: result.revision,
      afterSeq,
      points: [],
      timer: null,
    };
    pending.set(result.trailId, queue);
    schedule(queue);
    return queue;
  }

  function enqueue({ userId, result }) {
    if (result.inserted.length === 0) return;
    let queue = pending.get(result.trailId);
    if (
      queue &&
      (queue.revision !== result.revision || queue.points.at(-1)?.seq !== result.afterSeq)
    ) {
      flush(result.trailId);
      queue = null;
    }
    let nextAfterSeq = result.afterSeq;

    for (const inserted of result.inserted) {
      const point = publicPoint(inserted);
      if (!queue) queue = newQueue({ userId, result, afterSeq: nextAfterSeq });
      const candidate = [...queue.points, point];
      const exceedsCount = candidate.length > policy.deltaMaxPoints;
      const exceedsBytes = Buffer.byteLength(JSON.stringify(payloadFor(queue, candidate))) > policy.deltaMaxBytes;
      if (queue.points.length > 0 && (exceedsCount || exceedsBytes)) {
        nextAfterSeq = queue.points.at(-1).seq;
        flush(result.trailId);
        queue = newQueue({ userId, result, afterSeq: nextAfterSeq });
      }
      queue.points.push(point);
      nextAfterSeq = point.seq;
      if (queue.points.length >= policy.deltaMaxPoints) {
        flush(result.trailId);
        queue = null;
      }
    }
  }

  function reset({ userId, result }) {
    const queue = pending.get(result.trailId);
    clearTimer(queue);
    pending.delete(result.trailId);
    realtime.emitToLiveTrail(result.trailId, 'journey:trail_reset', {
      userId: String(userId),
      trailId: result.trailId,
      revision: result.revision,
    });
  }

  function publishRealtime({ userId, projection }) {
    try {
      for (const result of projection?.results || []) {
        if (result.inserted.length === 0) continue;
        if (result.lateArrival) reset({ userId, result });
        else enqueue({ userId, result });
      }
    } catch (error) {
      logger.error('Live trail delta publication failed; existing location flow continues.', {
        errorName: error?.name || 'Error',
      });
    }
  }

  function publishBatchReset({ userId, projection }) {
    try {
      for (const result of projection?.results || []) {
        if (result.inserted.length > 0) reset({ userId, result });
      }
    } catch (error) {
      logger.error('Live trail batch reset publication failed; batch sync continues.', {
        errorName: error?.name || 'Error',
      });
    }
  }

  function close() {
    for (const queue of pending.values()) clearTimer(queue);
    pending.clear();
  }

  return { publishRealtime, publishBatchReset, flush, close };
}

module.exports = { createLiveTrailDeltaPublisher };
