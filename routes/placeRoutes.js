const express = require('express');
const router = express.Router();
const { addFavoritePlace, getGroupPlaces } = require('../controllers/placeController');
const { authenticate } = require('../middleware/auth');

// All place routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/groups/{groupId}/places:
 *   post:
 *     summary: Add a favorite place to a group
 *     tags: [Places]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, latitude, longitude]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Pho 24
 *               category:
 *                 type: string
 *                 enum: [restaurant, entertainment, cafe, shopping, other]
 *                 example: restaurant
 *               latitude:
 *                 type: number
 *                 example: 10.7769
 *               longitude:
 *                 type: number
 *                 example: 106.7009
 *     responses:
 *       201:
 *         description: Favorite place added successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Not a member of this group
 *       404:
 *         description: Group not found
 */
router.post('/:groupId/places', addFavoritePlace);

/**
 * @swagger
 * /api/groups/{groupId}/places:
 *   get:
 *     summary: Get all favorite places for a group
 *     tags: [Places]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ObjectId
 *     responses:
 *       200:
 *         description: List of favorite places
 *       403:
 *         description: Not a member of this group
 *       404:
 *         description: Group not found
 */
router.get('/:groupId/places', getGroupPlaces);

module.exports = router;
