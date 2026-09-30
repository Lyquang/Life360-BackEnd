const User = require('../database/models/User');

const PUBLIC_PROFILE_FIELDS = 'name avatar isOnline lastSeenAt';

module.exports = {
  create({ name, email, passwordHash }) {
    return User.create({ name, email, password: passwordHash });
  },

  existsByEmail(email) {
    return User.exists({ email });
  },

  findByEmailWithPassword(email) {
    return User.findOne({ email }).select('+password');
  },

  findById(id) {
    return User.findById(id);
  },

  findManyByIds(ids) {
    return User.find({ _id: { $in: ids } }).select(PUBLIC_PROFILE_FIELDS).lean();
  },

  markOnline(id) {
    return User.updateOne({ _id: id }, { isOnline: true });
  },

  markOffline(id, at) {
    return User.updateOne({ _id: id }, { isOnline: false, lastSeenAt: at });
  },

  updateLastKnownLocation(id, { latitude, longitude, batteryLevel, durationMinutes, at }) {
    const update = {
      lastSeenAt: at,
      'lastKnownLocation.coordinates': [longitude, latitude],
      'lastKnownLocation.updatedAt': at,
      'lastKnownLocation.durationMinutes': durationMinutes,
    };
    if (batteryLevel !== undefined) update.batteryLevel = batteryLevel;
    return User.updateOne({ _id: id }, update);
  },
};
