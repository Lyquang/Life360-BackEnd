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
      matchedUpdates: queue.matchedUpdates,
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
      matchedUpdates: [],
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
      logger.error('LIVE_TRAIL_DELTA_PUBLICATION_FAILED');
    }
  }

  function publishBatchReset({ userId, projection }) {
    try {
      for (const result of projection?.results || []) {
        if (result.inserted.length > 0) reset({ userId, result });
      }
    } catch (error) {
      logger.error('LIVE_TRAIL_BATCH_RESET_FAILED');
    }
  }

  function publishMatchedUpdates({ userId, trailId, revision, lastSeq, updates }) {
    if (!updates?.length) return;
    const queue = pending.get(trailId);
    if (queue && queue.revision === revision) {
      const previousUpdates = queue.matchedUpdates;
      const combined = [...queue.matchedUpdates, ...updates];
      queue.matchedUpdates = combined;
      if (Buffer.byteLength(JSON.stringify(payloadFor(queue))) <= policy.deltaMaxBytes) return;
      queue.matchedUpdates = previousUpdates;
      flush(trailId);
    }

    let chunk = [];
    let needsReset = false;
    const emitChunk = () => {
      if (!chunk.length) return;
      realtime.emitToLiveTrail(trailId, 'journey:trail_delta', {
        userId: String(userId),
        trailId,
        revision,
        afterSeq: lastSeq,
        fromSeq: Math.min(...chunk.map((update) => update.fromSeq)),
        toSeq: Math.max(...chunk.map((update) => update.toSeq)),
        points: [],
        matchedUpdates: chunk,
      });
      chunk = [];
    };

    for (const update of updates) {
      const candidate = [...chunk, update];
      const payload = {
        userId: String(userId), trailId, revision, afterSeq: lastSeq,
        fromSeq: Math.min(...candidate.map((item) => item.fromSeq)),
        toSeq: Math.max(...candidate.map((item) => item.toSeq)),
        points: [], matchedUpdates: candidate,
      };
      if (Buffer.byteLength(JSON.stringify(payload)) <= policy.deltaMaxBytes) {
        chunk = candidate;
        continue;
      }
      emitChunk();
      const single = { ...payload, fromSeq: update.fromSeq, toSeq: update.toSeq, matchedUpdates: [update] };
      if (Buffer.byteLength(JSON.stringify(single)) <= policy.deltaMaxBytes) chunk = [update];
      else needsReset = true;
    }
    emitChunk();
    if (needsReset) {
      logger.warn('LIVE_TRAIL_MATCH_UPDATE_OVERSIZED');
      realtime.emitToLiveTrail(trailId, 'journey:trail_reset', {
        userId: String(userId), trailId, revision,
      });
    }
  }

  function close() {
    for (const queue of pending.values()) clearTimer(queue);
    pending.clear();
  }

  return { publishRealtime, publishBatchReset, publishMatchedUpdates, flush, close };
}

module.exports = { createLiveTrailDeltaPublisher };
