const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { connectDatabase, isDatabaseConnected } = require('./infrastructure/database/connection');
const { createContainer } = require('./container');
const { createSwaggerSpec } = require('./config/swagger');
const { configureApp } = require('./presentation/http/app');
const { registerSocketServer } = require('./presentation/socket/socketServer');
const { startDigestScheduler } = require('./presentation/jobs/digestScheduler');

/**
 * Builds the whole server (DB, HTTP, Socket.IO, jobs) without listening.
 * @param {ReturnType<import('./config/env').loadConfig>} config
 */
async function createServer(config, { logger = console, digestIntervalMs } = {}) {
  const db = await connectDatabase({
    uri: config.mongodbUri,
    isProduction: config.isProduction,
    allowInMemoryFallback: config.allowInMemoryDatabase,
    logger,
  });

  // The app must be the server's request listener before Socket.IO attaches to it.
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 100 * 1024,
  });

  const container = createContainer({ config, io, supportsTransactions: db.supportsTransactions, logger });
  const { useCases, services } = container;

  const synced = await useCases.chat.syncGroupConversations();
  logger.log(`💬 Group conversations in sync (${synced} circles)`);

  configureApp(app, {
    config,
    useCases,
    swaggerSpec: createSwaggerSpec({ publicUrl: config.publicUrl, port: config.port }),
    isDatabaseConnected,
    logger,
  });
  registerSocketServer(io, { ...useCases, realtime: services.realtime, logger });
  const scheduler = startDigestScheduler({ digests: useCases.digests, intervalMs: digestIntervalMs, logger });

  return {
    app,
    server,
    io,
    container,
    db,
    listen(port = config.port) {
      return new Promise((resolve) => server.listen(port, '0.0.0.0', () => resolve(server.address().port)));
    },
    async close() {
      scheduler.stop();
      await new Promise((resolve) => io.close(() => resolve()));
      await db.disconnect();
    },
  };
}

module.exports = { createServer };
