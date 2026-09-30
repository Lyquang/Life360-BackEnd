const mongoose = require('mongoose');
const LocationHistory = require('../models/LocationHistory');
const Group = require('../models/Group');

// Returns an HTTP status (400/403) if the requester may not view target's history, otherwise null.
async function checkHistoryAccess(requesterId, targetUserId) {
  if (!mongoose.isValidObjectId(targetUserId)) return 400;
  if (requesterId.toString() === targetUserId) return null;
  const sharesGroup = await Group.exists({ members: { $all: [requesterId, targetUserId] } });
  return sharesGroup ? null : 403;
}

function sendAccessError(res, status) {
  const message = status === 400
    ? 'Invalid user ID format.'
    : 'You can only view history of yourself or members of your groups.';
  return res.status(status).json({ success: false, message });
}

// toISOString() would shift local midnight to the previous UTC day.
function formatLocalDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * @desc    Get a user's location history for the current day
 * @route   GET /api/history/:userId
 * @access  Private
 */
exports.getUserLocationHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const accessError = await checkHistoryAccess(req.user._id, userId);
    if (accessError) return sendAccessError(res, accessError);

    // Start/end of today in server local time (set TZ env on the host)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const history = await LocationHistory.find({
      userId,
      timestamp: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    })
      .sort({ timestamp: 1 })
      .lean();

    // Format response
    const formattedHistory = history.map((entry) => ({
      id: entry._id,
      latitude: entry.location.coordinates[1],
      longitude: entry.location.coordinates[0],
      timestamp: entry.timestamp,
    }));

    res.json({
      success: true,
      count: formattedHistory.length,
      date: formatLocalDate(startOfDay),
      data: formattedHistory,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

// ─── Helpers for getDayJourney ───────────────────────────────

/**
 * Haversine distance between two lat/lng points. Returns meters.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format duration in minutes to human-readable Vietnamese string.
 */
function formatDuration(minutes) {
  if (minutes < 1) return 'Dưới 1 phút';
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} ngày ${remHours} giờ` : `${days} ngày`;
}

/**
 * Stay Point Detection Algorithm (sliding window approach):
 *
 * A "stay point" is a cluster of GPS points where the user remained
 * within STAY_RADIUS meters for at least STAY_MIN_DURATION_MS.
 *
 * Algorithm:
 * 1. Iterate through sorted GPS points with two pointers (i, j).
 * 2. Expand j until the distance from point[i] to point[j] > STAY_RADIUS.
 * 3. If time(point[i] → point[j-1]) >= STAY_MIN_DURATION → it's a stay point.
 * 4. The center of the stay point = mean lat/lng of points[i..j-1].
 * 5. Skip all points in the stay window, then continue from j.
 *
 * @param {Array} points - Sorted array of { latitude, longitude, timestamp: Date }
 * @returns {{ stayPoints, remainingPoints }}
 */
function detectStayPoints(points) {
  const STAY_RADIUS = 80;          // meters – user must stay within this radius
  const STAY_MIN_DURATION_MS = 5 * 60 * 1000; // 5 minutes minimum to count as a stay

  const stayPoints = [];
  const usedIndices = new Set();
  const n = points.length;

  let i = 0;
  while (i < n) {
    let j = i + 1;

    // Expand window: collect points within STAY_RADIUS from point[i]
    while (j < n) {
      const dist = haversineDistance(
        points[i].latitude, points[i].longitude,
        points[j].latitude, points[j].longitude
      );
      if (dist > STAY_RADIUS) break;
      j++;
    }

    // j-1 is the last point still within radius
    const windowPoints = points.slice(i, j);
    const windowDuration = points[j - 1].timestamp - points[i].timestamp;

    if (windowDuration >= STAY_MIN_DURATION_MS && windowPoints.length >= 2) {
      // Compute centroid of the cluster
      const avgLat = windowPoints.reduce((s, p) => s + p.latitude, 0) / windowPoints.length;
      const avgLng = windowPoints.reduce((s, p) => s + p.longitude, 0) / windowPoints.length;

      stayPoints.push({
        type: 'stay',
        latitude: avgLat,
        longitude: avgLng,
        arrivedAt: points[i].timestamp.toISOString(),
        leftAt: points[j - 1].timestamp.toISOString(),
        durationMinutes: Math.round(windowDuration / 60000),
        durationFormatted: formatDuration(Math.round(windowDuration / 60000)),
        pointCount: windowPoints.length,
        // index markers for building moving segments
        _startIdx: i,
        _endIdx: j - 1,
      });

      // Mark all points in this window as used
      for (let k = i; k < j; k++) usedIndices.add(k);

      i = j; // jump past this cluster
    } else {
      i++;
    }
  }

  return { stayPoints, usedIndices };
}

/**
 * Build moving segments between consecutive stay points (or around them).
 * A moving segment = the path of raw GPS points between two stay points.
 */
function buildMovingSegments(points, stayPoints, usedIndices) {
  if (stayPoints.length === 0) {
    // No stay points → the entire day is one moving segment
    if (points.length < 2) return [];
    return [
      {
        type: 'moving',
        fromLatitude: points[0].latitude,
        fromLongitude: points[0].longitude,
        toLatitude: points[points.length - 1].latitude,
        toLongitude: points[points.length - 1].longitude,
        startTime: points[0].timestamp.toISOString(),
        endTime: points[points.length - 1].timestamp.toISOString(),
        durationMinutes: Math.round(
          (points[points.length - 1].timestamp - points[0].timestamp) / 60000
        ),
        durationFormatted: formatDuration(
          Math.round((points[points.length - 1].timestamp - points[0].timestamp) / 60000)
        ),
        path: points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      },
    ];
  }

  const movingSegments = [];

  // Build segments: before first stay, between stays, after last stay
  const boundaries = [
    { startIdx: 0, endIdx: stayPoints[0]._startIdx },
    ...stayPoints.slice(0, -1).map((sp, i) => ({
      startIdx: sp._endIdx + 1,
      endIdx: stayPoints[i + 1]._startIdx,
    })),
    { startIdx: stayPoints[stayPoints.length - 1]._endIdx + 1, endIdx: points.length - 1 },
  ];

  for (const { startIdx, endIdx } of boundaries) {
    // Collect non-used points in this range
    const segPoints = [];
    for (let k = startIdx; k <= endIdx && k < points.length; k++) {
      if (!usedIndices.has(k)) segPoints.push(points[k]);
    }

    if (segPoints.length < 2) continue;

    const first = segPoints[0];
    const last = segPoints[segPoints.length - 1];
    const durationMinutes = Math.round((last.timestamp - first.timestamp) / 60000);

    if (durationMinutes <= 0) continue;

    movingSegments.push({
      type: 'moving',
      fromLatitude: first.latitude,
      fromLongitude: first.longitude,
      toLatitude: last.latitude,
      toLongitude: last.longitude,
      startTime: first.timestamp.toISOString(),
      endTime: last.timestamp.toISOString(),
      durationMinutes,
      durationFormatted: formatDuration(durationMinutes),
      path: segPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    });
  }

  return movingSegments;
}

/**
 * @desc    Get a user's full day journey: stay points + moving segments
 * @route   GET /api/history/:userId/journey?date=YYYY-MM-DD
 * @access  Private
 *
 * Response:
 * {
 *   success: true,
 *   date: "2026-09-16",
 *   userId: "...",
 *   summary: {
 *     totalPoints: number,
 *     stayPointCount: number,
 *     totalStayMinutes: number,
 *     totalMovingMinutes: number,
 *     firstSeenAt: ISO string | null,
 *     lastSeenAt: ISO string | null,
 *   },
 *   journey: [   // sorted chronologically
 *     { type: "stay",   latitude, longitude, arrivedAt, leftAt, durationMinutes, durationFormatted, pointCount },
 *     { type: "moving", fromLatitude, fromLongitude, toLatitude, toLongitude, startTime, endTime, durationMinutes, durationFormatted, path },
 *     ...
 *   ]
 * }
 */
exports.getDayJourney = async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query; // optional "YYYY-MM-DD"

    const accessError = await checkHistoryAccess(req.user._id, userId);
    if (accessError) return sendAccessError(res, accessError);

    // Determine the target date range
    let startOfDay, endOfDay;
    if (date) {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      startOfDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    } else {
      const today = new Date();
      startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }
    endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Fetch all history points for the day, sorted by time
    const rawHistory = await LocationHistory.find({
      userId,
      timestamp: { $gte: startOfDay, $lt: endOfDay },
    })
      .sort({ timestamp: 1 })
      .lean();

    const dateStr = formatLocalDate(startOfDay);

    if (rawHistory.length === 0) {
      return res.json({
        success: true,
        date: dateStr,
        userId,
        summary: {
          totalPoints: 0,
          stayPointCount: 0,
          totalStayMinutes: 0,
          totalMovingMinutes: 0,
          firstSeenAt: null,
          lastSeenAt: null,
        },
        journey: [],
      });
    }

    // Normalize points
    const points = rawHistory.map((entry) => ({
      latitude: entry.location.coordinates[1],
      longitude: entry.location.coordinates[0],
      timestamp: new Date(entry.timestamp),
    }));

    // Run stay point detection
    const { stayPoints, usedIndices } = detectStayPoints(points);

    // Build moving segments
    const movingSegments = buildMovingSegments(points, stayPoints, usedIndices);

    // Merge & sort chronologically
    const allEntries = [
      ...stayPoints.map((sp) => ({ ...sp, _sortTime: new Date(sp.arrivedAt) })),
      ...movingSegments.map((ms) => ({ ...ms, _sortTime: new Date(ms.startTime) })),
    ]
      .sort((a, b) => a._sortTime - b._sortTime)
      .map(({ _sortTime, _startIdx, _endIdx, ...rest }) => rest); // strip internal fields

    // Build summary
    const totalStayMinutes = stayPoints.reduce((s, sp) => s + sp.durationMinutes, 0);
    const totalMovingMinutes = movingSegments.reduce((s, ms) => s + ms.durationMinutes, 0);

    res.json({
      success: true,
      date: dateStr,
      userId,
      summary: {
        totalPoints: points.length,
        stayPointCount: stayPoints.length,
        totalStayMinutes,
        totalStayFormatted: formatDuration(totalStayMinutes),
        totalMovingMinutes,
        totalMovingFormatted: formatDuration(totalMovingMinutes),
        firstSeenAt: points[0].timestamp.toISOString(),
        lastSeenAt: points[points.length - 1].timestamp.toISOString(),
      },
      journey: allEntries,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
};
