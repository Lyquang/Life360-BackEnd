const FavoritePlace = require('../models/FavoritePlace');
const Group = require('../models/Group');

/**
 * @desc    Add a favorite place to a group
 * @route   POST /api/groups/:groupId/places
 * @access  Private (must be a member)
 */
exports.addFavoritePlace = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, category, latitude, longitude } = req.body;

    // Validate required fields
    if (!name || !category || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, category, latitude, and longitude.',
      });
    }

    // Check group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.',
      });
    }

    const isMember = group.members.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group.',
      });
    }

    // Create favorite place
    const place = await FavoritePlace.create({
      groupId,
      name,
      category,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)], // GeoJSON: [lng, lat]
      },
      addedBy: req.user._id,
    });

    await place.populate('addedBy', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Favorite place added successfully.',
      data: place,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: messages,
      });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all favorite places for a group
 * @route   GET /api/groups/:groupId/places
 * @access  Private (must be a member)
 */
exports.getGroupPlaces = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Check group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.',
      });
    }

    const isMember = group.members.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group.',
      });
    }

    const places = await FavoritePlace.find({ groupId })
      .populate('addedBy', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: places.length,
      data: places,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};
