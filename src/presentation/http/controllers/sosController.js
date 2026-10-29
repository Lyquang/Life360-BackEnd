const { asyncHandler } = require('../middleware/asyncHandler');

function createSosController({ sos }) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await sos.list({ ...req.dto.query, userId: req.user._id });
      res.json({ success: true, data });
    }),
    create: asyncHandler(async (req, res) => {
      const data = await sos.create({ ...req.dto.body, userId: req.user._id });
      res.status(data.created ? 201 : 200).json({ success: true, data });
    }),
    get: asyncHandler(async (req, res) => {
      const data = await sos.get({ ...req.dto.query, userId: req.user._id, sosId: req.dto.params.id });
      res.json({ success: true, data });
    }),
    respond: asyncHandler(async (req, res) => {
      const data = await sos.respond({ userId: req.user._id, sosId: req.dto.params.id });
      res.status(data.created ? 201 : 200).json({ success: true, data });
    }),
    close: asyncHandler(async (req, res) => {
      const data = await sos.close({ userId: req.user._id, sosId: req.dto.params.id, status: req.dto.body.status });
      res.json({ success: true, data });
    }),
  };
}

module.exports = { createSosController };
