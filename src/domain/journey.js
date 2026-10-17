const { haversineDistance } = require('./geo');
const { createHash } = require('node:crypto');
const {
  analyzeRouteGaps,
  simplifyRoute,
  sortAndDedupeHistoryPoints,
  totalDistanceMeters,
} = require('./routeGeometry');

const STAY_RADIUS_METERS = 80;
const STAY_MIN_DURATION_MS = 5 * 60 * 1000;

function formatJourneyDuration(minutes) {
  if (minutes < 1) return 'Dưới 1 phút';
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} ngày ${remHours} giờ` : `${days} ngày`;
}

/**
 * Sliding-window stay point detection: a stay is a run of points within
 * STAY_RADIUS_METERS of its first point lasting at least STAY_MIN_DURATION_MS.
 * @param {Array<{latitude:number, longitude:number, timestamp:Date}>} points sorted by time
 */
function detectStayPoints(points) {
  const stayPoints = [];
  const usedIndices = new Set();
  const n = points.length;

  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n) {
      const dist = haversineDistance(
        points[i].latitude, points[i].longitude,
        points[j].latitude, points[j].longitude
      );
      if (dist > STAY_RADIUS_METERS) break;
      j++;
    }

    const windowPoints = points.slice(i, j);
    const windowDuration = points[j - 1].timestamp - points[i].timestamp;

    if (windowDuration >= STAY_MIN_DURATION_MS && windowPoints.length >= 2) {
      const avgLat = windowPoints.reduce((s, p) => s + p.latitude, 0) / windowPoints.length;
      const avgLng = windowPoints.reduce((s, p) => s + p.longitude, 0) / windowPoints.length;
      const durationMinutes = Math.round(windowDuration / 60000);

      stayPoints.push({
        type: 'stay',
        latitude: avgLat,
        longitude: avgLng,
        arrivedAt: points[i].timestamp.toISOString(),
        leftAt: points[j - 1].timestamp.toISOString(),
        durationMinutes,
        durationFormatted: formatJourneyDuration(durationMinutes),
        pointCount: windowPoints.length,
        _startIdx: i,
        _endIdx: j - 1,
      });

      for (let k = i; k < j; k++) usedIndices.add(k);
      i = j;
    } else {
      i++;
    }
  }

  return { stayPoints, usedIndices };
}

function stableSegmentId(first) {
  const identity = first.id || `${first.timestamp.toISOString()}:${first.latitude}:${first.longitude}`;
  return `v1_${createHash('sha256').update(String(identity)).digest('base64url').slice(0, 22)}`;
}

function enrichedGeometry(segPoints, options) {
  const gapThresholdSeconds = options.gapThresholdSeconds ?? 180;
  const rawGaps = analyzeRouteGaps(segPoints, gapThresholdSeconds);
  const simplified = simplifyRoute(segPoints, {
    toleranceMeters: options.simplifyToleranceMeters ?? 8,
    gapThresholdSeconds,
    maxPoints: options.maxPointsPerSegment ?? 1000,
  });
  const returnedIndexByRawIndex = new Map(
    simplified.originalIndices.map((rawIndex, returnedIndex) => [rawIndex, returnedIndex])
  );
  const gaps = rawGaps.gaps.map((gap) => ({
    fromIndex: returnedIndexByRawIndex.get(gap.fromIndex),
    toIndex: returnedIndexByRawIndex.get(gap.toIndex),
    seconds: gap.seconds,
    meters: gap.meters,
  }));

  return {
    segmentId: stableSegmentId(segPoints[0]),
    path: simplified.points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    points: simplified.points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt: point.timestamp.toISOString(),
      ...(point.accuracy !== undefined && { accuracy: point.accuracy }),
    })),
    pointCount: simplified.points.length,
    originalPointCount: segPoints.length,
    distanceMeters: totalDistanceMeters(segPoints),
    maxGapSeconds: rawGaps.maxGapSeconds,
    gaps,
    thinned: simplified.thinned,
    observedMovingSeconds: rawGaps.observedDurationSeconds,
  };
}

function toMovingSegment(segPoints, options = {}) {
  const first = segPoints[0];
  const last = segPoints[segPoints.length - 1];
  const durationMinutes = Math.round((last.timestamp - first.timestamp) / 60000);
  const segment = {
    type: 'moving',
    fromLatitude: first.latitude,
    fromLongitude: first.longitude,
    toLatitude: last.latitude,
    toLongitude: last.longitude,
    startTime: first.timestamp.toISOString(),
    endTime: last.timestamp.toISOString(),
    durationMinutes,
    durationFormatted: formatJourneyDuration(durationMinutes),
    path: segPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
  };
  if (options.geometry) Object.assign(segment, enrichedGeometry(segPoints, options));
  return segment;
}

function buildMovingSegments(points, stayPoints, usedIndices, options = {}) {
  if (stayPoints.length === 0) {
    return points.length < 2 ? [] : [toMovingSegment(points, options)];
  }

  const boundaries = [
    { startIdx: 0, endIdx: stayPoints[0]._startIdx },
    ...stayPoints.slice(0, -1).map((sp, i) => ({
      startIdx: sp._endIdx + 1,
      endIdx: stayPoints[i + 1]._startIdx,
    })),
    { startIdx: stayPoints[stayPoints.length - 1]._endIdx + 1, endIdx: points.length - 1 },
  ];

  const movingSegments = [];
  for (const { startIdx, endIdx } of boundaries) {
    const segPoints = [];
    for (let k = startIdx; k <= endIdx && k < points.length; k++) {
      if (!usedIndices.has(k)) segPoints.push(points[k]);
    }
    if (segPoints.length < 2) continue;

    const segment = toMovingSegment(segPoints, options);
    if (segment.durationMinutes > 0) movingSegments.push(segment);
  }
  return movingSegments;
}

/** @returns {{ summary: object, journey: Array }} */
function buildDayJourney(points, options = {}) {
  const preparedPoints = options.geometry ? sortAndDedupeHistoryPoints(points) : points;
  if (preparedPoints.length === 0) {
    const empty = {
      summary: {
        totalPoints: 0,
        stayPointCount: 0,
        totalStayMinutes: 0,
        totalMovingMinutes: 0,
        firstSeenAt: null,
        lastSeenAt: null,
      },
      journey: [],
    };
    if (options.geometry) empty.summary.observedMovingSeconds = 0;
    return empty;
  }

  const { stayPoints, usedIndices } = detectStayPoints(preparedPoints);
  const movingSegments = buildMovingSegments(preparedPoints, stayPoints, usedIndices, options);

  const journey = [
    ...stayPoints.map((sp) => ({ ...sp, _sortTime: new Date(sp.arrivedAt) })),
    ...movingSegments.map((ms) => ({ ...ms, _sortTime: new Date(ms.startTime) })),
  ]
    .sort((a, b) => a._sortTime - b._sortTime)
    .map(({ _sortTime, _startIdx, _endIdx, ...rest }) => rest);

  const totalStayMinutes = stayPoints.reduce((s, sp) => s + sp.durationMinutes, 0);
  const totalMovingMinutes = movingSegments.reduce((s, ms) => s + ms.durationMinutes, 0);

  const result = {
    summary: {
      totalPoints: preparedPoints.length,
      stayPointCount: stayPoints.length,
      totalStayMinutes,
      totalStayFormatted: formatJourneyDuration(totalStayMinutes),
      totalMovingMinutes,
      totalMovingFormatted: formatJourneyDuration(totalMovingMinutes),
      firstSeenAt: preparedPoints[0].timestamp.toISOString(),
      lastSeenAt: preparedPoints[preparedPoints.length - 1].timestamp.toISOString(),
    },
    journey,
  };
  if (options.geometry) {
    result.summary.observedMovingSeconds = movingSegments.reduce(
      (sum, segment) => sum + segment.observedMovingSeconds,
      0
    );
  }
  return result;
}

module.exports = { buildDayJourney, detectStayPoints, buildMovingSegments, formatJourneyDuration };
