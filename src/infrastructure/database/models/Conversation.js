const mongoose = require('mongoose');

const CONVERSATION_TYPES = ['group', 'direct'];

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: CONVERSATION_TYPES,
      required: true,
    },
    // Set only for type "group" — 1:1 with a Circle (Group).
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
    },
    // Set only for type "direct" — "<smallerUserId>:<largerUserId>", guarantees one DM per pair.
    directKey: {
      type: String,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    avatarUrl: {
      type: String,
      maxlength: 2048,
      default: null,
    },
    lastMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  }
);

conversationSchema.index(
  { groupId: 1 },
  { unique: true, partialFilterExpression: { groupId: { $type: 'objectId' } } }
);
conversationSchema.index(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { directKey: { $type: 'string' } } }
);

const Conversation = mongoose.model('Conversation', conversationSchema);
Conversation.TYPES = CONVERSATION_TYPES;

module.exports = Conversation;
