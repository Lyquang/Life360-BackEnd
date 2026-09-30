const express = require('express');
const router = express.Router();
const {
  createGroup,
  joinGroup,
  getGroupMembers,
  getMyGroups,
  updateNotificationInterval,
} = require('../controllers/groupController');
const { getGroupDigests, getLatestDigest } = require('../controllers/digestController');
const { authenticate } = require('../middleware/auth');

// All group routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Create a new group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Family Group
 *     responses:
 *       201:
 *         description: Group created successfully with auto-generated 6-digit invite code
 *       400:
 *         description: Validation error
 */
router.post('/', createGroup);

/**
 * @swagger
 * /api/groups:
 *   get:
 *     summary: Get all groups the current user belongs to
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's groups
 */
router.get('/', getMyGroups);

/**
 * @swagger
 * /api/groups/join:
 *   post:
 *     summary: Join a group via 6-digit invite code
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inviteCode]
 *             properties:
 *               inviteCode:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Successfully joined the group
 *       400:
 *         description: Already a member
 *       404:
 *         description: Invalid invite code
 */
router.post('/join', joinGroup);

/**
 * @swagger
 * /api/groups/{groupId}/members:
 *   get:
 *     summary: Get list of members in a specific group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ObjectId
 *     responses:
 *       200:
 *         description: List of group members with online status and battery level
 *       403:
 *         description: Not a member of this group
 *       404:
 *         description: Group not found
 */
router.get('/:groupId/members', getGroupMembers);

/**
 * @swagger
 * /api/groups/{groupId}/notification-interval:
 *   patch:
 *     summary: Update notification digest interval for a group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [intervalMinutes]
 *             properties:
 *               intervalMinutes:
 *                 type: number
 *                 example: 60
 *                 description: "0 = disabled, max 1440 (24h)"
 *     responses:
 *       200:
 *         description: Interval updated
 *       400:
 *         description: Invalid interval value
 *       403:
 *         description: Not a member of this group
 */
router.patch('/:groupId/notification-interval', updateNotificationInterval);

/**
 * @swagger
 * /api/groups/{groupId}/digests:
 *   get:
 *     summary: Lấy lịch sử digest của nhóm (có phân trang)
 *     description: |
 *       Trả về danh sách tất cả các digest đã được gửi cho nhóm.
 *       Mỗi digest chứa trạng thái của từng thành viên tại thời điểm đó.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *         description: Group ObjectId
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *         description: Số bản ghi mỗi trang (tối đa 100)
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: "Lọc từ thời điểm này (ISO 8601). VD: 2026-09-17T00:00:00Z"
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: "Lọc đến thời điểm này (ISO 8601)"
 *     responses:
 *       200:
 *         description: Danh sách digest có phân trang
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       groupId: { type: string }
 *                       groupName: { type: string }
 *                       intervalMinutes: { type: number }
 *                       sentAt: { type: string, format: date-time }
 *                       members:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name: { type: string }
 *                             isOnline: { type: boolean }
 *                             lastSeenText: { type: string, example: "30 phút trước" }
 *                             durationFormatted: { type: string, example: "30 phút" }
 *                             summary: { type: string, example: "Quang ở đây 30 phút và 30 phút trước" }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage: { type: integer }
 *                     totalPages: { type: integer }
 *                     totalItems: { type: integer }
 *                     itemsPerPage: { type: integer }
 *                     hasNextPage: { type: boolean }
 *                     hasPrevPage: { type: boolean }
 *                 groupSettings:
 *                   type: object
 *                   properties:
 *                     notificationIntervalMinutes: { type: number }
 *                     lastDigestSentAt: { type: string, format: date-time }
 *       403:
 *         description: Không phải thành viên nhóm
 *       404:
 *         description: Nhóm không tồn tại
 */
router.get('/:groupId/digests', getGroupDigests);

/**
 * @swagger
 * /api/groups/{groupId}/digests/latest:
 *   get:
 *     summary: Lấy digest mới nhất của nhóm
 *     description: Trả về digest gần nhất được gửi, không cần phân trang.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Digest mới nhất hoặc null nếu chưa có
 *       403:
 *         description: Không phải thành viên nhóm
 *       404:
 *         description: Nhóm không tồn tại
 */
router.get('/:groupId/digests/latest', getLatestDigest);

module.exports = router;
