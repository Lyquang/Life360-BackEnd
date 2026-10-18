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
          AuthTokenPair: {
            type: 'object',
            required: ['token', 'accessToken', 'refreshToken', 'expiresIn'],
            properties: {
              token: {
                type: 'string',
                deprecated: true,
                description: 'Deprecated alias of accessToken kept for older mobile clients.',
              },
              accessToken: { type: 'string', description: 'Short-lived access JWT.' },
              refreshToken: { type: 'string', description: 'Opaque single-use refresh token.' },
              expiresIn: { type: 'integer', example: 900, description: 'Access token lifetime in seconds.' },
            },
          },
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
          LiveTrailPoint: {
            type: 'object',
            required: ['seq', 'latitude', 'longitude', 'recordedAt'],
            properties: {
              seq: { type: 'integer', minimum: 1 },
              latitude: { type: 'number', minimum: -90, maximum: 90 },
              longitude: { type: 'number', minimum: -180, maximum: 180 },
              recordedAt: { type: 'string', format: 'date-time' },
              accuracy: { type: 'number', minimum: 0 },
              motionState: { type: 'string', nullable: true },
              pointId: { type: 'string', format: 'uuid', nullable: true },
            },
          },
          LiveTrailGap: {
            type: 'object',
            required: ['fromSeq', 'toSeq', 'seconds', 'meters'],
            properties: {
              fromSeq: { type: 'integer', minimum: 1 },
              toSeq: { type: 'integer', minimum: 1 },
              seconds: { type: 'number', minimum: 0 },
              meters: { type: 'number', minimum: 0 },
            },
          },
          LiveTrailMatch: {
            type: 'object',
            required: ['segmentId', 'fromSeq', 'toSeq', 'status', 'matcher', 'sourceRevision', 'generatedAt'],
            properties: {
              segmentId: { type: 'string' },
              fromSeq: { type: 'integer', minimum: 1 },
              toSeq: { type: 'integer', minimum: 1 },
              status: { type: 'string', enum: ['provisional', 'final', 'unmatched'] },
              geometry: {
                type: 'object',
                nullable: true,
                required: ['encoding', 'data'],
                properties: {
                  encoding: { type: 'string', enum: ['polyline6'] },
                  data: { type: 'string' },
                },
              },
              matcher: {
                type: 'object',
                required: ['provider', 'version'],
                properties: {
                  provider: { type: 'string' },
                  version: { type: 'string' },
                },
              },
              confidence: { type: 'number', minimum: 0, maximum: 1, nullable: true },
              sourceRevision: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
            },
          },
          LiveTrailResponse: {
            type: 'object',
            required: [
              'success', 'trailId', 'userId', 'date', 'timeZone', 'revision', 'lastSeq',
              'points', 'gaps', 'matched', 'hasMore', 'nextAfterSeq',
            ],
            properties: {
              success: { type: 'boolean', example: true },
              trailId: { type: 'string' },
              userId: { type: 'string' },
              date: { type: 'string', format: 'date', example: '2026-10-19' },
              timeZone: { type: 'string', example: 'Asia/Ho_Chi_Minh' },
              revision: { type: 'integer', minimum: 1 },
              lastSeq: { type: 'integer', minimum: 0 },
              points: { type: 'array', items: { $ref: '#/components/schemas/LiveTrailPoint' } },
              gaps: { type: 'array', items: { $ref: '#/components/schemas/LiveTrailGap' } },
              matched: { type: 'array', items: { $ref: '#/components/schemas/LiveTrailMatch' } },
              hasMore: { type: 'boolean' },
              nextAfterSeq: { type: 'integer', nullable: true, minimum: 1 },
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
        { name: 'Locations', description: 'Offline location history synchronization' },
        { name: 'Chat', description: 'Conversations, messages, read receipts, media upload' },
      ],
    },
    apis: [path.join(__dirname, '..', 'presentation', 'http', 'routes', '*.js')],
  });
}

module.exports = { createSwaggerSpec };
