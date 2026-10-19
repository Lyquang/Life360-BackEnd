const express = require('express');
const { validate } = require('../middleware/validate');
const { locationSharingBody } = require('../../dto/privacy.schemas');

function createPrivacyRoutes({ controller, authenticate }) {
  const router = express.Router();
  router.use(authenticate);

  /**
   * @swagger
   * /api/v1/privacy/location-sharing:
   *   get:
   *     summary: Get the current account-wide location sharing state
   *     tags: [Privacy]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Effective sharing state and optional pause expiry }
   *       401: { description: Missing or invalid access token }
   *   patch:
   *     summary: Enable, pause temporarily, or pause location sharing indefinitely
   *     tags: [Privacy]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [enabled]
   *             properties:
   *               enabled: { type: boolean, example: false }
   *               pausedUntil: { type: string, format: date-time, nullable: true, description: Maximum 7 days; null or omitted pauses indefinitely }
   *     responses:
   *       200: { description: Updated sharing state }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       401: { description: Missing or invalid access token }
   */
  router.get('/location-sharing', controller.getLocationSharing);
  router.patch(
    '/location-sharing',
    validate({ body: locationSharingBody }),
    controller.setLocationSharing
  );

  return router;
}

module.exports = { createPrivacyRoutes };
