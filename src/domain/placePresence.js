const { haversineDistance } = require('./geo');

const PLACE_PRESENCE_POLICY = Object.freeze({
  radiusMeters: 100, exitRadiusMeters: 150, maxAccuracyMeters: 50,
  dwellMs: 120000, maxGapMs: 90000, maxAgeMs: 300000, maxFutureMs: 5000,
});
const time = (value) => value ? new Date(value).getTime() : 0;

function samePresenceContext(state, label, context) {
  return state && String(state.labelId) === String(label.id)
    && String(state.placeId) === String(label.placeId)
    && state.placeRevision === label.placeRevision
    && time(state.labelUpdatedAt) === time(label.updatedAt)
    && time(state.privacyUpdatedAt) === time(context.privacyUpdatedAt)
    && state.privacyVersion === context.privacyVersion
    && state.membershipVersion === context.membershipVersion;
}

function advancePlacePresence({ previous, point, labels, context, now, policy = PLACE_PRESENCE_POLICY }) {
  if (!point.recordedAt) return null;
  const at = new Date(point.recordedAt).getTime();
  const clock = new Date(now).getTime();
  if (!Number.isFinite(at) || at > clock + policy.maxFutureMs || clock - at > policy.maxAgeMs) return null;
  if (at < Math.max(time(context.privacyUpdatedAt), time(context.membershipUpdatedAt))) return null;
  if (previous && at <= time(previous.sourceFixAt)) return null;
  const empty = {
    sourceFixAt: new Date(at), expiresAt: new Date(at + policy.maxAgeMs),
    privacyUpdatedAt: context.privacyUpdatedAt || null, privacyVersion: context.privacyVersion,
    membershipVersion: context.membershipVersion,
    placeId: null, placeRevision: null, labelId: null, labelUpdatedAt: null,
    candidateSince: null, confirmed: false,
  };
  if (!Number.isFinite(point.accuracy) || point.accuracy > policy.maxAccuracyMeters || point.accuracy < 0
    || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90
    || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) return empty;

  const eligible = labels.filter((label) => time(label.updatedAt) <= at && time(label.placeUpdatedAt) <= at);
  const distance = (label) => haversineDistance(point.latitude, point.longitude, label.latitude, label.longitude);
  const matches = eligible.filter((label) => distance(label) + point.accuracy <= policy.radiusMeters);
  if (matches.length > 1) return empty;
  let chosen = matches[0];
  if (!chosen && previous?.confirmed) {
    const last = eligible.find((label) => String(label.id) === String(previous.labelId));
    if (last && samePresenceContext(previous, last, context)
      && distance(last) + point.accuracy <= policy.exitRadiusMeters) chosen = last;
  }
  if (!chosen) return empty;
  const continuous = samePresenceContext(previous, chosen, context)
    && at - time(previous.sourceFixAt) <= policy.maxGapMs;
  const since = continuous ? new Date(previous.candidateSince) : new Date(at);
  return { ...empty, placeId: chosen.placeId, placeRevision: chosen.placeRevision,
    labelId: chosen.id, labelUpdatedAt: chosen.updatedAt, candidateSince: since,
    confirmed: Boolean(continuous && (previous.confirmed || at - since.getTime() >= policy.dwellMs)),
  };
}

module.exports = { PLACE_PRESENCE_POLICY, advancePlacePresence, samePresenceContext };
