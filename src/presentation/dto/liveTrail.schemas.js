const { z } = require('zod');

const liveTrailWatchPayload = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'userId must be a MongoDB ObjectId.'),
  date: z.iso.date().optional(),
});

module.exports = { liveTrailWatchPayload };
