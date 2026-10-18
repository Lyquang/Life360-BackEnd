const { LiveTrail, LiveTrailPoint } = require('../database/models/LiveTrail');

function existingIdentityFilter(trailId, points) {
  const identities = points.flatMap((point) => [
    { dedupeKey: point.dedupeKey },
    ...(point.pointId ? [{ pointId: point.pointId }] : []),
  ]);
  return { trailId, $or: identities };
}

module.exports = {
  async appendPoints({ userId, localDate, timeZone, points, session }) {
    if (points.length === 0) return null;
    const latestExpiry = new Date(Math.max(...points.map((point) => point.expiresAt.getTime())));
    let trail = await LiveTrail.findOneAndUpdate(
      { userId, localDate },
      {
        $setOnInsert: {
          userId,
          localDate,
          timeZone,
          revision: 1,
          lastSeq: 0,
          maxRecordedAt: null,
        },
        $max: { expiresAt: latestExpiry },
      },
      { upsert: true, new: true, session, setDefaultsOnInsert: true }
    );

    const existing = await LiveTrailPoint.find(existingIdentityFilter(trail._id, points))
      .select('pointId dedupeKey')
      .session(session)
      .lean();
    const existingPointIds = new Set(existing.map((point) => point.pointId).filter(Boolean));
    const existingDedupeKeys = new Set(existing.map((point) => point.dedupeKey));
    const fresh = points.filter(
      (point) =>
        !existingDedupeKeys.has(point.dedupeKey) &&
        (!point.pointId || !existingPointIds.has(point.pointId))
    );
    if (fresh.length === 0) {
      return {
        trailId: String(trail._id),
        revision: trail.revision,
        lastSeq: trail.lastSeq,
        afterSeq: trail.lastSeq,
        lateArrival: false,
        inserted: [],
        duplicateCount: points.length,
      };
    }

    const maxRecordedAt = new Date(Math.max(...fresh.map((point) => point.recordedAt.getTime())));
    const lateArrival = Boolean(
      trail.maxRecordedAt && fresh.some((point) => point.recordedAt < trail.maxRecordedAt)
    );
    const previous = await LiveTrail.findOneAndUpdate(
      { _id: trail._id },
      {
        $inc: { lastSeq: fresh.length, ...(lateArrival && { revision: 1 }) },
        $max: { maxRecordedAt, expiresAt: latestExpiry },
      },
      { new: false, session }
    );
    const documents = fresh.map((point, index) => ({
      trailId: trail._id,
      userId,
      seq: previous.lastSeq + index + 1,
      location: { type: 'Point', coordinates: [point.longitude, point.latitude] },
      recordedAt: point.recordedAt,
      dedupeKey: point.dedupeKey,
      expiresAt: point.expiresAt,
      ...(point.pointId && { pointId: point.pointId }),
      ...(point.accuracy !== undefined && { accuracy: point.accuracy }),
      ...(point.motionState !== undefined && { motionState: point.motionState }),
    }));
    await LiveTrailPoint.insertMany(documents, { session });
    trail = await LiveTrail.findById(trail._id).session(session).lean();

    return {
      trailId: String(trail._id),
      revision: trail.revision,
      lastSeq: trail.lastSeq,
      afterSeq: previous.lastSeq,
      lateArrival,
      inserted: documents.map((point) => ({
        seq: point.seq,
        latitude: point.location.coordinates[1],
        longitude: point.location.coordinates[0],
        recordedAt: point.recordedAt,
        ...(point.pointId && { pointId: point.pointId }),
        ...(point.accuracy !== undefined && { accuracy: point.accuracy }),
        ...(point.motionState !== undefined && { motionState: point.motionState }),
      })),
      duplicateCount: points.length - fresh.length,
    };
  },

  findForUserDate(userId, localDate) {
    return LiveTrail.findOne({ userId, localDate }).lean();
  },

  listPointsAfter({ trailId, afterSeq, limit }) {
    return LiveTrailPoint.find({ trailId, seq: { $gt: afterSeq } })
      .sort({ seq: 1 })
      .limit(limit + 1)
      .lean();
  },

  listPointsChronological(trailId) {
    return LiveTrailPoint.find({ trailId })
      .sort({ recordedAt: 1, seq: 1 })
      .select('seq location recordedAt')
      .lean();
  },
};
