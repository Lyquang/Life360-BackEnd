const { asyncHandler } = require('../middleware/asyncHandler');

function createLocationController({ location }) {
  return {
    syncBatch: asyncHandler(async (req, res) => {
      const data = await location.syncBatch({
        userId: req.user._id,
        userName: req.user.name,
        fallbackBatteryLevel: req.user.batteryLevel,
        points: req.dto.body.points,
        rejected: req.dto.body.rejected,
      });
      res.json({ success: true, data });
    }),
  };
}

module.exports = { createLocationController };
