const { z, formatIssues } = require('./common');
const { AppError, Errors } = require('../../domain/errors');

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const batteryLevel = z.number().transform((value) => Math.min(100, Math.max(0, value)));

const locationBatchPoint = z.object({
  pointId: z.uuid().transform((value) => value.toLowerCase()),
  latitude,
  longitude,
  recordedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  accuracy: z.number().min(0).optional(),
  batteryLevel: batteryLevel.optional(),
});

const ERROR_CODES = {
  pointId: 'INVALID_POINT_ID',
  latitude: 'INVALID_LATITUDE',
  longitude: 'INVALID_LONGITUDE',
  recordedAt: 'INVALID_RECORDED_AT',
  accuracy: 'INVALID_ACCURACY',
  batteryLevel: 'INVALID_BATTERY_LEVEL',
};

function createParseLocationBatch(maxPoints) {
  return (req, res, next) => {
    const envelope = z.object({ points: z.array(z.unknown()).min(1) }).safeParse(req.body ?? {});
    if (!envelope.success) return next(Errors.validation(formatIssues(envelope.error, 'body')));
    if (envelope.data.points.length > maxPoints) {
      return next(new AppError(400, 'BATCH_LIMIT_EXCEEDED', `A batch may contain at most ${maxPoints} points.`));
    }

    const points = [];
    const rejected = [];
    envelope.data.points.forEach((rawPoint, index) => {
      const parsed = locationBatchPoint.safeParse(rawPoint);
      if (parsed.success) {
        points.push({ ...parsed.data, index });
        return;
      }

      const firstIssue = parsed.error.issues[0];
      const field = firstIssue.path[0];
      rejected.push({
        index,
        pointId: typeof rawPoint?.pointId === 'string' ? rawPoint.pointId : null,
        code: ERROR_CODES[field] || 'INVALID_POINT',
        reason: firstIssue.message,
      });
    });

    req.dto = { body: { points, rejected } };
    next();
  };
}

module.exports = { locationBatchPoint, createParseLocationBatch };
