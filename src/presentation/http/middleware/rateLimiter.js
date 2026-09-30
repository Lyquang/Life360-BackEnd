const rateLimit = require('express-rate-limit');

function createAuthLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please try again in 15 minutes.',
    },
  });
}

module.exports = { createAuthLimiter };
