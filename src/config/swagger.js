const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

function createSwaggerSpec({ publicUrl, port }) {
  const localUrl = `http://localhost:${port}`;
  const servers = [{ url: publicUrl, description: publicUrl === localUrl ? 'Local server' : 'Production server' }];
  if (publicUrl !== localUrl) servers.push({ url: localUrl, description: 'Local server' });

  return swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Family Tracker API',
        version: '1.0.0',
        description:
          'Realtime location sharing (Life360-like): circles, location history, digests, chat. ' +
          'REST under /api/v1; realtime events over Socket.IO — see GET /api/v1/socket-info.',
      },
      servers,
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        parameters: {
          GroupId: { in: 'path', name: 'groupId', required: true, schema: { type: 'string' } },
          UserId: { in: 'path', name: 'userId', required: true, schema: { type: 'string' } },
          ConversationId: { in: 'path', name: 'conversationId', required: true, schema: { type: 'string' } },
        },
        responses: {
          ValidationError: {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    code: { type: 'string', example: 'VALIDATION_ERROR' },
                    message: { type: 'string', example: 'Validation failed.' },
                    errors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { field: { type: 'string' }, message: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        schemas: {
          Member: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              avatar: { type: 'string', nullable: true },
              isOnline: { type: 'boolean' },
              lastSeenAt: { type: 'string', format: 'date-time', nullable: true },
            },
          },
          Message: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              conversationId: { type: 'string' },
              senderId: { type: 'string' },
              senderName: { type: 'string', nullable: true },
              type: { type: 'string', enum: ['text', 'image'] },
              content: { type: 'string' },
              attachment: {
                type: 'object',
                nullable: true,
                properties: {
                  url: { type: 'string' },
                  mimeType: { type: 'string', nullable: true },
                  size: { type: 'integer', nullable: true },
                  width: { type: 'integer' },
                  height: { type: 'integer' },
                  blurhash: { type: 'string' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          Conversation: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['group', 'direct'] },
              groupId: { type: 'string', nullable: true },
              name: { type: 'string', nullable: true },
              avatarUrl: { type: 'string', nullable: true },
              members: { type: 'array', items: { $ref: '#/components/schemas/Member' } },
              lastMessage: { allOf: [{ $ref: '#/components/schemas/Message' }], nullable: true },
              lastMessageAt: { type: 'string', format: 'date-time', nullable: true },
              unreadCount: { type: 'integer' },
              lastReadMessageId: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          UploadTicket: {
            type: 'object',
            properties: {
              uploadUrl: { type: 'string' },
              method: { type: 'string', example: 'PUT' },
              headers: { type: 'object', additionalProperties: { type: 'string' } },
              key: { type: 'string' },
              fileUrl: { type: 'string', description: 'Use as attachmentUrl in chat:send_message' },
              expiresIn: { type: 'integer' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      tags: [
        { name: 'System' },
        { name: 'Auth' },
        { name: 'Groups', description: 'Circles, members, digests' },
        { name: 'Places' },
        { name: 'History' },
        { name: 'Chat', description: 'Conversations, messages, read receipts, media upload' },
      ],
    },
    apis: [path.join(__dirname, '..', 'presentation', 'http', 'routes', '*.js')],
  });
}

module.exports = { createSwaggerSpec };
