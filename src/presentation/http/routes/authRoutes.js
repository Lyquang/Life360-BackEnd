const express = require('express');
const { validate } = require('../middleware/validate');
const {
  registerBody,
  loginBody,
  socialLoginBody,
  refreshBody,
  logoutBody,
  changePasswordBody,
} = require('../../dto/auth.schemas');

function createAuthRoutes({ controller, authenticate, authLimiter, refreshLimiter }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/v1/auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email, password]
   *             properties:
   *               name: { type: string, minLength: 2, maxLength: 50, example: John Doe }
   *               email: { type: string, format: email, example: john@example.com }
   *               password: { type: string, minLength: 6, maxLength: 128, example: secret123 }
   *     responses:
   *       201: { description: "Returns user and token pair; token is a deprecated alias of accessToken" }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       409: { description: Email already registered }
   *       429: { description: Too many attempts }
   */
  router.post('/register', authLimiter, validate({ body: registerBody }), controller.register);

  /**
   * @swagger
   * /api/v1/auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string, format: email, example: john@example.com }
   *               password: { type: string, example: secret123 }
   *     responses:
   *       200: { description: "Returns user and token pair; token is a deprecated alias of accessToken" }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       401: { description: Invalid credentials }
   *       429: { description: Too many attempts }
   */
  router.post('/login', authLimiter, validate({ body: loginBody }), controller.login);

  /**
   * @swagger
   * /api/v1/auth/social-login:
   *   post:
   *     summary: Login or register with a social identity provider
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [provider, token]
   *             properties:
   *               provider: { type: string, enum: [google, apple, facebook], example: google }
   *               token: { type: string, description: Provider ID token from the mobile client }
   *     responses:
   *       200: { description: "Returns user and token pair; token is a deprecated alias of accessToken" }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       401: { description: Invalid provider token }
   *       429: { description: Too many attempts }
   */
  router.post('/social-login', authLimiter, validate({ body: socialLoginBody }), controller.socialLogin);

  /**
   * @swagger
   * /api/v1/auth/refresh:
   *   post:
   *     summary: Rotate a single-use refresh token
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refreshToken]
   *             properties:
   *               refreshToken: { type: string, description: Opaque refresh token stored in Keychain }
   *     responses:
   *       200:
   *         description: Returns a new access token and a new single-use refresh token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean, example: true }
   *                 message: { type: string }
   *                 data: { $ref: '#/components/schemas/AuthTokenPair' }
   *       401: { description: Invalid, expired, revoked, or reused refresh token }
   *       429: { description: Too many refresh attempts }
   */
  router.post('/refresh', refreshLimiter, validate({ body: refreshBody }), controller.refresh);

  /**
   * @swagger
   * /api/v1/auth/logout:
   *   post:
   *     summary: Logout and revoke the current access token
   *     tags: [Auth]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               refreshToken: { type: string, description: Optional opaque token used to revoke the MongoDB-backed device family }
   *               allDevices: { type: boolean, default: false, description: Remove all tracked sessions for the user }
   *     responses:
   *       200: { description: Logged out }
   *       401: { description: Unauthorized }
   */
  router.post('/logout', authenticate, validate({ body: logoutBody }), controller.logout);

  /**
   * @swagger
   * /api/v1/auth/logout-all:
   *   post:
   *     summary: Revoke every login session for the current user
   *     tags: [Auth]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: All sessions revoked }
   *       401: { description: Unauthorized }
   */
  router.post('/logout-all', authenticate, controller.logoutAll);

  /**
   * @swagger
   * /api/v1/auth/change-password:
   *   post:
   *     summary: Change password and revoke every login session
   *     tags: [Auth]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [currentPassword, newPassword]
   *             properties:
   *               currentPassword: { type: string }
   *               newPassword: { type: string, minLength: 6, maxLength: 128 }
   *     responses:
   *       200: { description: Password changed and all sessions revoked }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       401: { description: Unauthorized or current password is incorrect }
   */
  router.post('/change-password', authenticate, validate({ body: changePasswordBody }), controller.changePassword);

  /**
   * @swagger
   * /api/v1/auth/me:
   *   get:
   *     summary: Current user profile
   *     tags: [Auth]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: User profile }
   *       401: { description: Unauthorized }
   */
  router.get('/me', authenticate, controller.me);

  return router;
}

module.exports = { createAuthRoutes };
