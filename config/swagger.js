const swaggerJsdoc = require('swagger-jsdoc');

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
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
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
      { name: 'Auth', description: 'Authentication (Register, Login)' },
      { name: 'Groups', description: 'Group management (Create, Join, Members)' },
      { name: 'Places', description: 'Favorite places management' },
      { name: 'History', description: 'Location history' },
      { name: 'Socket.io', description: 'Real-time events documentation' },
    ],
  },
  apis: ['./routes/*.js', './server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
