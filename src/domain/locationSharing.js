const MAX_LOCATION_SHARING_PAUSE_MS = 7 * 24 * 60 * 60 * 1000;

function isLocationSharingEnabled(locationSharing, at = new Date()) {
  if (!locationSharing || locationSharing.enabled !== false) return true;
  if (!locationSharing.pausedUntil) return false;
  return new Date(locationSharing.pausedUntil).getTime() <= new Date(at).getTime();
}

function publicLocationSharing(locationSharing, at = new Date()) {
  const enabled = isLocationSharingEnabled(locationSharing, at);
  return {
    enabled,
    pausedUntil: enabled ? null : locationSharing?.pausedUntil || null,
    updatedAt: locationSharing?.updatedAt || null,
  };
}

function locationSharingUpdate({ enabled, pausedUntil }, now = new Date()) {
  if (enabled) return { enabled: true, pausedUntil: null, updatedAt: now };
  if (pausedUntil) {
    const until = new Date(pausedUntil);
    if (until <= now) throw new Error('pausedUntil must be in the future.');
    if (until.getTime() - now.getTime() > MAX_LOCATION_SHARING_PAUSE_MS) {
      throw new Error('pausedUntil cannot be more than 7 days in the future.');
    }
    return { enabled: false, pausedUntil: until, updatedAt: now };
  }
  return { enabled: false, pausedUntil: null, updatedAt: now };
}

module.exports = {
  MAX_LOCATION_SHARING_PAUSE_MS,
  isLocationSharingEnabled,
  publicLocationSharing,
  locationSharingUpdate,
};
