const { z, objectId } = require('./common');

const PLACE_CATEGORIES = ['restaurant', 'entertainment', 'cafe', 'shopping', 'other'];

const groupIdParams = z.object({ groupId: objectId });

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

module.exports = {
  groupIdParams,
  createGroupBody,
  joinGroupBody,
  notificationIntervalBody,
  digestListQuery,
  addPlaceBody,
};
