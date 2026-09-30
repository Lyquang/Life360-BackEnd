/** Forwards async errors to Express' error handler (Express 4 does not do it). */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };
