const LocationHistory = require('../database/models/LocationHistory');
const { createHash } = require('node:crypto');

function dedupeKey({ latitude, longitude, recordedAt }) {
  const timestamp = recordedAt instanceof Date ? recordedAt.getTime() : new Date(recordedAt).getTime();
  return createHash('sha256')
    .update(`${timestamp}:${String(latitude)}:${String(longitude)}`)
    .digest('base64url');
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

module.exports = {
  async create({ userId, latitude, longitude, at, accuracy, pointId, motionState }) {
    const key = dedupeKey({ latitude, longitude, recordedAt: at });
    const identities = [{ dedupeKey: key }];
    if (pointId) identities.push({ pointId });
    try {
      return await LocationHistory.updateOne(
        { userId, $or: identities },
        {
          $setOnInsert: {
            userId,
            dedupeKey: key,
            ...(pointId && { pointId }),
            location: { type: 'Point', coordinates: [longitude, latitude] },
            timestamp: at,
            ...(accuracy !== undefined && { accuracy }),
            ...(motionState !== undefined && { motionState }),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) return { acknowledged: true, upsertedCount: 0, matchedCount: 1 };
      throw error;
    }
  },

  async insertBatchIdempotent({ userId, points }) {
    if (points.length === 0) return { accepted: [], duplicates: [] };

    const inserted = await Promise.all(
      points.map(async (point) => {
        const key = dedupeKey(point);
        try {
          const result = await LocationHistory.updateOne(
            { userId, $or: [{ pointId: point.pointId }, { dedupeKey: key }] },
            {
              $setOnInsert: {
                userId,
                pointId: point.pointId,
                dedupeKey: key,
                location: { type: 'Point', coordinates: [point.longitude, point.latitude] },
                timestamp: point.recordedAt,
                ...(point.accuracy !== undefined && { accuracy: point.accuracy }),
                ...(point.motionState !== undefined && { motionState: point.motionState }),
              },
            },
            { upsert: true }
          );
          return result.upsertedCount > 0;
        } catch (error) {
          if (isDuplicateKeyError(error)) return false;
          throw error;
        }
      })
    );
    return {
      accepted: points.filter((_, index) => inserted[index]).map((point) => point.pointId),
      duplicates: points.filter((_, index) => !inserted[index]).map((point) => point.pointId),
    };
  },

  listForUserBetween(userId, start, end) {
    return LocationHistory.find({ userId, timestamp: { $gte: start, $lt: end } })
      .sort({ timestamp: 1 })
      .lean();
  },

  listRangePage({ userId, from, to, cursor, limit }) {
    const range = { timestamp: { $gte: from, $lte: to } };
    const filter = cursor
      ? {
          userId,
          $and: [
            range,
            {
              $or: [
                { timestamp: { $gt: cursor.timestamp } },
                { timestamp: cursor.timestamp, _id: { $gt: cursor.id } },
              ],
            },
          ],
        }
      : { userId, ...range };
    return LocationHistory.find(filter)
      .sort({ timestamp: 1, _id: 1 })
      .limit(limit + 1)
      .select('_id location timestamp accuracy pointId')
      .lean();
  },

  findLatestForUser(userId) {
    return LocationHistory.findOne({ userId })
      .sort({ timestamp: -1, _id: -1 })
      .select('_id location timestamp accuracy pointId motionState')
      .lean();
  },
};
