const GroupDigest = require('../models/GroupDigest');
const Group = require('../models/Group');

/**
 * @desc    Lấy lịch sử digest của một nhóm (có phân trang)
 * @route   GET /api/groups/:groupId/digests
 * @access  Private (chỉ thành viên nhóm)
 *
 * Query params:
 *   page    {number}  Trang hiện tại (default: 1)
 *   limit   {number}  Số bản ghi mỗi trang (default: 20, max: 100)
 *   from    {string}  ISO date — lọc từ thời điểm này trở đi
 *   to      {string}  ISO date — lọc đến thời điểm này
 */
exports.getGroupDigests = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Kiểm tra group tồn tại và user là thành viên
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Nhóm không tồn tại.' });
    }

    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải thành viên của nhóm này.',
      });
    }

    // ─── Parse pagination params ─────────────────────────────
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // ─── Build filter query ──────────────────────────────────
    const filter = { groupId };

    if (req.query.from || req.query.to) {
      filter.sentAt = {};
      if (req.query.from) {
        const from = new Date(req.query.from);
        if (isNaN(from)) {
          return res.status(400).json({ success: false, message: 'Tham số "from" không hợp lệ.' });
        }
        filter.sentAt.$gte = from;
      }
      if (req.query.to) {
        const to = new Date(req.query.to);
        if (isNaN(to)) {
          return res.status(400).json({ success: false, message: 'Tham số "to" không hợp lệ.' });
        }
        filter.sentAt.$lte = to;
      }
    }

    // ─── Query DB ────────────────────────────────────────────
    const [digests, total] = await Promise.all([
      GroupDigest.find(filter)
        .sort({ sentAt: -1 })   // Mới nhất trước
        .skip(skip)
        .limit(limit)
        .lean(),                 // lean() nhanh hơn, trả về plain object
      GroupDigest.countDocuments(filter),
    ]);

    // Tính thông tin phân trang
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: digests,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
      // Thông tin cài đặt nhóm hiện tại
      groupSettings: {
        notificationIntervalMinutes: group.notificationIntervalMinutes,
        lastDigestSentAt: group.lastDigestSentAt,
      },
    });
  } catch (error) {
    console.error('❌ getGroupDigests error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Lỗi server.',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy digest mới nhất của một nhóm (không phân trang)
 * @route   GET /api/groups/:groupId/digests/latest
 * @access  Private (chỉ thành viên nhóm)
 */
exports.getLatestDigest = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Nhóm không tồn tại.' });
    }

    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải thành viên của nhóm này.',
      });
    }

    const latest = await GroupDigest.findOne({ groupId })
      .sort({ sentAt: -1 })
      .lean();

    if (!latest) {
      return res.json({
        success: true,
        data: null,
        message: 'Chưa có digest nào được gửi cho nhóm này.',
        groupSettings: {
          notificationIntervalMinutes: group.notificationIntervalMinutes,
          lastDigestSentAt: group.lastDigestSentAt,
        },
      });
    }

    res.json({
      success: true,
      data: latest,
      groupSettings: {
        notificationIntervalMinutes: group.notificationIntervalMinutes,
        lastDigestSentAt: group.lastDigestSentAt,
      },
    });
  } catch (error) {
    console.error('❌ getLatestDigest error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server.', error: error.message });
  }
};
