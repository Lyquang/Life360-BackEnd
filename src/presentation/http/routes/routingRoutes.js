const express = require('express');
const { validate } = require('../middleware/validate');
const { routePreviewBody } = require('../../dto/routing.schemas');

function createRoutingRoutes({ controller, authenticate, limiter }) {
  const router = express.Router();
  router.use(authenticate);

  /**
   * @swagger
   * /api/v1/routes/preview:
   *   post:
   *     summary: Preview TomTom v1 route alternatives for one travel mode
   *     tags: [Routing]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [origin, destination, travelMode]
   *             properties:
   *               origin: { $ref: '#/components/schemas/RoutePoint' }
   *               destination: { $ref: '#/components/schemas/RoutePoint' }
   *               travelMode: { type: string, enum: [motorcycle, car, walking] }
   *     responses:
   *       200:
   *         description: Actual alternatives, or an empty routes array with reason no_route
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/RoutePreviewResponse' }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       401: { description: Missing or invalid JWT }
   *       429: { description: Per-user preview limit or provider quota }
   *       503: { description: Provider missing or unavailable }
   */
  router.post('/preview', limiter, validate({ body: routePreviewBody }), controller.preview);
  return router;
}

module.exports = { createRoutingRoutes };
