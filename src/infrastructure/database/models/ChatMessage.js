const mongoose = require('mongoose');

const MESSAGE_TYPES = ['text', 'image', 'voice'];

const sosSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, ref: 'SosIncident', required: true },
  kind: { type: String, enum: ['alert', 'assistance'], required: true },
}, { _id: false });

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    blurhash: { type: String, required: true },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: MESSAGE_TYPES,
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    sos: {
      type: sosSchema,
      validate: { validator: function () { return this.type === 'text'; }, message: 'SOS messages must be text.' },
    },
    attachment: {
      type: attachmentSchema,
      default: null,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
      min: 0,
    },
    fileSize: {
      type: Number,
      default: null,
      min: 0,
    },
    mimeType: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'chat_messages',
  }
);

// Serves history pagination and unread counting: { conversationId, _id: { $gt: lastReadMessageId } }.
chatMessageSchema.index({ conversationId: 1, _id: 1 });
chatMessageSchema.index({ conversationId: 1, 'sos.id': 1 }, {
  unique: true,
  partialFilterExpression: { 'sos.kind': 'alert' },
});
chatMessageSchema.index({ conversationId: 1, 'sos.id': 1, senderId: 1 }, {
  unique: true,
  partialFilterExpression: { 'sos.kind': 'assistance' },
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
ChatMessage.TYPES = MESSAGE_TYPES;

module.exports = ChatMessage;
