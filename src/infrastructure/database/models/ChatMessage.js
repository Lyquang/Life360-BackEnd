const mongoose = require('mongoose');

const MESSAGE_TYPES = ['text', 'image'];

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
    attachment: {
      type: attachmentSchema,
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

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
ChatMessage.TYPES = MESSAGE_TYPES;

module.exports = ChatMessage;
