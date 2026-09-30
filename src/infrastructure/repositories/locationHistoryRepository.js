const LocationHistory = require('../database/models/LocationHistory');

module.exports = {
  create({ userId, latitude, longitude, at }) {
    return LocationHistory.create({
      userId,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      timestamp: at,
    });
  },

  listForUserBetween(userId, start, end) {
    return LocationHistory.find({ userId, timestamp: { $gte: start, $lt: end } })
      .sort({ timestamp: 1 })
      .lean();
  },
};
