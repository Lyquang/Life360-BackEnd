/** Serial bounded polling. Stop drains the active dispatch before DB/Socket teardown. */
function startSosOutboxScheduler({ dispatcher, policy, logger = console }) {
  if (!policy?.enabled) return { stop: async () => {} };
  if (!dispatcher || !Number.isInteger(policy.pollMs) || policy.pollMs < 1
    || !Number.isInteger(policy.batchSize) || policy.batchSize < 1) {
    throw new TypeError('Invalid SOS scheduler configuration.');
  }
  let stopped = false;
  let timer;
  let active = Promise.resolve();
  function schedule() {
    timer = setTimeout(() => {
      active = tick();
    }, policy.pollMs);
    timer.unref();
  }
  async function tick() {
    try {
      for (let index = 0; index < policy.batchSize && !stopped; index += 1) {
        const result = await dispatcher.dispatchNext();
        if (['idle', 'busy', 'lease_lost'].includes(result.status)) break;
        if (result.status === 'failed') logger.error('SOS_OUTBOX_DELIVERY_EXHAUSTED');
      }
    } catch {
      // Database outages must not create an unhandled rejection or expose error contents.
      try { logger.error('SOS_OUTBOX_CYCLE_FAILED'); } catch { /* Fail-soft logger. */ }
    } finally {
      if (!stopped) schedule();
    }
  }
  schedule();
  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await active;
    },
  };
}

module.exports = { startSosOutboxScheduler };
