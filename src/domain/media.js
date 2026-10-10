const IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

const VOICE_MIME_EXTENSIONS = {
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
};

const IMAGE_MIME_TYPES = Object.keys(IMAGE_MIME_EXTENSIONS);
const VOICE_MIME_TYPES = Object.keys(VOICE_MIME_EXTENSIONS);
const MEDIA_MIME_EXTENSIONS = { ...IMAGE_MIME_EXTENSIONS, ...VOICE_MIME_EXTENSIONS };
const MEDIA_TYPES = ['image', 'voice'];
const MAX_IMAGE_DIMENSION = 20000;
// Blurhash uses a base83 alphabet; real hashes are 6–~100 chars.
const BLURHASH_REGEX = /^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{6,100}$/;
const CHAT_UPLOAD_KEY_REGEX =
  /^chat\/([a-f0-9]{24})\/([a-f0-9]{24})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif|gif)$/;
const CHAT_MEDIA_UPLOAD_KEY_REGEX =
  /^chats\/([a-f0-9]{24})\/([a-f0-9]{24})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.([a-z0-9]+)$/;

function buildChatUploadKey({ conversationId, userId, uuid, contentType }) {
  return `chat/${conversationId}/${userId}/${uuid}.${IMAGE_MIME_EXTENSIONS[contentType]}`;
}

function extensionForMimeType(mimeType) {
  return MEDIA_MIME_EXTENSIONS[mimeType] || null;
}

function buildChatMediaUploadKey({ conversationId, userId, uuid, mimeType }) {
  const extension = extensionForMimeType(mimeType);
  return `chats/${conversationId}/${userId}/${uuid}.${extension}`;
}

/** True only for keys issued by an upload ticket to this user for this conversation. */
function isChatUploadKeyOwnedBy(key, { conversationId, userId }) {
  const match = CHAT_UPLOAD_KEY_REGEX.exec(key || '');
  return Boolean(match) && match[1] === conversationId.toString() && match[2] === userId.toString();
}

function isChatMediaUploadKeyOwnedBy(key, { conversationId, userId }) {
  const match = CHAT_MEDIA_UPLOAD_KEY_REGEX.exec(key || '');
  return (
    Boolean(match) &&
    match[1] === conversationId.toString() &&
    match[2] === userId.toString() &&
    Object.values(MEDIA_MIME_EXTENSIONS).includes(match[3])
  );
}

module.exports = {
  IMAGE_MIME_TYPES,
  VOICE_MIME_TYPES,
  MEDIA_TYPES,
  MAX_IMAGE_DIMENSION,
  BLURHASH_REGEX,
  extensionForMimeType,
  buildChatUploadKey,
  buildChatMediaUploadKey,
  isChatUploadKeyOwnedBy,
  isChatMediaUploadKeyOwnedBy,
};
