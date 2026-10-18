function createNoopMapMatcher() {
  return {
    provider: 'none',
    version: 'noop-v1',
    async matchWindow() {
      return { matched: false, provider: 'none', version: 'noop-v1' };
    },
  };
}

module.exports = { createNoopMapMatcher };
