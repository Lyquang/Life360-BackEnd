const { asyncHandler } = require('../middleware/asyncHandler');

function createHistoryController({ history }) {
  return {
    today: asyncHandler(async (req, res) => {
      const { date, points } = await history.getTodayHistory({
        requesterId: req.user._id,
        userId: req.dto.params.userId,
      });
      res.json({ success: true, count: points.length, date, data: points });
    }),

    journey: asyncHandler(async (req, res) => {
      const result = await history.getDayJourney({
        requesterId: req.user._id,
        userId: req.dto.params.userId,
        date: req.dto.query.date,
      });
      res.json({ success: true, ...result });
    }),
  };
}

module.exports = { createHistoryController };
