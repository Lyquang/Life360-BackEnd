/**
 * Application port contract:
 * matchWindow({ points, profile, signal }) resolves to either
 * { matched: false, provider, version } or
 * { matched: true, provider, version, encoding, geometry, confidence? }.
 */
function assertMapMatcher(matcher) {
  if (!matcher || typeof matcher.matchWindow !== 'function') {
    throw new TypeError('Map matcher must implement matchWindow().');
  }
  return matcher;
}

module.exports = { assertMapMatcher };
