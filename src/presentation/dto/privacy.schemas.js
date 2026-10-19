const { z } = require('./common');

const locationSharingBody = z
  .object({
    enabled: z.boolean(),
    pausedUntil: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && value.pausedUntil) {
      ctx.addIssue({
        code: 'custom',
        path: ['pausedUntil'],
        message: 'pausedUntil must be null or omitted when enabled is true.',
      });
    }
  });

module.exports = { locationSharingBody };
