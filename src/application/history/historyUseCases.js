const { Errors } = require('../../domain/errors');
const { buildDayJourney } = require('../../domain/journey');
const { localDayRange, formatLocalDate } = require('../../domain/dates');
const { buildLiveTrailGaps, localDateFor } = require('../../domain/liveTrail');

function toPoint(entry) {
  return {
    id: String(entry._id),
    latitude: entry.location.coordinates[1],
    longitude: entry.location.coordinates[0],
    timestamp: new Date(entry.timestamp),
    recordedAt: new Date(entry.timestamp),
    ...(entry.accuracy !== undefined && { accuracy: entry.accuracy }),
  };
}

function encodeCursor(entry) {
  return Buffer.from(
    JSON.stringify({ v: 1, t: new Date(entry.timestamp).toISOString(), id: String(entry._id) })
  ).toString('base64url');
}

function decodeCursor(value) {
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const timestamp = new Date(cursor.t);
    if (cursor.v !== 1 || !Number.isFinite(timestamp.getTime()) || !/^[a-f\d]{24}$/i.test(cursor.id)) {
      throw new Error('Invalid cursor fields.');
    }
    return { timestamp, id: cursor.id };
  } catch {
    throw Errors.badRequest('Invalid history cursor.');
  }
}

function serializeHistoryPoint(entry) {
  return {
    id: entry._id,
    latitude: entry.location.coordinates[1],
    longitude: entry.location.coordinates[0],
    timestamp: entry.timestamp,
    recordedAt: entry.timestamp,
    ...(entry.accuracy !== undefined && { accuracy: entry.accuracy }),
    ...(entry.pointId !== undefined && { pointId: entry.pointId }),
  };
}

function publicGeometryPolicy(policy) {
  return {
    version: policy.version,
    gapThresholdSeconds: policy.gapThresholdSeconds,
    gapIndexSpace: policy.gapIndexSpace,
    toBoundary: policy.toBoundary,
    stayRadiusMeters: policy.stayRadiusMeters,
    minStayMinutes: policy.minStayMinutes,
  };
}

function serializeTrailPoint(point) {
  return {
    seq: point.seq,
    latitude: point.location.coordinates[1],
    longitude: point.location.coordinates[0],
    recordedAt: point.recordedAt,
    ...(point.accuracy !== undefined && { accuracy: point.accuracy }),
    ...(point.motionState !== undefined && { motionState: point.motionState }),
    ...(point.pointId !== undefined && { pointId: point.pointId }),
  };
}

function serializeTrailMatch(match) {
  return {
    segmentId: match.segmentId,
    fromSeq: match.fromSeq,
    toSeq: match.toSeq,
    status: match.status,
    matcher: match.matcher,
    sourceRevision: match.sourceRevision,
    generatedAt: match.updatedAt || match.createdAt,
    ...(match.geometry?.data && {
      geometry: { encoding: match.geometry.encoding, data: match.geometry.data },
    }),
    ...(match.confidence !== undefined && { confidence: match.confidence }),
  };
}

