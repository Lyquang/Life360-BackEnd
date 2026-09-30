const IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

const IMAGE_MIME_TYPES = Object.keys(IMAGE_MIME_EXTENSIONS);
const MAX_IMAGE_DIMENSION = 20000;
// Blurhash uses a base83 alphabet; real hashes are 6–~100 chars.
const BLURHASH_REGEX = /^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{6,100}$/;
const CHAT_UPLOAD_KEY_REGEX =
  /^chat\/([a-f0-9]{24})\/([a-f0-9]{24})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif|gif)$/;

function buildChatUploadKey({ conversationId, userId, uuid, contentType }) {
  return `chat/${conversationId}/${userId}/${uuid}.${IMAGE_MIME_EXTENSIONS[contentType]}`;
}

/** True only for keys issued by an upload ticket to this user for this conversation. */
function isChatUploadKeyOwnedBy(key, { conversationId, userId }) {
  const match = CHAT_UPLOAD_KEY_REGEX.exec(key || '');
  return Boolean(match) && match[1] === conversationId.toString() && match[2] === userId.toString();
}

module.exports = {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_DIMENSION,
  BLURHASH_REGEX,
  buildChatUploadKey,
  isChatUploadKeyOwnedBy,
};
