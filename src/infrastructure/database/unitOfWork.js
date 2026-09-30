const mongoose = require('mongoose');

/**
 * Runs work(session) atomically. On a standalone MongoDB (local dev only — production
 * refuses to start without replica set support) it runs without a session.
 */
function createUnitOfWork({ supportsTransactions, logger = console }) {
  let warned = false;

  return {
    async run(work) {
      if (!supportsTransactions) {
        if (!warned) {
          logger.warn('⚠️  MongoDB is standalone: running WITHOUT transactions (development only).');
          warned = true;
        }
        return work(null);
      }

      let result;
      // withTransaction retries the callback on TransientTransactionError.
      await mongoose.connection.transaction(async (session) => {
        result = await work(session);
      });
      return result;
    },
  };
}

module.exports = { createUnitOfWork };
