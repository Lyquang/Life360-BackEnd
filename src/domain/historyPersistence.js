const { haversineDistance } = require('./geo');

const DEFAULT_HISTORY_PERSISTENCE_CONFIG = Object.freeze({
  minIntervalMovingSeconds: 15,
  minDistanceMovingMeters: 25,
  maxIdleIntervalSeconds: 5 * 60,
});

function timestampMs(point) {
  const value = point.recordedAt ?? point.timestamp;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function isValidPoint(point) {
  const timestamp = timestampMs(point);
  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function decision(persist, reason, details = {}) {
  return { persist, reason, ...details };
}

function shouldPersistHistoryPoint(previousLatest, candidate, config = DEFAULT_HISTORY_PERSISTENCE_CONFIG) {
  if (!isValidPoint(candidate)) return decision(false, 'invalid');
  if (!previousLatest) return decision(true, 'first');
  if (!isValidPoint(previousLatest)) return decision(true, 'first');

  const previousTimestamp = timestampMs(previousLatest);
  const candidateTimestamp = timestampMs(candidate);
  const sameFix =
    previousTimestamp === candidateTimestamp &&
    previousLatest.latitude === candidate.latitude &&
    previousLatest.longitude === candidate.longitude;
  if (sameFix) return decision(false, 'duplicate');
  if (candidateTimestamp <= previousTimestamp) return decision(true, 'lateArrival');

  const elapsedSeconds = (candidateTimestamp - previousTimestamp) / 1000;
  const distanceMeters = haversineDistance(
    previousLatest.latitude,
    previousLatest.longitude,
    candidate.latitude,
    candidate.longitude
  );
  if (
    previousLatest.motionState != null &&
    candidate.motionState != null &&
    previousLatest.motionState !== candidate.motionState
  ) {
    return decision(true, 'motionChanged', { elapsedSeconds, distanceMeters });
  }
  if (
    elapsedSeconds >= config.minIntervalMovingSeconds &&
    distanceMeters >= config.minDistanceMovingMeters
  ) {
    return decision(true, 'movingThreshold', { elapsedSeconds, distanceMeters });
  }
  if (elapsedSeconds >= config.maxIdleIntervalSeconds) {
    return decision(true, 'idleHeartbeat', { elapsedSeconds, distanceMeters });
  }
  return decision(false, distanceMeters < config.minDistanceMovingMeters ? 'stationaryNoise' : 'tooSoon', {
    elapsedSeconds,
    distanceMeters,
  });
}

module.exports = { DEFAULT_HISTORY_PERSISTENCE_CONFIG, shouldPersistHistoryPoint };
