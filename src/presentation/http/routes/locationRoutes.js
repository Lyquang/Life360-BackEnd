const express = require('express');
const { createParseLocationBatch } = require('../../dto/locationBatch.schemas');

function createLocationRoutes({ controller, authenticate, batchLimiter, maxPoints }) {
  const router = express.Router();
  router.use(authenticate);

  /**
   * @swagger
   * /api/v1/locations/batch:
   *   post:
   *     summary: Persist offline-buffered location points without emitting realtime events
   *     tags: [Locations]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [points]
   *             properties:
   *               points:
   *                 type: array
   *                 minItems: 1
   *                 maxItems: 100
   *                 items:
   *                   type: object
   *                   required: [pointId, latitude, longitude, recordedAt]
   *                   properties:
   *                     pointId: { type: string, format: uuid }
   *                     latitude: { type: number, minimum: -90, maximum: 90 }
   *                     longitude: { type: number, minimum: -180, maximum: 180 }
   *                     recordedAt: { type: string, format: date-time }
   *                     accuracy: { type: number, minimum: 0 }
   *                     batteryLevel: { type: number }
   *     responses:
   *       200:
   *         description: Partial-success result; delete accepted and duplicate point IDs from the mobile buffer
   *       400: { description: Invalid envelope or batch exceeds the configured point limit }
   *       401: { description: Missing or invalid access token }
   *       413: { description: Request body exceeds 100 KB }
   *       429: { description: Per-user batch rate limit exceeded; honor Retry-After }
   */
  router.post('/batch', batchLimiter, createParseLocationBatch(maxPoints), controller.syncBatch);

  return router;
}

module.exports = { createLocationRoutes };
