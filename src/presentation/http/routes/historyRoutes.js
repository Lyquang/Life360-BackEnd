const express = require('express');
const { validate } = require('../middleware/validate');
const { userIdParams, historyQuery, journeyQuery, liveTrailQuery } = require('../../dto/history.schemas');

function createHistoryRoutes({ controller, authenticate, trailLimiter }) {
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

  /**
   * @swagger
   * /api/v1/history/{userId}/journey/trail:
   *   get:
   *     summary: Paginated raw live-trail snapshot or catch-up events
   *     tags: [History]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/UserId'
   *       - { in: query, name: date, schema: { type: string, example: '2026-10-18' } }
   *       - { in: query, name: afterSeq, schema: { type: integer, minimum: 0 }, description: Insertion cursor; requires revision }
   *       - { in: query, name: revision, schema: { type: integer, minimum: 1 } }
   *       - { in: query, name: limit, schema: { type: integer, default: 200, maximum: 500 } }
   *     responses:
   *       200: { description: Raw points ordered by seq plus stable fromSeq/toSeq gaps }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       401: { description: Missing or invalid access token }
   *       403: { description: Not yourself and no shared circle }
   *       404: { description: No trail exists for the requested date }
   *       409: { description: TRAIL_REVISION_CHANGED; reload from the first page }
   *       429: { description: Per-requester read limit exceeded; honor Retry-After }
   *       503: { description: Live trail feature flag is disabled }
   */
  router.get(
    '/:userId/journey/trail',
    trailLimiter,
    validate({ params: userIdParams, query: liveTrailQuery }),
    controller.liveTrail
  );

  return router;
}

module.exports = { createHistoryRoutes };
