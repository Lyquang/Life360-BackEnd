const pino = require('pino');
const { getLogContext } = require('./logContext');

const EVENT_CODES = new Set([
  'UNCLASSIFIED_EVENT', 'SAFE_EVENT', 'AUTH_LOGIN_SUCCEEDED', 'AUTH_REFRESH_TOKEN_REUSED',
  'DATABASE_CONNECTION_FALLBACK', 'HTTP_UNHANDLED_ERROR', 'SERVER_CONFIG_FAILED',
  'SERVER_START_FAILED', 'SERVER_SHUTDOWN_FAILED', 'REDIS_CONNECTION_ERROR',
  'REDIS_OPERATION_FAILED', 'SOCKET_CONNECTED', 'SOCKET_DISCONNECTED',
  'SOCKET_DISCONNECT_FAILED', 'SOCKET_SESSION_INIT_FAILED', 'LOCATION_UPDATE_FAILED',
  'LOCATION_STAY_ALERT_SENT', 'SOS_ALERT_REQUESTED', 'SOS_ALERT_FAILED',
  'CHAT_ACTION_FAILED', 'CHAT_TYPING_FAILED', 'GROUP_DIGEST_SENT',
  'CHAT_GROUP_SYNC_COMPLETED', 'HTTP_REQUEST_COMPLETED', 'SERVER_READY',
  'SERVER_SHUTDOWN_STARTED', 'SERVER_SHUTDOWN_COMPLETE',
  'LIVE_TRAIL_SOCKET_ACTION_FAILED', 'LIVE_TRAIL_LEASE_REVALIDATION_FAILED',
  'LIVE_TRAIL_LEASE_CYCLE_FAILED', 'DIGEST_SCHEDULER_FAILED',
]);
const ID = /^[0-9a-f]{32}$/;
const ROUTE = new Set(['auth', 'groups', 'privacy', 'history', 'locations', 'conversations', 'chat', 'system', 'unmatched', 'other']);
const SOCKET_EVENT = new Set(['connect', 'disconnect', 'update_location', 'sos_alert', 'chat:send_message', 'chat:typing', 'chat:mark_read', 'journey:watch', 'journey:unwatch', 'journey:lease', 'session:ready']);
const SAFE_KEYS = new Set(['requestId', 'connectionId', 'eventId', 'route', 'statusCode', 'durationMs', 'event', 'errorCode', 'count']);

function safeFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const result = {};
  for (const key of SAFE_KEYS) {
    let value;
    try { value = input[key]; } catch { continue; }
    if (['requestId', 'connectionId', 'eventId'].includes(key) && typeof value === 'string' && ID.test(value)) result[key] = value;
    else if (key === 'route' && ROUTE.has(value)) result[key] = value;
    else if (key === 'event' && SOCKET_EVENT.has(value)) result[key] = value;
    else if (key === 'errorCode' && EVENT_CODES.has(value)) result[key] = value;
    else if (key === 'statusCode' && Number.isInteger(value) && value >= 100 && value <= 599) result[key] = value;
    else if (key === 'durationMs' && Number.isFinite(value) && value >= 0 && value <= 60000) result[key] = Math.round(value);
    else if (key === 'count' && Number.isSafeInteger(value) && value >= 0 && value <= 1000000) result[key] = value;
  }
  return result;
}

function createSafeLogger({ destination = process.stdout, level = 'info' } = {}) {
  const writer = pino({ level: ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info',
    base: { service: 'familytracker-backend' }, timestamp: pino.stdTimeFunctions.isoTime,
    serializers: { err: () => '[REDACTED]', error: () => '[REDACTED]' } }, destination);

  function write(method, eventCode, fields) {
    try {
      const msg = EVENT_CODES.has(eventCode) ? eventCode : 'UNCLASSIFIED_EVENT';
      const meta = safeFields({ ...safeFields(getLogContext()), ...safeFields(fields) });
      writer[method](meta, msg);
    } catch { /* Logging must never interrupt the business operation. */ }
  }

  return Object.freeze({
    log(eventCode, fields) { write('info', eventCode, fields); },
    warn(eventCode, fields) { write('warn', eventCode, fields); },
    error(eventCode, fields) { write('error', eventCode, fields); },
  });
}

module.exports = { createSafeLogger, safeFields };
