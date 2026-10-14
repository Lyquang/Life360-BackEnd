const LocationHistory = require('../database/models/LocationHistory');

module.exports = {
  create({ userId, latitude, longitude, at, accuracy }) {
    return LocationHistory.create({
      userId,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      timestamp: at,
      ...(accuracy !== undefined && { accuracy }),
    });
  },

  async insertBatchIdempotent({ userId, points }) {
    if (points.length === 0) return { accepted: [], duplicates: [] };

    const operations = points.map((point) => ({
      updateOne: {
        filter: { userId, pointId: point.pointId },
        update: {
          $setOnInsert: {
            userId,
            pointId: point.pointId,
            location: { type: 'Point', coordinates: [point.longitude, point.latitude] },
            timestamp: point.recordedAt,
            ...(point.accuracy !== undefined && { accuracy: point.accuracy }),
          },
        },
        upsert: true,
      },
    }));

    const result = await LocationHistory.bulkWrite(operations, { ordered: false });
    const upsertedIndexes = new Set(Object.keys(result.upsertedIds || {}).map(Number));
    return {
      accepted: points.filter((_, index) => upsertedIndexes.has(index)).map((point) => point.pointId),
      duplicates: points.filter((_, index) => !upsertedIndexes.has(index)).map((point) => point.pointId),
    };
  },

  listForUserBetween(userId, start, end) {
    return LocationHistory.find({ userId, timestamp: { $gte: start, $lt: end } })
      .sort({ timestamp: 1 })
      .lean();
  },
};
