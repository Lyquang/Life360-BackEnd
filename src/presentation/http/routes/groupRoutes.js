const express = require('express');
const { validate } = require('../middleware/validate');
const {
  groupIdParams,
  createGroupBody,
  joinGroupBody,
  notificationIntervalBody,
  digestListQuery,
  addPlaceBody,
} = require('../../dto/group.schemas');

function createGroupRoutes({ controller, authenticate }) {
  const router = express.Router();
  router.use(authenticate);

  /**
   * @swagger
   * /api/v1/groups:
   *   post:
   *     summary: Create a circle (group) — its group chat is created in the same DB transaction
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name: { type: string, minLength: 2, maxLength: 50, example: Family }
   *     responses:
   *       201: { description: Group created (includes inviteCode and conversationId) }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *   get:
   *     summary: Circles of the current user (each with its conversationId)
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: List of groups }
   */
  router.post('/', validate({ body: createGroupBody }), controller.create);
  router.get('/', controller.listMine);

  /**
   * @swagger
   * /api/v1/groups/join:
   *   post:
   *     summary: Join a circle by 6-digit invite code (also joins its group chat, atomically)
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [inviteCode]
   *             properties:
   *               inviteCode: { type: string, pattern: '^\d{6}$', example: '123456' }
   *     responses:
   *       200: { description: Joined }
   *       400: { description: Validation error or already a member }
   *       404: { description: Invalid invite code }
   */
  router.post('/join', validate({ body: joinGroupBody }), controller.join);

  /**
   * @swagger
   * /api/v1/groups/{groupId}/members:
   *   get:
   *     summary: Members of a circle
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/GroupId'
   *     responses:
   *       200: { description: Members with online status and battery level }
   *       403: { description: Not a member }
   *       404: { description: Group not found }
   */
  router.get('/:groupId/members', validate({ params: groupIdParams }), controller.members);

  /**
   * @swagger
   * /api/v1/groups/{groupId}/notification-interval:
   *   patch:
   *     summary: Set the digest notification interval (0 = off, max 1440)
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/GroupId'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [intervalMinutes]
   *             properties:
   *               intervalMinutes: { type: integer, minimum: 0, maximum: 1440, example: 60 }
   *     responses:
   *       200: { description: Updated }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       403: { description: Not a member }
   */
  router.patch(
    '/:groupId/notification-interval',
    validate({ params: groupIdParams, body: notificationIntervalBody }),
    controller.updateNotificationInterval
  );

  /**
   * @swagger
   * /api/v1/groups/{groupId}/digests:
   *   get:
   *     summary: Digest history of a circle (paginated)
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/GroupId'
   *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
   *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
   *       - { in: query, name: from, schema: { type: string, format: date-time } }
   *       - { in: query, name: to, schema: { type: string, format: date-time } }
   *     responses:
   *       200: { description: "{ data, pagination, groupSettings }" }
   *       403: { description: Not a member }
   */
  router.get('/:groupId/digests', validate({ params: groupIdParams, query: digestListQuery }), controller.listDigests);

  /**
   * @swagger
   * /api/v1/groups/{groupId}/digests/latest:
   *   get:
   *     summary: Latest digest of a circle (data is null if none)
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/GroupId'
   *     responses:
   *       200: { description: Latest digest }
   *       403: { description: Not a member }
   */
  router.get('/:groupId/digests/latest', validate({ params: groupIdParams }), controller.latestDigest);

  /**
   * @swagger
   * /api/v1/groups/{groupId}/places:
   *   post:
   *     summary: Add a favorite place to a circle
   *     tags: [Places]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/GroupId'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, category, latitude, longitude]
   *             properties:
   *               name: { type: string, example: Pho 24 }
   *               category: { type: string, enum: [restaurant, entertainment, cafe, shopping, other] }
   *               latitude: { type: number, minimum: -90, maximum: 90, example: 10.7769 }
   *               longitude: { type: number, minimum: -180, maximum: 180, example: 106.7009 }
   *     responses:
   *       201: { description: Place added }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       403: { description: Not a member }
   *   get:
   *     summary: Favorite places of a circle
   *     tags: [Places]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/GroupId'
   *     responses:
   *       200: { description: Places }
   *       403: { description: Not a member }
   */
  router.post('/:groupId/places', validate({ params: groupIdParams, body: addPlaceBody }), controller.addPlace);
  router.get('/:groupId/places', validate({ params: groupIdParams }), controller.listPlaces);

  return router;
}

module.exports = { createGroupRoutes };
