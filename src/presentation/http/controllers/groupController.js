const { asyncHandler } = require('../middleware/asyncHandler');

const withConversation = ({ group, conversationId }) => ({ ...group.toJSON(), conversationId });

function createGroupController({ groups, digests, places }) {
  return {
    create: asyncHandler(async (req, res) => {
      const result = await groups.createGroup({ userId: req.user._id, name: req.dto.body.name });
      res.status(201).json({ success: true, message: 'Group created successfully.', data: withConversation(result) });
    }),

    listMine: asyncHandler(async (req, res) => {
      const data = (await groups.listMyGroups(req.user._id)).map(withConversation);
      res.json({ success: true, count: data.length, data });
    }),

    join: asyncHandler(async (req, res) => {
      const result = await groups.joinGroup({ userId: req.user._id, inviteCode: req.dto.body.inviteCode });
      res.json({ success: true, message: 'Successfully joined the group.', data: withConversation(result) });
    }),

    members: asyncHandler(async (req, res) => {
      const data = await groups.getGroupMembers({ userId: req.user._id, groupId: req.dto.params.groupId });
      res.json({ success: true, data });
    }),

    updateNotificationInterval: asyncHandler(async (req, res) => {
      const { intervalMinutes } = req.dto.body;
      const data = await groups.updateNotificationInterval({
        userId: req.user._id,
        groupId: req.dto.params.groupId,
        intervalMinutes,
      });
      res.json({
        success: true,
        message:
          intervalMinutes === 0
            ? 'Đã tắt thông báo định kỳ cho nhóm này.'
            : `Đã cài đặt gửi thông báo mỗi ${intervalMinutes} phút.`,
        data,
      });
    }),

    listDigests: asyncHandler(async (req, res) => {
      const { items, pagination, groupSettings } = await digests.listDigests({
        userId: req.user._id,
        groupId: req.dto.params.groupId,
        ...req.dto.query,
      });
      res.json({ success: true, data: items, pagination, groupSettings });
    }),

    latestDigest: asyncHandler(async (req, res) => {
      const { digest, groupSettings } = await digests.getLatestDigest({
        userId: req.user._id,
        groupId: req.dto.params.groupId,
      });
      res.json({
        success: true,
        data: digest,
        ...(!digest && { message: 'Chưa có digest nào được gửi cho nhóm này.' }),
        groupSettings,
      });
    }),

    addPlace: asyncHandler(async (req, res) => {
      const data = await places.addPlace({ userId: req.user._id, groupId: req.dto.params.groupId, ...req.dto.body });
      res.status(201).json({ success: true, message: 'Favorite place added successfully.', data });
    }),

    listPlaces: asyncHandler(async (req, res) => {
      const data = await places.listPlaces({ userId: req.user._id, groupId: req.dto.params.groupId });
      res.json({ success: true, count: data.length, data });
    }),
  };
}

module.exports = { createGroupController };
