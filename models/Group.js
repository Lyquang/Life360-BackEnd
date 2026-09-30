const mongoose = require('mongoose');

/**
 * Generate a random 6-digit invite code.
 * Ensures uniqueness by checking the database.
 */
async function generateUniqueInviteCode() {
  let code;
  let exists = true;
  while (exists) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    exists = await mongoose.model('Group').findOne({ inviteCode: code });
  }
  return code;
}

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [2, 'Group name must be at least 2 characters'],
      maxlength: [50, 'Group name must be at most 50 characters'],
    },
    inviteCode: {
      type: String,
      unique: true,
      length: 6,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Group admin is required'],
    },
    // ── Yêu cầu mới: tần suất gửi thông báo digest (phút) ────
    // 0 = tắt thông báo
    // Mặc định: 60 phút → gửi 1 tiếng/lần
    notificationIntervalMinutes: {
      type: Number,
      default: 60,
      min: [0, 'Interval must be >= 0'],
      max: [1440, 'Interval must be <= 1440 (24 hours)'],
    },
    // Thời điểm gửi digest lần cuối (để tính khi nào gửi tiếp)
    lastDigestSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


// ─── Auto-generate inviteCode before saving ─────────────────
groupSchema.pre('save', async function (next) {
  if (!this.inviteCode) {
    this.inviteCode = await generateUniqueInviteCode();
  }
  next();
});

// ─── Transform output ───────────────────────────────────────
groupSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Group', groupSchema);
