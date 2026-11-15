const { z } = require('./common');

const point = z.strictObject({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const routePreviewBody = z.strictObject({
  origin: point,
  destination: point,
  travelMode: z.enum(['motorcycle', 'car', 'walking']),
}).refine(
  ({ origin, destination }) =>
    origin.latitude !== destination.latitude || origin.longitude !== destination.longitude,
  { path: ['destination'], message: 'Destination must differ from origin.' }
);

module.exports = { routePreviewBody };
