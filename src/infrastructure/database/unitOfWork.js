const mongoose = require('mongoose');
const { createSafeMetrics } = require('../../application/ports/metrics');

/**
 * Runs work(session) atomically. On a standalone MongoDB (local dev only — production
 * refuses to start without replica set support) it runs without a session.
 */
function createUnitOfWork({ supportsTransactions, logger = console, metrics }) {
  const telemetry = createSafeMetrics(metrics);
  let warned = false;

  return {
    async run(work) {
      if (!supportsTransactions) {
        telemetry.increment('mongo_transactions_total', { outcome: 'unsupported' });
        if (!warned) {
          logger.warn('DATABASE_TRANSACTIONS_UNAVAILABLE');
          warned = true;
        }
        try {
          return await work(null);
        } catch (error) {
          telemetry.increment('mongo_transactions_total', { outcome: 'error' });
          throw error;
        }
      }

      let result;
      // withTransaction retries the callback on TransientTransactionError.
      try {
        await mongoose.connection.transaction(async (session) => {
          result = await work(session);
        });
        telemetry.increment('mongo_transactions_total', { outcome: 'success' });
        return result;
      } catch (error) {
        telemetry.increment('mongo_transactions_total', { outcome: 'error' });
        throw error;
      }
    },
  };
}

module.exports = { createUnitOfWork };
