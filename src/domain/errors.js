class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const Errors = {
  badRequest: (message, details) => new AppError(400, 'BAD_REQUEST', message, details),
  validation: (details) => new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', details),
  unauthorized: (message = 'Unauthorized.') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Forbidden.') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message) => new AppError(409, 'CONFLICT', message),
  tooManyRequests: (message) => new AppError(429, 'RATE_LIMITED', message),
  serviceUnavailable: (message) => new AppError(503, 'SERVICE_UNAVAILABLE', message),
};

module.exports = { AppError, Errors };
