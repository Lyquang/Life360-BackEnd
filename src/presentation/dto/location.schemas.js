const { z } = require('./common');

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const recordedAt = z.iso.datetime({ offset: true });
const accuracy = z.number().min(0);
const motionState = z.enum(['stationary', 'walking', 'running', 'cycling', 'automotive', 'unknown']);
// Devices may report out-of-range values (e.g. -1 when unknown): clamp instead of rejecting the update.
const batteryLevel = z.number().transform((v) => Math.min(100, Math.max(0, v)));

const updateLocationPayload = z.object({
  latitude,
  longitude,
  batteryLevel: batteryLevel.optional(),
  recordedAt: recordedAt.optional(),
  accuracy: accuracy.optional(),
  pointId: z.uuid().transform((value) => value.toLowerCase()).optional(),
  motionState: motionState.optional(),
});

const sosPayload = z
  .object({
    message: z.string().trim().max(500).optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    batteryLevel: batteryLevel.optional(),
  })
  .nullish()
  .transform((v) => v ?? {});

module.exports = { updateLocationPayload, sosPayload };
