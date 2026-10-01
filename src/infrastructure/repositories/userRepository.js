const User = require('../database/models/User');

const PUBLIC_PROFILE_FIELDS = 'name avatar isOnline lastSeenAt';

module.exports = {
  create({ name, email, passwordHash, avatar }) {
    return User.create({ name, email, password: passwordHash, avatar });
  },

  existsByEmail(email) {
    return User.exists({ email });
  },

  findByEmail(email) {
    return User.findOne({ email });
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

  updateSocialProfile(id, { name, avatarUrl }) {
    const update = { isOnline: true };
    if (name) update.name = name;
    if (avatarUrl !== undefined) update.avatar = avatarUrl;
    return User.findByIdAndUpdate(id, update, { new: true });
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
