const mongoose = require('mongoose');

const favoritePlaceSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Place name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['restaurant', 'entertainment', 'cafe', 'shopping', 'other'],
        message: 'Category must be: restaurant, entertainment, cafe, shopping, or other',
      },
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
              coords[0] >= -180 && coords[0] <= 180 &&
              coords[1] >= -90 && coords[1] <= 90
            );
          },
          message: 'Invalid coordinates. Format: [longitude, latitude]',
        },
      },
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ────────────────────────────────────────────────
favoritePlaceSchema.index({ location: '2dsphere' });

// ─── Transform output ───────────────────────────────────────
favoritePlaceSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    if (ret.location && ret.location.coordinates) {
      ret.latitude = ret.location.coordinates[1];
      ret.longitude = ret.location.coordinates[0];
    }
    return ret;
  },
});

module.exports = mongoose.model('FavoritePlace', favoritePlaceSchema);
