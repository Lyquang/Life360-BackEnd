const express = require('express');
const { socketEventDocs } = require('../../socket/socketEventDocs');

function createSystemRoutes({ publicUrl, isDatabaseConnected }) {
  const router = express.Router();

  function health(req, res) {
    res.json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: isDatabaseConnected() ? 'connected' : 'disconnected',
    });
  }

  /**
   * @swagger
   * /api/v1/health:
   *   get:
   *     summary: Health check (also served at /api/health for the load balancer)
   *     tags: [System]
   *     responses:
   *       200: { description: Server is running }
   */
  router.get('/health', health);

  /**
   * @swagger
   * /api/v1/socket-info:
   *   get:
   *     summary: Socket.IO connection info and event reference
   *     tags: [System]
   *     responses:
   *       200: { description: Event documentation }
   */
  router.get('/socket-info', (req, res) => {
    res.json({
      success: true,
      connection: {
        url: publicUrl,
        auth: 'Provide JWT in handshake: { auth: { token: "YOUR_JWT_TOKEN" } }',
      },
      events: socketEventDocs,
    });
  });

  return { router, health };
}

module.exports = { createSystemRoutes };
