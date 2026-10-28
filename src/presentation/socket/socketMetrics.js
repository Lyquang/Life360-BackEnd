const { AppError } = require('../../domain/errors');

function outcomeForError(error) {
  return error instanceof AppError && error.status < 500 ? 'rejected' : 'error';
}

function createSocketMeasurement(metrics) {
  return async (event, callback) => {
    let outcome = 'success';
    const enabled = metrics?.enabled === true;
    const start = enabled ? process.hrtime.bigint() : null;
    const mark = value => { outcome = value; };
    try {
      return await callback(mark);
    } catch (error) {
      outcome = outcomeForError(error);
      throw error;
    } finally {
      if (enabled) {
        try {
          metrics.increment('socket_actions_total', { event, outcome });
          metrics.observe('socket_action_duration_seconds', { event }, Number(process.hrtime.bigint() - start) / 1e9);
        } catch { /* Monitoring must not change Socket delivery. */ }
      }
    }
  };
}

module.exports = { createSocketMeasurement, outcomeForError };
