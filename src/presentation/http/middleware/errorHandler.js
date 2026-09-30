const { AppError } = require('../../../domain/errors');

function createErrorHandler({ isProduction, logger = console }) {
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        success: false,
        code: err.code,
        message: err.message,
        ...(err.details && { errors: err.details }),
      });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Malformed JSON body.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large.' });
    }

    logger.error('❌ Unhandled error:', err);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Internal Server Error' : err.message,
    });
  };
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

module.exports = { createErrorHandler, notFoundHandler };
