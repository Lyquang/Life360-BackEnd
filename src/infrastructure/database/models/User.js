const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    avatar: {
      type: String,
      default: '',
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    // ── Yêu cầu mới: lưu thời điểm online cuối + vị trí cuối ──
    // Dùng để hiển thị "online 30 phút trước" kể cả khi offline
    lastSeenAt: {
      type: Date,
      default: null,
    },
    // Vị trí cuối cùng biết được (GeoJSON Point)
    lastKnownLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: null,
      },
      // Thời điểm cập nhật vị trí cuối
      updatedAt: {
        type: Date,
        default: null,
      },
      // Số phút đang ở tại điểm này (từ duration tracker)
      durationMinutes: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// ─── Transform output (remove password, __v) ────────────────
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
