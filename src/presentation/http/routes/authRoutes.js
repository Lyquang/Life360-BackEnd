const express = require('express');
const { validate } = require('../middleware/validate');
const { registerBody, loginBody, socialLoginBody } = require('../../dto/auth.schemas');

function createAuthRoutes({ controller, authenticate, authLimiter }) {
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
   *       201: { description: "User registered, returns { user, token }" }
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
   *       200: { description: "Login successful, returns { user, token }" }
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
   *       200: { description: "Login successful, returns { user, token, accessToken, refreshToken }" }
   *       400: { $ref: '#/components/responses/ValidationError' }
   *       401: { description: Invalid provider token }
   *       429: { description: Too many attempts }
   */
  router.post('/social-login', authLimiter, validate({ body: socialLoginBody }), controller.socialLogin);

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
