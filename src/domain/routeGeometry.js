const { haversineDistance } = require('./geo');

const EARTH_RADIUS_METERS = 6371000;

function recordedAtMs(point) {
  const value = point.recordedAt ?? point.timestamp;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new TypeError('History point requires a valid recordedAt.');
  return timestamp;
}

function pointIdentity(point) {
  if (point.pointId != null) return `point:${point.pointId}`;
  if (point.id != null) return `id:${point.id}`;
  return `fix:${recordedAtMs(point)}:${point.latitude}:${point.longitude}`;
}

function sortAndDedupeHistoryPoints(points) {
  const sorted = points
    .map((point, order) => ({ point, order, timestamp: recordedAtMs(point) }))
    .sort((a, b) => a.timestamp - b.timestamp || a.order - b.order);
  const seen = new Set();
  const result = [];
  for (const { point } of sorted) {
    const identity = pointIdentity(point);
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(point);
  }
  return result;
}

function totalDistanceMeters(points) {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    total += haversineDistance(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude
    );
  }
  return total;
}

function analyzeRouteGaps(points, gapThresholdSeconds) {
  const gaps = [];
  let maxGapSeconds = 0;
  let observedDurationSeconds = 0;

  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const seconds = Math.max(0, (recordedAtMs(current) - recordedAtMs(previous)) / 1000);
    const meters = haversineDistance(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude
    );
    maxGapSeconds = Math.max(maxGapSeconds, seconds);
    if (seconds > gapThresholdSeconds) {
      gaps.push({ fromIndex: index - 1, toIndex: index, seconds, meters });
    } else {
      observedDurationSeconds += seconds;
    }
  }

  return { gaps, maxGapSeconds, observedDurationSeconds };
}

function validRouteGaps(gaps, points) {
  return gaps.filter((gap) => {
    if (!Number.isInteger(gap.fromIndex) || !Number.isInteger(gap.toIndex)) return false;
    if (gap.fromIndex < 0 || gap.fromIndex >= gap.toIndex || gap.toIndex >= points.length) return false;
    if (!Number.isFinite(gap.seconds) || gap.seconds < 0) return false;
    if (!Number.isFinite(gap.meters) || gap.meters < 0) return false;
    try {
      return recordedAtMs(points[gap.fromIndex]) < recordedAtMs(points[gap.toIndex]);
    } catch {
      return false;
    }
  });
}

function buildRouteLinks(points) {
  const links = [];
  for (let index = 1; index < points.length; index++) {
    links.push({ from: points[index - 1], to: points[index] });
  }
  return links;
}

function projectedPoint(point, referenceLatitudeRadians) {
  const toRadians = Math.PI / 180;
  return {
    x: EARTH_RADIUS_METERS * point.longitude * toRadians * Math.cos(referenceLatitudeRadians),
    y: EARTH_RADIUS_METERS * point.latitude * toRadians,
  };
}

function perpendicularDistanceMeters(point, start, end, referenceLatitudeRadians) {
  const p = projectedPoint(point, referenceLatitudeRadians);
  const a = projectedPoint(start, referenceLatitudeRadians);
  const b = projectedPoint(end, referenceLatitudeRadians);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const ratio = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + ratio * dx), p.y - (a.y + ratio * dy));
}

function simplifyRangeIndices(points, startIndex, endIndex, toleranceMeters) {
  if (startIndex === endIndex) return [startIndex];
  const keep = new Set([startIndex, endIndex]);
  const stack = [[startIndex, endIndex]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    if (end - start < 2) continue;
    const referenceLatitude =
      ((points[start].latitude + points[end].latitude) / 2) * (Math.PI / 180);
    let farthestIndex = -1;
    let farthestDistance = -1;
    for (let index = start + 1; index < end; index++) {
      const distance = perpendicularDistanceMeters(
        points[index],
        points[start],
        points[end],
        referenceLatitude
      );
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = index;
      }
    }
    if (farthestDistance > toleranceMeters) {
      keep.add(farthestIndex);
      stack.push([start, farthestIndex], [farthestIndex, end]);
    }
  }

  return [...keep].sort((a, b) => a - b);
}

function routeRanges(points, gapThresholdSeconds) {
  if (points.length === 0) return [];
  const { gaps } = analyzeRouteGaps(points, gapThresholdSeconds);
  const ranges = [];
  let start = 0;
  for (const gap of gaps) {
    ranges.push([start, gap.fromIndex]);
    start = gap.toIndex;
  }
  ranges.push([start, points.length - 1]);
  return ranges;
}

function simplifiedIndices(points, ranges, toleranceMeters) {
  const keep = new Set();
  for (const [start, end] of ranges) {
    for (const index of simplifyRangeIndices(points, start, end, toleranceMeters)) keep.add(index);
  }
  return [...keep].sort((a, b) => a - b);
}

function simplifyRoute(points, { toleranceMeters, gapThresholdSeconds, maxPoints = Infinity }) {
  if (points.length <= 1) {
    return { points: [...points], originalIndices: points.length === 1 ? [0] : [], thinned: false };
  }
  const ranges = routeRanges(points, gapThresholdSeconds);
  let effectiveTolerance = toleranceMeters;
  let indices = simplifiedIndices(points, ranges, effectiveTolerance);

  if (Number.isFinite(maxPoints) && indices.length > maxPoints) {
    let lower = effectiveTolerance;
    let upper = Math.max(1, effectiveTolerance);
    let candidate = indices;
    while (candidate.length > maxPoints && upper < EARTH_RADIUS_METERS * Math.PI) {
      upper *= 2;
      candidate = simplifiedIndices(points, ranges, upper);
    }
    for (let iteration = 0; iteration < 32; iteration++) {
      const middle = (lower + upper) / 2;
      const attempt = simplifiedIndices(points, ranges, middle);
      if (attempt.length > maxPoints) lower = middle;
      else {
        upper = middle;
        candidate = attempt;
      }
    }
    effectiveTolerance = upper;
    indices = candidate;
  }

  return {
    points: indices.map((index) => points[index]),
    originalIndices: indices,
    thinned: indices.length < points.length,
    effectiveToleranceMeters: effectiveTolerance,
  };
}

module.exports = {
  analyzeRouteGaps,
  buildRouteLinks,
  simplifyRoute,
  sortAndDedupeHistoryPoints,
  totalDistanceMeters,
  validRouteGaps,
};
