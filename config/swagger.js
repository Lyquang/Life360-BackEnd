const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const localUrl = `http://localhost:${process.env.PORT || 3000}`;
const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;

const servers = [];
if (publicUrl) servers.push({ url: publicUrl, description: 'Production server' });
servers.push({ url: localUrl, description: 'Development server' });

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Location Sharing API',
      version: '1.0.0',
      description:
        'Real-time location sharing backend API (Life360-like) with Socket.io, MongoDB, JWT Authentication. ' +
        'Supports user auth, group management, favorite places, location history, and real-time features.',
      contact: {
        name: 'API Support',
      },
    },
    servers,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from POST /api/auth/login',
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Server health check' },
      { name: 'Auth', description: 'Authentication (Register, Login)' },
      { name: 'Groups', description: 'Group management (Create, Join, Members)' },
      { name: 'Places', description: 'Favorite places management' },
      { name: 'History', description: 'Location history' },
      { name: 'Socket.io', description: 'Real-time events documentation' },
    ],
  },
  apis: [
    path.join(__dirname, '..', 'routes', '*.js'),
    path.join(__dirname, '..', 'server.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
