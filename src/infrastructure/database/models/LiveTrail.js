const mongoose = require('mongoose');

const liveTrailSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    localDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timeZone: { type: String, required: true },
    revision: { type: Number, required: true, default: 1, min: 1 },
    lastSeq: { type: Number, required: true, default: 0, min: 0 },
    maxRecordedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

liveTrailSchema.index({ userId: 1, localDate: 1 }, { unique: true });
liveTrailSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const liveTrailPointSchema = new mongoose.Schema(
  {
    trailId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveTrail', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seq: { type: Number, required: true, min: 1 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates) =>
            coordinates.length === 2 &&
            coordinates[0] >= -180 && coordinates[0] <= 180 &&
            coordinates[1] >= -90 && coordinates[1] <= 90,
          message: 'Invalid coordinates. Format: [longitude, latitude]',
        },
      },
    },
    recordedAt: { type: Date, required: true },
    accuracy: { type: Number, min: 0 },
    motionState: {
      type: String,
      enum: ['stationary', 'walking', 'running', 'cycling', 'automotive', 'unknown'],
    },
    pointId: { type: String, trim: true },
    dedupeKey: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

liveTrailPointSchema.index({ trailId: 1, seq: 1 }, { unique: true });
liveTrailPointSchema.index(
  { trailId: 1, pointId: 1 },
  { unique: true, partialFilterExpression: { pointId: { $type: 'string' } } }
);
liveTrailPointSchema.index({ trailId: 1, dedupeKey: 1 }, { unique: true });
liveTrailPointSchema.index({ trailId: 1, recordedAt: 1, seq: 1 });
liveTrailPointSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const liveTrailMatchSchema = new mongoose.Schema(
  {
    trailId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveTrail', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    revision: { type: Number, required: true, min: 1 },
    segmentId: { type: String, required: true },
    fromSeq: { type: Number, required: true, min: 1 },
    toSeq: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['provisional', 'final', 'unmatched'], required: true },
    geometry: {
      encoding: { type: String, enum: ['polyline6'] },
      data: { type: String },
    },
    matcher: {
      provider: { type: String, required: true },
      version: { type: String, required: true },
    },
    confidence: { type: Number, min: 0, max: 1 },
    sourceRevision: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

liveTrailMatchSchema.index({ trailId: 1, revision: 1, segmentId: 1 }, { unique: true });
liveTrailMatchSchema.index({ trailId: 1, revision: 1, fromSeq: 1 });
liveTrailMatchSchema.index({ sourceRevision: 1 });
liveTrailMatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LiveTrail = mongoose.model('LiveTrail', liveTrailSchema);
const LiveTrailPoint = mongoose.model('LiveTrailPoint', liveTrailPointSchema);
const LiveTrailMatch = mongoose.model('LiveTrailMatch', liveTrailMatchSchema);

module.exports = { LiveTrail, LiveTrailPoint, LiveTrailMatch };
