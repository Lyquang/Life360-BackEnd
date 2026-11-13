const { asyncHandler } = require('../middleware/asyncHandler');

const withConversation = ({ group, conversationId }) => ({ ...group.toJSON(), conversationId });

function createGroupController({ groups, digests, places, placePresence }) {
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

    leave: asyncHandler(async (req, res) => {
      const data = await groups.leaveGroup({ userId: req.user._id, groupId: req.dto.params.groupId });
      res.json({ success: true, message: 'You left the Circle.', data });
    }),

    removeMember: asyncHandler(async (req, res) => {
      const data = await groups.removeMember({
        userId: req.user._id,
        groupId: req.dto.params.groupId,
        memberUserId: req.dto.params.userId,
      });
      res.json({ success: true, message: 'Member removed from the Circle.', data });
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

    getPlace: asyncHandler(async (req, res) => {
      const data = await places.getPlace({ userId: req.user._id, ...req.dto.params });
      res.json({ success: true, data });
    }),
    placePresence: asyncHandler(async (req, res) => {
      const { data, pagination } = await placePresence.snapshot({ userId: req.user._id,
        ...req.dto.params, ...req.dto.query });
      res.json({ success: true, count: data.length, data, pagination });
    }),
    updatePlace: asyncHandler(async (req, res) => {
      const data = await places.updatePlace({ userId: req.user._id, ...req.dto.params, ...req.dto.body });
      res.json({ success: true, data });
    }),
    deletePlace: asyncHandler(async (req, res) => {
      const data = await places.deletePlace({ userId: req.user._id, ...req.dto.params, ...req.dto.query });
      res.json({ success: true, data });
    }),
    listMyPlaceLabels: asyncHandler(async (req, res) => {
      const data = await places.listMyLabels({ userId: req.user._id, ...req.dto.params });
      res.json({ success: true, count: data.length, data });
    }),
    setMyPlaceLabel: asyncHandler(async (req, res) => {
      const data = await places.setMyLabel({ userId: req.user._id, ...req.dto.params, ...req.dto.body });
      res.json({ success: true, data });
    }),
    deleteMyPlaceLabel: asyncHandler(async (req, res) => {
      const data = await places.deleteMyLabel({ userId: req.user._id, ...req.dto.params });
      res.json({ success: true, data });
    }),
  };
}

module.exports = { createGroupController };
