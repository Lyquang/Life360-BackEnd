const { createHash } = require('node:crypto');
const { haversineDistance } = require('./geo');

function chronological(points) {
  return [...points].sort(
    (left, right) =>
      new Date(left.recordedAt) - new Date(right.recordedAt) || left.seq - right.seq
  );
}

function isRouteGap(previous, current, policy) {
  const seconds = (new Date(current.recordedAt) - new Date(previous.recordedAt)) / 1000;
  if (seconds <= policy.gapThresholdSeconds) return false;
  return haversineDistance(
    previous.latitude,
    previous.longitude,
    current.latitude,
    current.longitude
  ) > policy.stayRadiusMeters;
}

function isEligible(point, policy) {
  return point.accuracy === undefined || point.accuracy <= policy.maxAccuracyMeters;
}

function buildMatchWindows(points, policy) {
  const runs = [];
  let run = [];
  for (const point of chronological(points)) {
    if (!isEligible(point, policy)) {
      if (run.length) runs.push(run);
      run = [];
      continue;
    }
    if (run.length && isRouteGap(run.at(-1), point, policy)) {
      runs.push(run);
      run = [];
    }
    run.push(point);
  }
  if (run.length) runs.push(run);

  const windows = [];
  const step = Math.max(1, policy.windowSize - policy.overlapPoints);
  for (const observed of runs) {
    for (let start = 0; start < observed.length; start += step) {
      const window = observed.slice(start, start + policy.windowSize);
      if (window.length < policy.minPoints) break;
      const end = start + window.length;
      windows.push({
        points: window,
        fromSeq: window[0].seq,
        toSeq: window.at(-1).seq,
        lifecycle: end <= observed.length - policy.futureContextPoints ? 'final' : 'provisional',
      });
      if (end === observed.length) break;
    }
  }
  return windows;
}

function sourceRevision({ trailId, revision, window, matcher, profile = 'auto', policy }) {
  const canonical = {
    trailId: String(trailId),
    revision,
    matcher,
    profile,
    policy: policy ? {
      windowSize: policy.windowSize,
      overlapPoints: policy.overlapPoints,
      futureContextPoints: policy.futureContextPoints,
      minPoints: policy.minPoints,
      maxAccuracyMeters: policy.maxAccuracyMeters,
      gapThresholdSeconds: policy.gapThresholdSeconds,
      stayRadiusMeters: policy.stayRadiusMeters,
    } : null,
    points: window.points.map((point) => ({
      seq: point.seq,
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt: new Date(point.recordedAt).toISOString(),
      accuracy: point.accuracy ?? null,
      motionState: point.motionState ?? null,
    })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('base64url');
}

function segmentIdFor(trailId, revision, fromSeq) {
  return createHash('sha256')
    .update(`${trailId}:${revision}:${fromSeq}`)
    .digest('base64url')
    .slice(0, 24);
}

module.exports = { buildMatchWindows, segmentIdFor, sourceRevision };
