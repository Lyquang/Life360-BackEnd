const { asyncHandler } = require('../middleware/asyncHandler');

function createRoutingController({ routing }) {
  return {
    preview: asyncHandler(async (req, res) => {
      const data = await routing.preview(req.dto.body);
      res.json({ success: true, data });
    }),
  };
}

module.exports = { createRoutingController };
