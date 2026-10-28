/** Metrics must never throw into business code; names and labels are predefined. */
function createNoopMetrics() {
  return Object.freeze({
    enabled: false,
    increment() {},
    observe() {},
    set() {},
    addCollector() {},
    async snapshot() { return { text: '', series: 0 }; },
    close() {},
  });
}

function createSafeMetrics(metrics) {
  const call = (method, args) => {
    try { if (metrics?.enabled === true) metrics[method](...args); } catch { /* Observability cannot interrupt business work. */ }
  };
  return {
    increment: (...args) => call('increment', args),
    observe: (...args) => call('observe', args),
    set: (...args) => call('set', args),
    addCollector: (...args) => call('addCollector', args),
  };
}

module.exports = { createNoopMetrics, createSafeMetrics };
