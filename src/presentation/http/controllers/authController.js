const { asyncHandler } = require('../middleware/asyncHandler');

function createAuthController({ auth }) {
  const requestContext = (req) => ({ userAgent: req.get('user-agent') || null, ip: req.ip || null });

  return {
    register: asyncHandler(async (req, res) => {
      const data = await auth.register(req.dto.body, requestContext(req));
      res.status(201).json({ success: true, message: 'User registered successfully.', data });
    }),

    login: asyncHandler(async (req, res) => {
      const data = await auth.login(req.dto.body, requestContext(req));
      res.json({ success: true, message: 'Login successful.', data });
    }),

    socialLogin: asyncHandler(async (req, res) => {
      const data = await auth.socialLogin(req.dto.body, requestContext(req));
      res.json({ success: true, message: 'Social login successful.', data });
    }),

    refresh: asyncHandler(async (req, res) => {
      const data = await auth.refresh(req.dto.body, requestContext(req));
      res.json({ success: true, message: 'Token refreshed successfully.', data });
    }),

    logout: asyncHandler(async (req, res) => {
      const accessToken = req.headers.authorization.slice('Bearer '.length);
      const data = await auth.logout({
        userId: req.user._id,
        accessToken,
        refreshToken: req.dto.body.refreshToken,
        allDevices: req.dto.body.allDevices,
      });
      res.json({ success: true, message: 'Logout successful.', data });
    }),

    logoutAll: asyncHandler(async (req, res) => {
      const accessToken = req.headers.authorization.slice('Bearer '.length);
      const data = await auth.logout({ userId: req.user._id, accessToken, allDevices: true });
      res.json({ success: true, message: 'Logged out from all devices.', data });
    }),

    changePassword: asyncHandler(async (req, res) => {
      const accessToken = req.headers.authorization.slice('Bearer '.length);
      const data = await auth.changePassword({ userId: req.user._id, accessToken, ...req.dto.body });
      res.json({ success: true, message: 'Password changed. Please sign in again.', data });
    }),

    me: asyncHandler(async (req, res) => {
      res.json({ success: true, data: await auth.getProfile(req.user._id) });
    }),
  };
}

module.exports = { createAuthController };
