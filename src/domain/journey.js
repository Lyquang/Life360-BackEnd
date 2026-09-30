const { haversineDistance } = require('./geo');

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

function toMovingSegment(segPoints) {
  const first = segPoints[0];
  const last = segPoints[segPoints.length - 1];
  const durationMinutes = Math.round((last.timestamp - first.timestamp) / 60000);
  return {
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
}

function buildMovingSegments(points, stayPoints, usedIndices) {
  if (stayPoints.length === 0) {
    return points.length < 2 ? [] : [toMovingSegment(points)];
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

    const segment = toMovingSegment(segPoints);
    if (segment.durationMinutes > 0) movingSegments.push(segment);
  }
  return movingSegments;
}

/** @returns {{ summary: object, journey: Array }} */
function buildDayJourney(points) {
  if (points.length === 0) {
    return {
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
  }

  const { stayPoints, usedIndices } = detectStayPoints(points);
  const movingSegments = buildMovingSegments(points, stayPoints, usedIndices);

  const journey = [
    ...stayPoints.map((sp) => ({ ...sp, _sortTime: new Date(sp.arrivedAt) })),
    ...movingSegments.map((ms) => ({ ...ms, _sortTime: new Date(ms.startTime) })),
  ]
    .sort((a, b) => a._sortTime - b._sortTime)
    .map(({ _sortTime, _startIdx, _endIdx, ...rest }) => rest);

  const totalStayMinutes = stayPoints.reduce((s, sp) => s + sp.durationMinutes, 0);
  const totalMovingMinutes = movingSegments.reduce((s, ms) => s + ms.durationMinutes, 0);

  return {
    summary: {
      totalPoints: points.length,
      stayPointCount: stayPoints.length,
      totalStayMinutes,
      totalStayFormatted: formatJourneyDuration(totalStayMinutes),
      totalMovingMinutes,
      totalMovingFormatted: formatJourneyDuration(totalMovingMinutes),
      firstSeenAt: points[0].timestamp.toISOString(),
      lastSeenAt: points[points.length - 1].timestamp.toISOString(),
    },
    journey,
  };
}

module.exports = { buildDayJourney, detectStayPoints, buildMovingSegments, formatJourneyDuration };
