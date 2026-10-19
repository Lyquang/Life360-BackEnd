const { asyncHandler } = require('../middleware/asyncHandler');

function createPrivacyController({ privacy }) {
  return {
    getLocationSharing: asyncHandler(async (req, res) => {
      const data = await privacy.getLocationSharing(req.user._id);
      res.json({ success: true, data });
    }),

    setLocationSharing: asyncHandler(async (req, res) => {
      const data = await privacy.setLocationSharing({ userId: req.user._id, ...req.dto.body });
      res.json({ success: true, message: 'Location sharing preference updated.', data });
    }),
  };
}

module.exports = { createPrivacyController };
