const { newRequestId, withLogContext } = require('../../../infrastructure/observability/logContext');

const ROUTES = new Set(['auth', 'groups', 'privacy', 'history', 'locations', 'conversations', 'chat']);

function routeGroup(req) {
  if (req.path === '/metrics' || req.path === '/metrics/') return 'system';
  if (!req.route) return 'unmatched';
  if (!req.originalUrl.startsWith('/api/v1/')) return 'system';
  const group = req.originalUrl.slice('/api/v1/'.length).split(/[/?]/, 1)[0];
  return ROUTES.has(group) ? group : 'system';
}

function createRequestContext(logger) {
  return (req, res, next) => {
    const requestId = newRequestId();
    const started = process.hrtime.bigint();
    res.set('X-Request-Id', requestId);
    let recorded = false;
    const record = () => {
      if (recorded) return;
      recorded = true;
      logger.log('HTTP_REQUEST_COMPLETED', {
        requestId,
        route: routeGroup(req),
        statusCode: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - started) / 1e6,
      });
    };
    res.once('finish', record);
    res.once('close', record);
    withLogContext({ requestId }, next);
  };
}

module.exports = { createRequestContext };
