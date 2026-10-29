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

function createRefreshLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many refresh attempts. Please try again later.',
    },
  });
}

function createLocationBatchLimiter(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    keyGenerator: (req) => req.user._id.toString(),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many location batch requests. Please retry later.',
    },
  });
}

function createLiveTrailReadLimiter(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    keyGenerator: (req) => req.user._id.toString(),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many live trail requests. Please retry later.',
    },
  });
}

function createSosLimiter(limit = 60) {
  return rateLimit({ windowMs: 60 * 1000, limit,
    keyGenerator: (req) => req.user._id.toString(), standardHeaders: 'draft-7', legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', message: 'Too many SOS requests. Please retry later.' },
  });
}

module.exports = {
  createSosLimiter,
  createAuthLimiter,
  createRefreshLimiter,
  createLocationBatchLimiter,
  createLiveTrailReadLimiter,
};
