class AppError extends Error {
  constructor(status, code, message, details, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.data = data;
  }
}

const Errors = {
  badRequest: (message, details) => new AppError(400, 'BAD_REQUEST', message, details),
  validation: (details) => new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', details),
  unauthorized: (message = 'Unauthorized.') => new AppError(401, 'UNAUTHORIZED', message),
  invalidRefreshToken: () =>
    new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.'),
  refreshTokenReused: () =>
    new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token is no longer valid. Please sign in again.'),
  forbidden: (message = 'Forbidden.') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message) => new AppError(409, 'CONFLICT', message),
  trailRevisionChanged: (data) =>
    new AppError(
      409,
      'TRAIL_REVISION_CHANGED',
      'Trail revision changed. Reload the snapshot before applying more points.',
      undefined,
      data
    ),
  tooManyRequests: (message) => new AppError(429, 'RATE_LIMITED', message),
  serviceUnavailable: (message) => new AppError(503, 'SERVICE_UNAVAILABLE', message),
};

module.exports = { AppError, Errors };
