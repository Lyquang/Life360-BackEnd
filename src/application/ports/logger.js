/** Application-facing contract: event codes and bounded, non-identifying fields only. */
function assertLogger(logger) {
  if (!logger || !['log', 'warn', 'error'].every(method => typeof logger[method] === 'function')) {
    throw new TypeError('Logger must support log(), warn() and error().');
  }
  return logger;
}

module.exports = { assertLogger };
