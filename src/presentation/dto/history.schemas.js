const { z, objectId } = require('./common');
const { isValidCalendarDate } = require('../../domain/dates');

const userIdParams = z.object({ userId: objectId });
const isoDateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const historyQuery = z
  .object({
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
    if ((value.limit !== undefined || value.cursor !== undefined) && !value.from && !value.to) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'from or to is required when using limit or cursor.',
      });
    }
  });

const journeyQuery = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD.')
      .refine(isValidCalendarDate, 'Invalid calendar date.')
      .optional(),
    detail: z.enum(['geometry']).optional(),
    includePath: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  })
  .superRefine((value, context) => {
    if (value.includePath !== undefined && value.detail !== 'geometry') {
      context.addIssue({
        code: 'custom',
        path: ['includePath'],
        message: 'includePath is only supported when detail=geometry.',
      });
    }
  });

module.exports = { userIdParams, historyQuery, journeyQuery };
