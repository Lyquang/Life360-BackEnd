/** Metrics must never throw into business code; names and labels are predefined. */
function createNoopMetrics() {
  return Object.freeze({
    enabled: false,
    increment() {},
    observe() {},
    async snapshot() { return { text: '', series: 0 }; },
    close() {},
  });
}

module.exports = { createNoopMetrics };
