const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeRouteGaps,
  buildRouteLinks,
  simplifyRoute,
  sortAndDedupeHistoryPoints,
  totalDistanceMeters,
  validRouteGaps,
} = require('../src/domain/routeGeometry');

const BASE_TIME = Date.UTC(2026, 0, 1);

function point(id, eastMeters, northMeters, seconds) {
  const metersPerDegree = (Math.PI * 6371000) / 180;
  return {
    id,
    latitude: northMeters / metersPerDegree,
    longitude: eastMeters / metersPerDegree,
    recordedAt: new Date(BASE_TIME + seconds * 1000),
  };
}

describe('route geometry domain', () => {
  it('sorts by recordedAt without mutating input and removes duplicate identities', () => {
    const later = point('later', 20, 0, 20);
    const first = point('first', 0, 0, 0);
    const duplicate = { ...later };
    const input = [later, first, duplicate];

    assert.deepEqual(sortAndDedupeHistoryPoints(input).map((entry) => entry.id), ['first', 'later']);
    assert.deepEqual(input.map((entry) => entry.id), ['later', 'first', 'later']);
  });

  it('calculates Haversine distance over every raw link', () => {
    const points = [point('a', 0, 0, 0), point('b', 100, 0, 10), point('c', 200, 0, 20)];
    assert.ok(Math.abs(totalDistanceMeters(points) - 200) < 0.5);
  });

  it('reports temporal gaps and excludes them from observed duration', () => {
    const points = [point('a', 0, 0, 0), point('b', 20, 0, 30), point('c', 40, 0, 240)];
    const result = analyzeRouteGaps(points, 180);

    assert.equal(result.gaps.length, 1);
    assert.deepEqual(
      { fromIndex: result.gaps[0].fromIndex, toIndex: result.gaps[0].toIndex, seconds: result.gaps[0].seconds },
      { fromIndex: 1, toIndex: 2, seconds: 210 }
    );
    assert.equal(result.maxGapSeconds, 210);
    assert.equal(result.observedDurationSeconds, 30);
  });

  it('keeps only endpoints for a straight line', () => {
    const points = Array.from({ length: 6 }, (_, index) => point(String(index), index * 20, 0, index * 10));
    const result = simplifyRoute(points, { toleranceMeters: 1, gapThresholdSeconds: 180 });
    assert.deepEqual(result.originalIndices, [0, 5]);
    assert.equal(result.thinned, true);
  });

  it('keeps a meaningful corner on a curved route', () => {
    const points = [
      point('a', 0, 0, 0),
      point('b', 50, 0, 10),
      point('corner', 50, 50, 20),
      point('d', 100, 50, 30),
    ];
    const result = simplifyRoute(points, { toleranceMeters: 5, gapThresholdSeconds: 180 });
    assert.ok(result.points.some((entry) => entry.id === 'corner'));
    assert.equal(result.points[0].id, 'a');
    assert.equal(result.points.at(-1).id, 'd');
  });

  it('never simplifies across a gap and retains both gap boundaries', () => {
    const points = [
      point('a', 0, 0, 0),
      point('before-gap', 20, 0, 10),
      point('after-gap', 40, 0, 400),
      point('d', 60, 0, 410),
    ];
    const result = simplifyRoute(points, { toleranceMeters: 1000, gapThresholdSeconds: 180 });
    assert.deepEqual(result.points.map((entry) => entry.id), ['a', 'before-gap', 'after-gap', 'd']);
  });

  it('uses an adaptive tolerance to respect a point cap when possible', () => {
    const points = Array.from({ length: 101 }, (_, index) =>
      point(String(index), index * 5, index % 2 === 0 ? 0 : 10, index)
    );
    const result = simplifyRoute(points, {
      toleranceMeters: 0.1,
      gapThresholdSeconds: 180,
      maxPoints: 10,
    });
    assert.ok(result.points.length <= 10);
    assert.equal(result.points[0].id, '0');
    assert.equal(result.points.at(-1).id, '100');
  });

  it('links A to C and C to D without inventing a missing B', () => {
    const points = [point('A', 0, 0, 0), point('C', 20, 10, 10), point('D', 40, 0, 20)];
    const links = buildRouteLinks(points);
    assert.deepEqual(links.map(({ from, to }) => `${from.id}-${to.id}`), ['A-C', 'C-D']);
  });

  it('handles empty and single-point routes', () => {
    assert.deepEqual(simplifyRoute([], { toleranceMeters: 8, gapThresholdSeconds: 180 }).points, []);
    const only = point('only', 0, 0, 0);
    assert.deepEqual(
      simplifyRoute([only], { toleranceMeters: 8, gapThresholdSeconds: 180 }).points,
      [only]
    );
    assert.equal(totalDistanceMeters([only]), 0);
    assert.deepEqual(buildRouteLinks([only]), []);
  });

  it('drops malformed gap indices and keeps valid boundaries', () => {
    const points = [point('a', 0, 0, 0), point('b', 20, 0, 20)];
    const valid = { fromIndex: 0, toIndex: 1, seconds: 20, meters: 20 };
    assert.deepEqual(
      validRouteGaps([
        valid,
        { ...valid, fromIndex: -1 },
        { ...valid, fromIndex: 1, toIndex: 1 },
        { ...valid, toIndex: 2 },
        { ...valid, seconds: Number.NaN },
      ], points),
      [valid]
    );
  });
});
