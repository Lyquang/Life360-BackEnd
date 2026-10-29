const express = require('express');
const { validate } = require('../middleware/validate');
const { createSosBody, sosParams, sosQuery, respondSosBody, closeSosBody, listSosQuery } = require('../../dto/sos.schemas');

function createSosRoutes({ controller, authenticate, limiter }) {
  const router = express.Router();
  router.use(authenticate, limiter);
  /**
   * @swagger
   * /api/v1/sos:
   *   get:
   *     summary: Recover visible SOS incidents after reconnect, newest ID first
   *     tags: [SOS]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: status, schema: { type: string, enum: [active, resolved, cancelled, expired, all], default: active } }
   *       - { in: query, name: cursor, schema: { type: string }, description: Previous nextCursor; distinct from responder afterId }
   *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
   *     responses:
   *       200: { description: data contains items, hasMore and nextCursor; current visibility applied before pagination }
   *       400: { description: Invalid status or cursor }
   *       401: { description: Unauthorized }
   *       429: { description: Rate limited; Retry-After in seconds }
   *       503: { description: SOS unavailable }
   *   post:
   *     summary: Persist an SOS and enqueue alerts to the owner's Circles
   *     tags: [SOS]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties: false
   *             required: [clientRequestId]
   *             properties:
   *               clientRequestId: { type: string, format: uuid, description: Reuse the same UUID when retrying the same SOS }
   *               message: { type: string, maxLength: 500 }
   *               latitude: { type: number, minimum: -90, maximum: 90 }
   *               longitude: { type: number, minimum: -180, maximum: 180 }
   *               recordedAt: { type: string, format: date-time, description: Requires both coordinates }
   *     responses:
   *       201: { description: Persisted incident and chat; not a recipient delivery receipt }
   *       200: { description: Idempotent replay of the same request ID }
   *       400: { description: Invalid payload or no Circle }
   *       401: { description: Missing or invalid access token }
   *       409: { description: Another request ID already has an active SOS }
   *       429: { description: Per-account request limit; Retry-After in seconds }
   *       503: { description: Feature disabled, transactions unavailable or audience capacity exceeded }
   * /api/v1/sos/{id}:
   *   parameters:
   *     - { in: path, name: id, required: true, schema: { type: string, pattern: '^[a-fA-F0-9]{24}$' } }
   *   get:
   *     summary: Read an authorized SOS snapshot and paginated responders
   *     tags: [SOS]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: afterId, schema: { type: string }, description: Previous nextAfterId response cursor }
   *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
   *     responses:
   *       200: { description: data contains incident, responders, hasMore and nextAfterId; responders filtered by viewer before pagination }
   *       400: { description: Invalid ID or query }
   *       401: { description: Unauthorized }
   *       403: { description: Not in the original and current audience }
   *       404: { description: Incident not found }
   *       429: { description: Rate limited }
   *       503: { description: SOS unavailable }
   *   patch:
   *     summary: Owner resolves or cancels SOS
   *     tags: [SOS]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status: { type: string, enum: [resolved, cancelled] }
   *     responses:
   *       200: { description: data.changed false for repeated same closure }
   *       400: { description: Invalid payload }
   *       401: { description: Unauthorized }
   *       403: { description: Only owner may close }
   *       404: { description: Incident not found }
   *       409: { description: Already closed with another status }
   *       429: { description: Rate limited }
   *       503: { description: SOS unavailable }
   * /api/v1/sos/{id}/responses:
   *   post:
   *     summary: Offer assistance; responder identity comes from JWT
   *     tags: [SOS]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status: { type: string, enum: [coming] }
   *     responses:
   *       201: { description: Assistance and chat committed }
   *       200: { description: Existing assistance replay; no duplicate chat }
   *       400: { description: Invalid payload or self-assistance }
   *       401: { description: Unauthorized }
   *       403: { description: Not authorized to access incident }
   *       404: { description: Incident not found }
   *       409: { description: Incident closed before new assistance }
   *       429: { description: Rate limited }
   *       503: { description: SOS unavailable or capacity exceeded }
   */
  router.post('/', validate({ body: createSosBody }), controller.create);
  router.get('/', validate({ query: listSosQuery }), controller.list);
  router.get('/:id', validate({ params: sosParams, query: sosQuery }), controller.get);
  router.post('/:id/responses', validate({ params: sosParams, body: respondSosBody }), controller.respond);
  router.patch('/:id', validate({ params: sosParams, body: closeSosBody }), controller.close);
  return router;
}

module.exports = { createSosRoutes };
