function createLocationRuntimeState() {
  const lastSavedLocation = new Map();
  const durationTracker = new Map();

  function clearUser(userId) {
    const key = String(userId);
    lastSavedLocation.delete(key);
    durationTracker.delete(key);
  }

  return { lastSavedLocation, durationTracker, clearUser };
}

module.exports = { createLocationRuntimeState };
