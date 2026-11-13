const { z, objectId } = require('./common');
const { PLACE_LABELS } = require('../../domain/placeLabels');

const PLACE_CATEGORIES = ['restaurant', 'entertainment', 'cafe', 'shopping', 'other'];

const groupIdParams = z.object({ groupId: objectId });
const groupMemberParams = z.object({ groupId: objectId, userId: objectId });

const createGroupBody = z.object({
  name: z.string().trim().min(2).max(50),
});

const joinGroupBody = z.object({
  inviteCode: z.string().trim().regex(/^\d{6}$/, 'inviteCode must be 6 digits.'),
});

const notificationIntervalBody = z.object({
  intervalMinutes: z.number().int().min(0).max(1440),
});

const digestListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.coerce.date({ error: 'Invalid date. Use ISO 8601.' }).optional(),
  to: z.coerce.date({ error: 'Invalid date. Use ISO 8601.' }).optional(),
});

const addPlaceBody = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(PLACE_CATEGORIES),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const placeIdParams = groupIdParams.extend({ placeId: objectId });
const placeLabelParams = groupIdParams.extend({ label: z.enum(PLACE_LABELS) });
const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1);
const updatePlaceBody = z.object({
  revision,
  name: z.string().trim().min(1).max(100).optional(),
  category: z.enum(PLACE_CATEGORIES).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
}).strict().superRefine((body, ctx) => {
  if ((body.latitude === undefined) !== (body.longitude === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'latitude and longitude must be supplied together.' });
  }
  if (['name', 'category', 'latitude', 'longitude'].every((key) => body[key] === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['name'], message: 'At least one place field must be updated.' });
  }
});
const deletePlaceQuery = z.object({ revision: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1) }).strict();
const setPlaceLabelBody = z.object({
  placeId: objectId,
  customLabel: z.string().trim().min(1).max(50).optional(),
}).strict();
const placePresenceQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: objectId.optional(),
}).strict();

module.exports = {
  groupIdParams,
  groupMemberParams,
  createGroupBody,
  joinGroupBody,
  notificationIntervalBody,
  digestListQuery,
  addPlaceBody,
  placeIdParams,
  placeLabelParams,
  updatePlaceBody,
  deletePlaceQuery,
  setPlaceLabelBody,
  placePresenceQuery,
};
