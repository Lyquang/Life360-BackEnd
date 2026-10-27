const { createHash, timingSafeEqual } = require('node:crypto');
const { gzip } = require('node:zlib');
const { promisify } = require('node:util');
const compress = promisify(gzip);
const groups = new Set(['auth', 'groups', 'privacy', 'history', 'locations', 'conversations', 'chat']);
const digest = value => createHash('sha256').update(value).digest();

function createMetricsMiddleware(metrics, token) {
  const expected = digest(token || '');
  let windowStart = Date.now();
  let scrapes = 0;
  let busy = false;
  return async function metricsMiddleware(req, res, next) {
    if (req.path !== '/metrics' && req.path !== '/metrics/') {
      if (metrics.enabled) {
        const start = process.hrtime.bigint();
        const groupCandidate = req.path.split('/')[3];
        let recorded = false;
        const record = () => {
          if (recorded) return;
          recorded = true;
          try {
            const route = !req.route ? 'unmatched' : groups.has(groupCandidate) ? groupCandidate : 'system';
            const status = res.writableFinished ? `${Math.floor(res.statusCode / 100)}xx` : 'other';
            metrics.increment('http_requests_total', { method: req.method, route, status_class: status });
            metrics.observe('http_request_duration_seconds', { route }, Number(process.hrtime.bigint() - start) / 1e9);
            if (res.statusCode === 429) metrics.increment('http_rate_limited_total', { route });
          } catch { /* Instrumentation failure must not change HTTP behavior. */ }
        };
        res.once('finish', record);
        res.once('close', record);
      }
      return next();
    }
    res.set('Cache-Control', 'no-store');
    if (!metrics.enabled) return res.sendStatus(404);
    if (req.method !== 'GET') return res.set('Allow', 'GET').sendStatus(405);
    const header = req.headers.authorization;
    if (typeof header !== 'string' || header.length > 263 || !header.startsWith('Bearer ') ||
        !timingSafeEqual(expected, digest(header.slice(7)))) {
      return res.set('WWW-Authenticate', 'Bearer').sendStatus(401);
    }
    const now = Date.now();
    if (now - windowStart >= 60000) { windowStart = now; scrapes = 0; }
    if (busy || scrapes >= 10) {
      return res.set('Retry-After', String(Math.max(1, Math.ceil((60000 - (now - windowStart)) / 1000)))).sendStatus(429);
    }
    scrapes++;
    busy = true;
    try {
      const result = await metrics.snapshot();
      if (result.failed || !result.text || Buffer.byteLength(result.text) > 1024 * 1024) return res.sendStatus(503);
      res.set('Vary', 'Accept-Encoding');
      res.set('Content-Type', result.contentType);
      const encoding = req.acceptsEncodings('gzip', 'identity');
      if (!encoding) return res.sendStatus(406);
      if (encoding === 'gzip') {
        const data = await compress(result.text);
        res.set('Content-Encoding', 'gzip');
        return res.send(data);
      }
      return res.send(result.text);
    } catch {
      if (!res.headersSent) res.sendStatus(503);
    } finally { busy = false; }
  };
}

module.exports = { createMetricsMiddleware };
