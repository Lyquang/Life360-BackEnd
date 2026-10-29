const { Errors } = require('../../domain/errors');

// Shared across sockets in one process; bounded memory, no timer or identity logging.
function createSosSocketLimiter({ limit = 60, maxKeys = 10000, now = Date.now } = {}) {
  const windows = new Map();
  return {
    consume(userId) {
      const at = now();
      for (const [key, entry] of windows) {
        if (entry.until > at) break;
        windows.delete(key);
      }
      const key = String(userId);
      let entry = windows.get(key);
      if (!entry) {
        if (windows.size >= maxKeys) throw Errors.tooManyRequests('SOS request capacity reached. Retry later.');
        entry = { until: at + 60000, count: 0 };
        windows.set(key, entry);
      }
      if (entry.count >= limit) throw Errors.tooManyRequests('Too many SOS requests. Please retry later.');
      entry.count++;
    },
  };
}

module.exports = { createSosSocketLimiter };
