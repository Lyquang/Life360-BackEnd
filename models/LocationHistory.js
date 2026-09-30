const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: function (coords) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 && coords[0] <= 180 && // longitude
              coords[1] >= -90 && coords[1] <= 90      // latitude
            );
          },
          message: 'Invalid coordinates. Format: [longitude, latitude]',
        },
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// ─── Indexes ────────────────────────────────────────────────
locationHistorySchema.index({ location: '2dsphere' });
locationHistorySchema.index({ userId: 1, timestamp: -1 });

// ─── Transform output ───────────────────────────────────────
locationHistorySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // Provide latitude/longitude in a more friendly format
    if (ret.location && ret.location.coordinates) {
      ret.latitude = ret.location.coordinates[1];
      ret.longitude = ret.location.coordinates[0];
    }
    return ret;
  },
});

module.exports = mongoose.model('LocationHistory', locationHistorySchema);
