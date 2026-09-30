const { z, objectId } = require('./common');
const { isValidCalendarDate } = require('../../domain/dates');

const userIdParams = z.object({ userId: objectId });

const journeyQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD.')
    .refine(isValidCalendarDate, 'Invalid calendar date.')
    .optional(),
});

module.exports = { userIdParams, journeyQuery };
