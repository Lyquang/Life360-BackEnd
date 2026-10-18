const express = require('express');
const { validate } = require('../middleware/validate');
const { userIdParams, historyQuery, journeyQuery } = require('../../dto/history.schemas');

function createHistoryRoutes({ controller, authenticate }) {
  const router = express.Router();
  router.use(authenticate);

  /**
   * @swagger
   * /api/v1/history/{userId}:
   *   get:
   *     summary: Today's location points of yourself or a member of one of your circles
   *     tags: [History]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/UserId'
   *       - { in: query, name: from, schema: { type: string, format: date-time }, description: Range start; enables cursor mode }
   *       - { in: query, name: to, schema: { type: string, format: date-time }, description: Range end; enables cursor mode }
   *       - { in: query, name: limit, schema: { type: integer, default: 500, maximum: 1000 } }
   *       - { in: query, name: cursor, schema: { type: string }, description: Opaque nextCursor from the previous page }
   *     responses:
   *       200: { description: "{ count, date, data: [{ id, latitude, longitude, timestamp }] }" }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       403: { description: Not yourself and no shared circle }
   */
  router.get('/:userId', validate({ params: userIdParams, query: historyQuery }), controller.today);

  /**
   * @swagger
   * /api/v1/history/{userId}/journey:
   *   get:
   *     summary: Full-day journey (stay points + moving segments), 00:00–23:59 server time
   *     tags: [History]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/UserId'
   *       - in: query
   *         name: date
   *         schema: { type: string, example: '2026-09-16' }
   *         description: YYYY-MM-DD, defaults to today
   *       - in: query
   *         name: detail
   *         schema: { type: string, enum: [geometry] }
   *         description: Opt in to timestamped points, gaps, distance and thinning metadata
   *       - in: query
   *         name: includePath
   *         schema: { type: boolean, default: true }
   *         description: With detail=geometry, set false to omit duplicate path coordinates and use points only
   *     responses:
   *       200: { description: "{ date, userId, summary, journey }" }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       403: { description: Not yourself and no shared circle }
   */
  router.get('/:userId/journey', validate({ params: userIdParams, query: journeyQuery }), controller.journey);

  return router;
}

module.exports = { createHistoryRoutes };
