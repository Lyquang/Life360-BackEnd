const { createHash } = require('node:crypto');
const { haversineDistance } = require('./geo');

function localDateFor(recordedAt, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(recordedAt);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function liveTrailDedupeKey({ latitude, longitude, recordedAt }) {
  return createHash('sha256')
    .update(`${recordedAt.getTime()}:${String(latitude)}:${String(longitude)}`)
    .digest('base64url');
}

function prepareLiveTrailPoints(points, { timeZone, retentionMs, maxAccuracyMeters }) {
  const grouped = new Map();
  const seenPointIds = new Set();
  const seenDedupeKeys = new Set();

  for (const point of points) {
    if (point.accuracy !== undefined && point.accuracy > maxAccuracyMeters) continue;
    const recordedAt = point.recordedAt instanceof Date
      ? point.recordedAt
      : new Date(point.recordedAt);
    const dedupeKey = liveTrailDedupeKey({ ...point, recordedAt });
    if (
      seenDedupeKeys.has(dedupeKey) ||
      (point.pointId && seenPointIds.has(point.pointId))
    ) continue;
    seenDedupeKeys.add(dedupeKey);
    if (point.pointId) seenPointIds.add(point.pointId);

    const localDate = localDateFor(recordedAt, timeZone);
    const prepared = {
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt,
      dedupeKey,
      expiresAt: new Date(recordedAt.getTime() + retentionMs),
      ...(point.pointId && { pointId: point.pointId }),
      ...(point.accuracy !== undefined && { accuracy: point.accuracy }),
      ...(point.motionState !== undefined && { motionState: point.motionState }),
    };
    if (!grouped.has(localDate)) grouped.set(localDate, []);
    grouped.get(localDate).push(prepared);
  }

  return [...grouped.entries()].map(([localDate, groupedPoints]) => ({
    localDate,
    points: groupedPoints,
  }));
}

function buildLiveTrailGaps(points, { gapThresholdSeconds, stayRadiusMeters }) {
  const chronological = [...points].sort(
    (left, right) =>
      new Date(left.recordedAt) - new Date(right.recordedAt) || left.seq - right.seq
  );
  const gaps = [];
  for (let index = 1; index < chronological.length; index++) {
    const previous = chronological[index - 1];
    const current = chronological[index];
    const seconds = Math.max(
      0,
      (new Date(current.recordedAt) - new Date(previous.recordedAt)) / 1000
    );
    if (seconds <= gapThresholdSeconds) continue;
    const meters = haversineDistance(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude
    );
    if (meters <= stayRadiusMeters) continue;
    gaps.push({ fromSeq: previous.seq, toSeq: current.seq, seconds, meters });
  }
  return gaps;
}

module.exports = {
  buildLiveTrailGaps,
  liveTrailDedupeKey,
  localDateFor,
  prepareLiveTrailPoints,
};
