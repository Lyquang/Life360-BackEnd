const { asyncHandler } = require('../middleware/asyncHandler');

function createAuthController({ auth }) {
  return {
    register: asyncHandler(async (req, res) => {
      const data = await auth.register(req.dto.body);
      res.status(201).json({ success: true, message: 'User registered successfully.', data });
    }),

    login: asyncHandler(async (req, res) => {
      const data = await auth.login(req.dto.body);
      res.json({ success: true, message: 'Login successful.', data });
    }),

    me: asyncHandler(async (req, res) => {
      res.json({ success: true, data: await auth.getProfile(req.user._id) });
    }),
  };
}

module.exports = { createAuthController };
