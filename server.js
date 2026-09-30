require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const initializeSocket = require('./sockets/socketHandler');

// ─── Environment ─────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/location-sharing-app';
// RENDER_EXTERNAL_URL is injected automatically by Render.
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

const requiredEnv = isProduction ? ['JWT_SECRET', 'MONGODB_URI'] : ['JWT_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const corsOrigin =
  !process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.trim() === '*'
    ? '*'
    : process.env.CORS_ORIGIN.split(',').map((o) => o.trim());

// ─── Initialize Express & HTTP Server ───────────────────────
const app = express();
const server = http.createServer(app);

// Render terminates TLS at its proxy; needed for correct req.ip in rate limiting.
app.set('trust proxy', 1);

// ─── Initialize Socket.io ───────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 100 * 1024,
});

// ─── Middleware ──────────────────────────────────────────────
// CSP disabled so Swagger UI assets load on both http://localhost and https.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Strip internal error details from 5xx responses in production.
if (isProduction) {
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 500 && body && typeof body === 'object' && 'error' in body) {
        const { error, ...rest } = body;
        return originalJson(rest);
      }
      return originalJson(body);
    };
    next();
  });
}

// ─── Swagger UI ─────────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Location Sharing API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
    },
  })
);

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── API Routes ─────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/groups', require('./routes/placeRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));

// ─── Health Check ───────────────────────────────────────────
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is running
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

/**
 * @swagger
 * /api/socket-info:
 *   get:
 *     summary: Socket.io connection info and event documentation
 *     tags: [Socket.io]
 *     responses:
 *       200:
 *         description: Socket.io event documentation
 */
app.get('/api/socket-info', (req, res) => {
  res.json({
    success: true,
    message: 'Socket.io Real-time Events Documentation',
    connection: {
      url: PUBLIC_URL,
      auth: 'Provide JWT token in handshake: { auth: { token: "YOUR_JWT_TOKEN" } }',
    },
    events: {
      client_to_server: {
        update_location: {
          description: 'Send current location and battery level',
          payload: '{ latitude: Number, longitude: Number, batteryLevel: Number }',
          behavior: [
            'Updates user batteryLevel in DB',
            'Saves to LocationHistory (throttled: >50m or >30s)',
            'Broadcasts to all group rooms',
          ],
        },
        sos_alert: {
          description: 'Trigger emergency SOS alert',
          payload: '{ message?: String, latitude?: Number, longitude?: Number, batteryLevel?: Number }',
          behavior: 'Broadcasts SOS to all members in all user groups',
        },
      },
      server_to_client: {
        location_update: {
          description: 'Receive location update from a group member',
          payload: '{ userId, name, latitude, longitude, batteryLevel, timestamp }',
        },
        sos_alert: {
          description: 'Receive SOS emergency alert',
          payload: '{ type: "SOS", userId, name, message, latitude, longitude, groupId, groupName, timestamp }',
        },
        sos_confirmed: {
          description: 'Confirmation that SOS was sent',
          payload: '{ message, groupCount }',
        },
        member_online: {
          description: 'A group member came online',
          payload: '{ userId, name, isOnline: true, timestamp }',
        },
        member_offline: {
          description: 'A group member went offline',
          payload: '{ userId, name, isOnline: false, timestamp }',
        },
        error: {
          description: 'Error notification',
          payload: '{ message: String }',
        },
      },
    },
  });
});

// ─── Root redirect ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// ─── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error('❌ Error:', err.message);
  res.status(status).json({
    success: false,
    message: status >= 500 && isProduction ? 'Internal Server Error' : err.message || 'Internal Server Error',
  });
});

// ─── Connect MongoDB & Start Server ─────────────────────────
let memoryServer = null;
let socketHandle = null;

async function connectDatabase() {
  if (isProduction) {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ MongoDB connected successfully');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    console.log('✅ MongoDB connected successfully (external)');
  } catch (error) {
    console.log('⚠️  Could not connect to external MongoDB. Starting in-memory MongoDB...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
    console.log('✅ MongoDB In-Memory Server started successfully');
    console.log('⚠️  Note: Data will be lost when server stops (in-memory mode)');
  }
}

async function startServer() {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }

  // Initialize Socket.io after DB connection
  socketHandle = initializeSocket(io);

  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 Location Sharing API Server');
    console.log(`   Environment: ${isProduction ? 'production' : 'development'}`);
    console.log(`   Server:      ${PUBLIC_URL}`);
    console.log(`   Swagger UI:  ${PUBLIC_URL}/api-docs`);
    console.log(`   Socket Docs: ${PUBLIC_URL}/api/socket-info`);
    console.log(`   Listening:   0.0.0.0:${PORT}`);
    console.log('');
  });
}

// Render sends SIGTERM on deploy/restart.
async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  try {
    socketHandle?.stop();
    await new Promise((resolve) => io.close(() => resolve()));
    await mongoose.connection.close();
    if (memoryServer) await memoryServer.stop();
    console.log('👋 Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

module.exports = { app, server, io };
