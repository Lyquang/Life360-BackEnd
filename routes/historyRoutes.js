const express = require('express');
const router = express.Router();
const { getUserLocationHistory, getDayJourney } = require('../controllers/historyController');
const { authenticate } = require('../middleware/auth');

// All history routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/history/{userId}:
 *   get:
 *     summary: Get a user's location history for the current day
 *     tags: [History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ObjectId
 *     responses:
 *       200:
 *         description: Location history for today
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 date:
 *                   type: string
 *                   example: "2026-08-09"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid user ID
 */
router.get('/:userId', getUserLocationHistory);

/**
 * @swagger
 * /api/history/{userId}/journey:
 *   get:
 *     summary: Get a user's full day journey (stay points + moving segments)
 *     description: |
 *       Analyzes GPS history and returns a timeline of:
 *       - **Stay points**: places where the user stayed ≥5 min within 80m radius
 *       - **Moving segments**: paths between stay points
 *
 *       Sorted chronologically from 00:00 to 23:59 of the requested date.
 *     tags: [History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ObjectId
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-09-16"
 *         description: Date to query (YYYY-MM-DD). Defaults to today.
 *     responses:
 *       200:
 *         description: Day journey timeline
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 date:
 *                   type: string
 *                   example: "2026-09-16"
 *                 userId:
 *                   type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalPoints:
 *                       type: integer
 *                     stayPointCount:
 *                       type: integer
 *                     totalStayMinutes:
 *                       type: integer
 *                     totalStayFormatted:
 *                       type: string
 *                       example: "2 giờ 30 phút"
 *                     totalMovingMinutes:
 *                       type: integer
 *                     totalMovingFormatted:
 *                       type: string
 *                     firstSeenAt:
 *                       type: string
 *                       format: date-time
 *                     lastSeenAt:
 *                       type: string
 *                       format: date-time
 *                 journey:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - type: object
 *                         description: Stay point
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [stay]
 *                           latitude:
 *                             type: number
 *                           longitude:
 *                             type: number
 *                           arrivedAt:
 *                             type: string
 *                             format: date-time
 *                           leftAt:
 *                             type: string
 *                             format: date-time
 *                           durationMinutes:
 *                             type: integer
 *                           durationFormatted:
 *                             type: string
 *                             example: "45 phút"
 *                           pointCount:
 *                             type: integer
 *                       - type: object
 *                         description: Moving segment
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [moving]
 *                           fromLatitude:
 *                             type: number
 *                           fromLongitude:
 *                             type: number
 *                           toLatitude:
 *                             type: number
 *                           toLongitude:
 *                             type: number
 *                           startTime:
 *                             type: string
 *                             format: date-time
 *                           endTime:
 *                             type: string
 *                             format: date-time
 *                           durationMinutes:
 *                             type: integer
 *                           durationFormatted:
 *                             type: string
 *                           path:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 latitude:
 *                                   type: number
 *                                 longitude:
 *                                   type: number
 *       400:
 *         description: Invalid user ID or date format
 */
router.get('/:userId/journey', getDayJourney);

module.exports = router;
