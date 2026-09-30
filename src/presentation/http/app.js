const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const { createAuthenticate } = require('./middleware/authenticate');
const { createAuthLimiter } = require('./middleware/rateLimiter');
const { createErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { createAuthController } = require('./controllers/authController');
const { createGroupController } = require('./controllers/groupController');
const { createHistoryController } = require('./controllers/historyController');
const { createChatController } = require('./controllers/chatController');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createGroupRoutes } = require('./routes/groupRoutes');
const { createHistoryRoutes } = require('./routes/historyRoutes');
const { createConversationRoutes, createChatRoutes } = require('./routes/chatRoutes');
const { createSystemRoutes } = require('./routes/systemRoutes');

/** Mounts middleware and the /api/v1 routes on an existing Express app. */
function configureApp(app, { config, useCases, swaggerSpec, isDatabaseConnected, logger = console }) {
  // Render terminates TLS at its proxy; needed for correct req.ip in rate limiting.
  app.set('trust proxy', 1);
  // CSP disabled so Swagger UI assets load on both http://localhost and https.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Family Tracker API Docs',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'list', filter: true },
    })
  );
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

  const authenticate = createAuthenticate(useCases.auth);
  const system = createSystemRoutes({ publicUrl: config.publicUrl, isDatabaseConnected });
  const chatController = createChatController(useCases);

  const v1 = express.Router();
  v1.use('/', system.router);
  v1.use('/auth', createAuthRoutes({
    controller: createAuthController(useCases),
    authenticate,
    authLimiter: createAuthLimiter(config.authRateLimit),
  }));
  v1.use('/groups', createGroupRoutes({ controller: createGroupController(useCases), authenticate }));
  v1.use('/history', createHistoryRoutes({ controller: createHistoryController(useCases), authenticate }));
  v1.use('/conversations', createConversationRoutes({ controller: chatController, authenticate }));
  v1.use('/chat', createChatRoutes({ controller: chatController, authenticate }));

  app.use('/api/v1', v1);
  // Unversioned health endpoint for the load balancer (Render health check).
  app.get('/api/health', system.health);
  app.get('/', (req, res) => res.redirect('/api-docs'));

  app.use(notFoundHandler);
  app.use(createErrorHandler({ isProduction: config.isProduction, logger }));
  return app;
}

module.exports = { configureApp };
