const mongoose = require('mongoose');

// ─── Schema for a single member's status snapshot ───────────
const memberStatusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true },
    isOnline: { type: Boolean, default: false },
    lastSeenText: { type: String, default: 'Chưa có dữ liệu' },
    batteryLevel: { type: Number, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    locationUpdatedAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },
    durationFormatted: { type: String, default: null },
    // Câu tóm tắt: "Quang ở đây 30 phút và 30 phút trước"
    summary: { type: String, default: null },
  },
  { _id: false } // Không cần _id cho subdoc
);

// ─── Main GroupDigest schema ─────────────────────────────────
const groupDigestSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    groupName: {
      type: String,
      required: true,
    },
    // Interval cài đặt lúc gửi (phút) — để trace lịch sử thay đổi config
    intervalMinutes: {
      type: Number,
      required: true,
    },
    // Danh sách trạng thái của từng thành viên tại thời điểm gửi
    members: [memberStatusSchema],
    // Thời điểm digest được tạo (indexed để query theo thời gian)
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // dùng sentAt thay vì createdAt
  }
);

// ─── Compound index: query digest của 1 group theo thời gian ─
groupDigestSchema.index({ groupId: 1, sentAt: -1 });

// ─── Transform output ────────────────────────────────────────
groupDigestSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('GroupDigest', groupDigestSchema);
