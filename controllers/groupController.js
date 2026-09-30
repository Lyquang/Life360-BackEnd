const Group = require('../models/Group');
const User = require('../models/User');

/**
 * @desc    Create a new group
 * @route   POST /api/groups
 * @access  Private
 */
exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a group name.',
      });
    }

    const group = await Group.create({
      name,
      admin: req.user._id,
      members: [req.user._id], // Admin is also a member
    });

    // Populate admin info
    await group.populate('admin', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Group created successfully.',
      data: group,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: messages,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

/**
 * @desc    Join a group via inviteCode
 * @route   POST /api/groups/join
 * @access  Private
 */
exports.joinGroup = async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an invite code.',
      });
    }

    const group = await Group.findOne({ inviteCode });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invite code. Group not found.',
      });
    }

    // Check if already a member
    if (group.members.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group.',
      });
    }

    // Add user to group
    group.members.push(req.user._id);
    await group.save();

    await group.populate('members', 'name email avatar isOnline batteryLevel');

    res.json({
      success: true,
      message: 'Successfully joined the group.',
      data: group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

/**
 * @desc    Get members of a specific group
 * @route   GET /api/groups/:groupId/members
 * @access  Private
 */
exports.getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate(
      'members',
      'name email avatar isOnline batteryLevel'
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.',
      });
    }

    // Check if the requesting user is a member
    const isMember = group.members.some(
      (member) => member._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group.',
      });
    }

    res.json({
      success: true,
      data: {
        groupId: group._id,
        groupName: group.name,
        inviteCode: group.inviteCode,
        memberCount: group.members.length,
        members: group.members,
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all groups for the current user
 * @route   GET /api/groups
 * @access  Private
 */
exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({
      members: req.user._id,
    })
      .populate('admin', 'name email avatar')
      .populate('members', 'name email avatar isOnline batteryLevel');

    res.json({
      success: true,
      count: groups.length,
      data: groups,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

/**
 * @desc    Update the notification digest interval for a group
 * @route   PATCH /api/groups/:groupId/notification-interval
 * @access  Private (any group member)
 */
exports.updateNotificationInterval = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { intervalMinutes } = req.body;
    const userId = req.user._id;

    // Validate input
    if (intervalMinutes === undefined || intervalMinutes === null) {
      return res.status(400).json({
        success: false,
        message: 'intervalMinutes is required.',
      });
    }

    const interval = Number(intervalMinutes);
    if (isNaN(interval) || interval < 0 || interval > 1440) {
      return res.status(400).json({
        success: false,
        message: 'intervalMinutes must be a number between 0 and 1440.',
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Only members can update
    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group.' });
    }

    group.notificationIntervalMinutes = interval;
    await group.save();

    res.json({
      success: true,
      message: interval === 0
        ? 'Đã tắt thông báo định kỳ cho nhóm này.'
        : `Đã cài đặt gửi thông báo mỗi ${interval} phút.`,
      data: {
        groupId: group._id,
        notificationIntervalMinutes: group.notificationIntervalMinutes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};
