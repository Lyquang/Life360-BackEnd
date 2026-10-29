const { z, objectId } = require('./common');

const createSosBody = z.object({
  clientRequestId: z.uuid().transform((value) => value.toLowerCase()),
  message: z.string().trim().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  recordedAt: z.iso.datetime({ offset: true }).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude and longitude must be provided together.' });
  }
  if (value.recordedAt !== undefined && value.latitude === undefined) {
    ctx.addIssue({ code: 'custom', path: ['recordedAt'], message: 'Recorded time requires coordinates.' });
  }
});
const sosParams = z.object({ id: objectId });
const sosQuery = z.object({ afterId: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
const respondSosBody = z.object({ status: z.literal('coming') }).strict();
const closeSosBody = z.object({ status: z.enum(['resolved', 'cancelled']) }).strict();

module.exports = { createSosBody, sosParams, sosQuery, respondSosBody, closeSosBody };