function createHistoryUseCases({
  groupRepo,
  locationHistoryRepo,
  journeyGeometryPolicy,
  historyRangePolicy,
  historyTimeZone,
  liveTrailRepo,
  liveTrailPolicy,
  locationAccessPolicy,
}) {
  async function assertCanView(requesterId, targetUserId) {
    await locationAccessPolicy.assertCanViewLocation(requesterId, targetUserId);
  }

  async function getTodayHistory({ requesterId, userId }) {
    await assertCanView(requesterId, userId);
    const { start, end } = localDayRange();
    const history = await locationHistoryRepo.listForUserBetween(userId, start, end);
    return {
      date: formatLocalDate(start),
      points: history.map((entry) => ({
        id: entry._id,
        latitude: entry.location.coordinates[1],
        longitude: entry.location.coordinates[0],
        timestamp: entry.timestamp,
      })),
    };
  }

  async function getRangeHistory({ requesterId, userId, from, to, limit, cursor }) {
    await assertCanView(requesterId, userId);
    const now = Date.now();
    const maxRangeMs = historyRangePolicy.maxRangeMs;
    const rangeFrom = from || new Date(to.getTime() - maxRangeMs);
    const rangeTo = to || new Date(Math.min(from.getTime() + maxRangeMs, now));
    if (rangeFrom >= rangeTo) throw Errors.badRequest('History range must have from before to.');
    if (rangeTo - rangeFrom > maxRangeMs) {
      throw Errors.badRequest('History range exceeds the configured maximum.');
    }
    const pageLimit = limit || historyRangePolicy.defaultLimit;
    if (pageLimit > historyRangePolicy.maxLimit) {
      throw Errors.badRequest(`History limit cannot exceed ${historyRangePolicy.maxLimit}.`);
    }
    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (
      decodedCursor &&
      (decodedCursor.timestamp < rangeFrom || decodedCursor.timestamp > rangeTo)
    ) {
      throw Errors.badRequest('History cursor is outside the requested range.');
    }
    const rows = await locationHistoryRepo.listRangePage({
      userId,
      from: rangeFrom,
      to: rangeTo,
      cursor: decodedCursor,
      limit: pageLimit,
    });
    const hasMore = rows.length > pageLimit;
    const page = hasMore ? rows.slice(0, pageLimit) : rows;
    return {
      count: page.length,
      data: page.map(serializeHistoryPoint),
      nextCursor: hasMore ? encodeCursor(page.at(-1)) : null,
      range: { from: rangeFrom.toISOString(), to: rangeTo.toISOString() },
      timeZone: historyTimeZone,
      rangePolicy: {
        fromBoundary: 'inclusive',
        toBoundary: 'inclusive',
        cursorBoundary: 'exclusive',
      },
    };
  }

  async function getDayJourney({ requesterId, userId, date, detail, includePath }) {
    await assertCanView(requesterId, userId);
    const { start, end } = localDayRange(date);
    const history = await locationHistoryRepo.listForUserBetween(userId, start, end);
    const result = {
      date: formatLocalDate(start),
      userId,
      ...buildDayJourney(history.map(toPoint), {
        geometry: detail === 'geometry',
        includePath: includePath ?? true,
        ...journeyGeometryPolicy,
      }),
    };
    if (detail === 'geometry') {
      result.timeZone = historyTimeZone;
      result.geometryPolicy = publicGeometryPolicy(journeyGeometryPolicy);
    }
    return result;
  }

  async function getLiveTrail({ requesterId, userId, date, afterSeq = 0, revision, limit }) {
    if (!liveTrailPolicy.enabled) {
      throw Errors.serviceUnavailable('Live trail is not enabled on this server.');
    }
    await assertCanView(requesterId, userId);
    const localDate = date || localDateFor(new Date(), liveTrailPolicy.timeZone);
    const trail = await liveTrailRepo.findForUserDate(userId, localDate);
    if (!trail) throw Errors.notFound('Live trail was not found for this user and date.');
    if (revision !== undefined && revision !== trail.revision) {
      throw Errors.trailRevisionChanged({
        trailId: String(trail._id),
        currentRevision: trail.revision,
        lastSeq: trail.lastSeq,
      });
    }

    const [rows, chronological, matches] = await Promise.all([
      liveTrailRepo.listPointsAfter({ trailId: trail._id, afterSeq, limit }),
      liveTrailRepo.listPointsChronological(trail._id),
      liveTrailPolicy.matcher.enabled
        ? liveTrailRepo.listMatches(trail._id, trail.revision)
        : Promise.resolve([]),
    ]);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const gaps = buildLiveTrailGaps(
      chronological.map(serializeTrailPoint),
      liveTrailPolicy
    );

    return {
      trailId: String(trail._id),
      userId: String(userId),
      date: localDate,
      timeZone: trail.timeZone,
      revision: trail.revision,
      lastSeq: trail.lastSeq,
      points: page.map(serializeTrailPoint),
      gaps,
      matched: matches.map(serializeTrailMatch),
      hasMore,
      nextAfterSeq: hasMore ? page.at(-1).seq : null,
    };
  }

  return { getTodayHistory, getRangeHistory, getDayJourney, getLiveTrail };
}

module.exports = { createHistoryUseCases };
