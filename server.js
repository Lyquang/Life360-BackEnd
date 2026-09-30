require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const initializeSocket = require('./sockets/socketHandler');

// ─── Initialize Express & HTTP Server ───────────────────────
const app = express();
const server = http.createServer(app);

// ─── Initialize Socket.io ───────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ─── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      url: `http://localhost:${process.env.PORT || 3000}`,
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
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─── Connect MongoDB & Start Server ─────────────────────────
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/location-sharing-app';

async function startServer() {
  let mongoUri = MONGODB_URI;

  try {
    // Try connecting to the configured MongoDB
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('✅ MongoDB connected successfully (external)');
  } catch (error) {
    console.log('⚠️  Could not connect to external MongoDB. Starting in-memory MongoDB...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      await mongoose.connect(mongoUri);
      console.log('✅ MongoDB In-Memory Server started successfully');
      console.log('⚠️  Note: Data will be lost when server stops (in-memory mode)');
    } catch (memError) {
      console.error('❌ Failed to start in-memory MongoDB:', memError.message);
      process.exit(1);
    }
  }

  // Initialize Socket.io after DB connection
  initializeSocket(io);

  server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║     🚀 Location Sharing API Server               ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Server:      http://localhost:${PORT}               ║`);
    console.log(`║  Swagger UI:  http://localhost:${PORT}/api-docs       ║`);
    console.log(`║  Socket.io:   http://localhost:${PORT}               ║`);
    console.log(`║  Socket Docs: http://localhost:${PORT}/api/socket-info║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  MongoDB:     Connected ✅                        ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
  });
}

startServer();

module.exports = { app, server, io };
