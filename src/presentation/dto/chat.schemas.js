const { z, objectId, httpsUrl } = require('./common');
const { IMAGE_MIME_TYPES, VOICE_MIME_TYPES, MEDIA_TYPES, MAX_IMAGE_DIMENSION, BLURHASH_REGEX } = require('../../domain/media');

const MAX_CONTENT_LENGTH = 2000;
// Hard ceiling; the effective limit is UPLOAD_MAX_BYTES (enforced by the use case).
const ABSOLUTE_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_VOICE_DURATION_SECONDS = 15 * 60;

const conversationIdParams = z.object({ conversationId: objectId });

const listMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: objectId.optional(),
});

const markReadBody = z.object({
  messageId: objectId.optional(),
});

const updateConversationBody = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    avatarUrl: httpsUrl.nullable().optional(),
  })
  .refine((d) => d.name !== undefined || d.avatarUrl !== undefined, 'Provide at least one of: name, avatarUrl.');

const openDirectBody = z.object({ userId: objectId });

const uploadTicketBody = z.object({
  conversationId: objectId,
  contentType: z.enum(IMAGE_MIME_TYPES),
  contentLength: z.number().int().positive().max(ABSOLUTE_MAX_UPLOAD_BYTES),
});

const mediaUploadTicketBody = z.object({
  conversationId: objectId,
  mediaType: z.enum(MEDIA_TYPES),
  extension: z.string().trim().toLowerCase().regex(/^[a-z0-9]{2,10}$/, 'Invalid extension.'),
  mimeType: z.enum([...IMAGE_MIME_TYPES, ...VOICE_MIME_TYPES]),
  fileSize: z.number().int().positive().max(ABSOLUTE_MAX_UPLOAD_BYTES),
});

const dimension = z.number().int().min(1).max(MAX_IMAGE_DIMENSION);

const textMessage = z.object({
  conversationId: objectId,
  type: z.literal('text'),
  content: z.string().trim().min(1, 'Message content cannot be empty.').max(MAX_CONTENT_LENGTH),
});

const imageMessage = z.object({
  conversationId: objectId,
  type: z.literal('image'),
  attachmentUrl: httpsUrl,
  content: z.string().trim().max(MAX_CONTENT_LENGTH).optional(),
  metadata: z.object({
    width: dimension,
    height: dimension,
    blurhash: z.string().regex(BLURHASH_REGEX, 'Invalid blurhash.'),
    mimeType: z.enum(IMAGE_MIME_TYPES).optional(),
    size: z.number().int().positive().optional(),
  }),
});

const voiceMessage = z.object({
  conversationId: objectId,
  type: z.literal('voice'),
  mediaUrl: httpsUrl,
  duration: z.number().positive().max(MAX_VOICE_DURATION_SECONDS),
  fileSize: z.number().int().positive().max(ABSOLUTE_MAX_UPLOAD_BYTES),
  mimeType: z.enum(VOICE_MIME_TYPES),
});

const sendMessagePayload = z.discriminatedUnion('type', [textMessage, imageMessage, voiceMessage]);

// REST variant: conversationId comes from URL params, not body.
// Strips conversationId from body fields so the use case gets it injected from params.
const sendMessageBody = z.discriminatedUnion('type', [
  textMessage.omit({ conversationId: true }),
  imageMessage.omit({ conversationId: true }),
  voiceMessage.omit({ conversationId: true }),
]);

const markReadPayload = z.object({
  conversationId: objectId,
  messageId: objectId.optional(),
});

const typingPayload = z.object({
  conversationId: objectId,
  isTyping: z.boolean(),
});

module.exports = {
  conversationIdParams,
  listMessagesQuery,
  markReadBody,
  updateConversationBody,
  openDirectBody,
  uploadTicketBody,
  mediaUploadTicketBody,
  sendMessagePayload,
  sendMessageBody,
  markReadPayload,
  typingPayload,
};
