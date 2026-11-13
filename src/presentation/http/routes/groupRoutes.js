const express = require('express');
const { validate } = require('../middleware/validate');
const {
  groupIdParams,
  groupMemberParams,
  createGroupBody,
  joinGroupBody,
  notificationIntervalBody,
  digestListQuery,
  addPlaceBody,
  placeIdParams,
  placeLabelParams,
  updatePlaceBody,
  deletePlaceQuery,
  setPlaceLabelBody,
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
   * /api/v1/groups/{groupId}/members/me:
   *   delete:
   *     summary: Leave a Circle; admins must transfer ownership or delete it first
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ $ref: '#/components/parameters/GroupId' }]
   *     responses:
   *       200: { description: Circle and group-chat membership removed atomically }
   *       403: { description: Not a member }
   *       404: { description: Circle not found }
   *       409: { description: Admin cannot leave before ownership transfer or deletion }
   */
  router.delete('/:groupId/members/me', validate({ params: groupIdParams }), controller.leave);

  /**
   * @swagger
   * /api/v1/groups/{groupId}/members/{userId}:
   *   delete:
   *     summary: Remove a Circle member (admin only)
   *     tags: [Groups]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/GroupId'
   *       - $ref: '#/components/parameters/UserId'
   *     responses:
   *       200: { description: Member and group-chat membership removed atomically }
   *       403: { description: Only the Circle admin can remove members }
   *       404: { description: Circle or member not found }
   *       409: { description: Circle admin cannot be removed }
   */
  router.delete(
    '/:groupId/members/:userId',
    validate({ params: groupMemberParams }),
    controller.removeMember
  );

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

  /**
   * @swagger
   * components:
   *   schemas:
   *     SavedPlace:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *           pattern: ^[0-9a-fA-F]{24}$
   *         groupId:
   *           type: string
   *           pattern: ^[0-9a-fA-F]{24}$
   *         name:
   *           type: string
   *         category:
   *           type: string
   *           enum:
   *           - restaurant
   *           - entertainment
   *           - cafe
   *           - shopping
   *           - other
   *         latitude:
   *           type: number
   *         longitude:
   *           type: number
   *         revision:
   *           type: integer
   *           minimum: 0
   *           maximum: 9007199254740990
   *         addedBy:
   *           type: object
   *           nullable: true
   *           properties:
   *             id:
   *               type: string
   *               pattern: ^[0-9a-fA-F]{24}$
   *             name:
   *               type: string
   *             email:
   *               type: string
   *             avatar:
   *               type: string
   *               nullable: true
   *         location:
   *           type: object
   *           properties:
   *             type:
   *               type: string
   *               enum:
   *               - Point
   *             coordinates:
   *               type: array
   *               items:
   *                 type: number
   *               minItems: 2
   *               maxItems: 2
   *         createdAt:
   *           type: string
   *           format: date-time
   *         updatedAt:
   *           type: string
   *           format: date-time
   *     PersonalPlaceLabel:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *           pattern: ^[0-9a-fA-F]{24}$
   *         groupId:
   *           type: string
   *           pattern: ^[0-9a-fA-F]{24}$
   *         userId:
   *           type: string
   *           pattern: ^[0-9a-fA-F]{24}$
   *         label:
   *           type: string
   *           enum:
   *           - home
   *           - work
   *           - leisure
   *           - custom
   *         customLabel:
   *           type: string
   *           nullable: true
   *         placeId:
   *           $ref: '#/components/schemas/SavedPlace'
   *         createdAt:
   *           type: string
   *           format: date-time
   *         updatedAt:
   *           type: string
   *           format: date-time
   * /api/v1/groups/{groupId}/places/{placeId}:
   *   get:
   *     summary: Get one Circle place
   *     tags:
   *     - Places
   *     security:
   *     - bearerAuth: []
   *     parameters:
   *     - $ref: '#/components/parameters/GroupId'
   *     - in: path
   *       name: placeId
   *       required: true
   *       schema:
   *         type: string
   *         pattern: ^[0-9a-fA-F]{24}$
   *     responses:
   *       '200':
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/SavedPlace'
   *       '400':
   *         description: Invalid request or label text
   *       '401':
   *         description: Authentication required
   *       '403':
   *         description: Not a member or not an allowed editor
   *       '404':
   *         description: Group or group-scoped place not found
   *   patch:
   *     summary: Edit own/admin place with expected revision
   *     tags:
   *     - Places
   *     security:
   *     - bearerAuth: []
   *     parameters:
   *     - $ref: '#/components/parameters/GroupId'
   *     - in: path
   *       name: placeId
   *       required: true
   *       schema:
   *         type: string
   *         pattern: ^[0-9a-fA-F]{24}$
   *     responses:
   *       '200':
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/SavedPlace'
   *       '400':
   *         description: Invalid request or label text
   *       '401':
   *         description: Authentication required
   *       '403':
   *         description: Not a member or not an allowed editor
   *       '404':
   *         description: Group or group-scoped place not found
   *       '409':
   *         description: Stale place revision (PATCH/DELETE place)
   *       '503':
   *         description: Transactions required for this mutation
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties: false
   *             required:
   *             - revision
   *             properties:
   *               revision:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 9007199254740990
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 100
   *               category:
   *                 type: string
   *                 enum:
   *                 - restaurant
   *                 - entertainment
   *                 - cafe
   *                 - shopping
   *                 - other
   *               latitude:
   *                 type: number
   *                 minimum: -90
   *                 maximum: 90
   *               longitude:
   *                 type: number
   *                 minimum: -180
   *                 maximum: 180
   *             description: Supply at least one changed field. Latitude/longitude must be supplied together.
   *   delete:
   *     summary: Delete own/admin place and all its labels atomically
   *     tags:
   *     - Places
   *     security:
   *     - bearerAuth: []
   *     parameters:
   *     - $ref: '#/components/parameters/GroupId'
   *     - in: path
   *       name: placeId
   *       required: true
   *       schema:
   *         type: string
   *         pattern: ^[0-9a-fA-F]{24}$
   *     - in: query
   *       name: revision
   *       required: true
   *       schema:
   *         type: integer
   *         minimum: 0
   *         maximum: 9007199254740990
   *     responses:
   *       '200':
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       pattern: ^[0-9a-fA-F]{24}$
   *                     deleted:
   *                       type: boolean
   *       '400':
   *         description: Invalid request or label text
   *       '401':
   *         description: Authentication required
   *       '403':
   *         description: Not a member or not an allowed editor
   *       '404':
   *         description: Group or group-scoped place not found
   *       '409':
   *         description: Stale place revision (PATCH/DELETE place)
   *       '503':
   *         description: Transactions required for this mutation
   * /api/v1/groups/{groupId}/me/place-labels:
   *   get:
   *     summary: List only the authenticated member personal labels
   *     tags:
   *     - Places
   *     security:
   *     - bearerAuth: []
   *     parameters:
   *     - $ref: '#/components/parameters/GroupId'
   *     responses:
   *       '200':
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PersonalPlaceLabel'
   *                 count:
   *                   type: integer
   *       '400':
   *         description: Invalid request or label text
   *       '401':
   *         description: Authentication required
   *       '403':
   *         description: Not a member or not an allowed editor
   *       '404':
   *         description: Group or group-scoped place not found
   * /api/v1/groups/{groupId}/me/place-labels/{label}:
   *   put:
   *     summary: Assign/replace own shortcut, last-write-wins and retry-safe
   *     tags:
   *     - Places
   *     security:
   *     - bearerAuth: []
   *     parameters:
   *     - $ref: '#/components/parameters/GroupId'
   *     - in: path
   *       name: label
   *       required: true
   *       schema:
   *         type: string
   *         enum:
   *         - home
   *         - work
   *         - leisure
   *         - custom
   *     responses:
   *       '200':
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/PersonalPlaceLabel'
   *       '400':
   *         description: Invalid request or label text
   *       '401':
   *         description: Authentication required
   *       '403':
   *         description: Not a member or not an allowed editor
   *       '404':
   *         description: Group or group-scoped place not found
   *       '503':
   *         description: Transactions required for this mutation
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *             - placeId
   *             additionalProperties: false
   *             properties:
   *               placeId:
   *                 type: string
   *                 pattern: ^[0-9a-fA-F]{24}$
   *               customLabel:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 50
   *                 description: Required only for label=custom; forbidden for other labels.
   *   delete:
   *     summary: Remove own shortcut idempotently
   *     tags:
   *     - Places
   *     security:
   *     - bearerAuth: []
   *     parameters:
   *     - $ref: '#/components/parameters/GroupId'
   *     - in: path
   *       name: label
   *       required: true
   *       schema:
   *         type: string
   *         enum:
   *         - home
   *         - work
   *         - leisure
   *         - custom
   *     responses:
   *       '200':
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     label:
   *                       type: string
   *                       enum:
   *                       - home
   *                       - work
   *                       - leisure
   *                       - custom
   *                     removed:
   *                       type: boolean
   *       '400':
   *         description: Invalid request or label text
   *       '401':
   *         description: Authentication required
   *       '403':
   *         description: Not a member or not an allowed editor
   *       '404':
   *         description: Group or group-scoped place not found
   *       '503':
   *         description: Transactions required for this mutation
   */

  router.get('/:groupId/places/:placeId', validate({ params: placeIdParams }), controller.getPlace);
  router.patch('/:groupId/places/:placeId', validate({ params: placeIdParams, body: updatePlaceBody }), controller.updatePlace);
  router.delete('/:groupId/places/:placeId', validate({ params: placeIdParams, query: deletePlaceQuery }), controller.deletePlace);
  router.get('/:groupId/me/place-labels', validate({ params: groupIdParams }), controller.listMyPlaceLabels);
  router.put('/:groupId/me/place-labels/:label', validate({ params: placeLabelParams, body: setPlaceLabelBody }), controller.setMyPlaceLabel);
  router.delete('/:groupId/me/place-labels/:label', validate({ params: placeLabelParams }), controller.deleteMyPlaceLabel);

  return router;
}

module.exports = { createGroupRoutes };
