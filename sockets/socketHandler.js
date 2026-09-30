const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Group = require('../models/Group');
const LocationHistory = require('../models/LocationHistory');
const GroupDigest = require('../models/GroupDigest');

// ─── In-memory store for throttling ─────────────────────────
// Tracks last saved location per user to implement throttling
const lastSavedLocation = new Map();

// Throttling config
const THROTTLE_DISTANCE_METERS = 50; // Only save if moved > 50 meters
const THROTTLE_TIME_MS = 30 * 1000;  // Or if > 30 seconds have passed

// ─── In-memory store for duration tracking ───────────────────
// Tracks how long a user has been staying at their current location
// Map<userId, { latitude, longitude, sinceTimestamp, alertedMilestones: Set<number> }>
const locationDurationTracker = new Map();

// Stay alert milestones in minutes
const STAY_ALERT_MILESTONES_MINUTES = [30, 60, 120, 240, 480, 1440];

/**
 * Calculate distance between two points using Haversine formula.
 * @returns Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determine if location should be saved to DB (throttling logic).
 * Save if: distance > 50m OR time > 30s since last save.
 */
function shouldSaveLocation(userId, latitude, longitude) {
  const last = lastSavedLocation.get(userId);

  if (!last) return true; // First location, always save

  const timeDiff = Date.now() - last.timestamp;
  if (timeDiff >= THROTTLE_TIME_MS) return true;

  const distance = haversineDistance(last.latitude, last.longitude, latitude, longitude);
  if (distance >= THROTTLE_DISTANCE_METERS) return true;

  return false;
}

/**
 * Update duration tracker for a user.
 * - Resets if user moved more than THROTTLE_DISTANCE_METERS.
 * - Returns current durationMinutes and durationSince (ISO string).
 */
function updateDurationTracker(userId, latitude, longitude) {
  const now = Date.now();
  const tracker = locationDurationTracker.get(userId);

  if (!tracker) {
    // First time → start tracking
    locationDurationTracker.set(userId, {
      latitude,
      longitude,
      sinceTimestamp: now,
      alertedMilestones: new Set(),
    });
    return { durationMinutes: 0, durationSince: new Date(now).toISOString() };
  }

  const distance = haversineDistance(tracker.latitude, tracker.longitude, latitude, longitude);

  if (distance >= THROTTLE_DISTANCE_METERS) {
    // User moved → reset tracker
    locationDurationTracker.set(userId, {
      latitude,
      longitude,
      sinceTimestamp: now,
      alertedMilestones: new Set(),
    });
    return { durationMinutes: 0, durationSince: new Date(now).toISOString() };
  }

  // User stayed → calculate duration
  const durationMs = now - tracker.sinceTimestamp;
  const durationMinutes = Math.floor(durationMs / (60 * 1000));
  return {
    durationMinutes,
    durationSince: new Date(tracker.sinceTimestamp).toISOString(),
  };
}

/**
 * Check which stay alert milestones have been reached and haven't been sent yet.
 * Returns array of milestone minutes that should trigger an alert.
 */
function getNewMilestones(userId, durationMinutes) {
  const tracker = locationDurationTracker.get(userId);
  if (!tracker) return [];

  const newMilestones = [];
  for (const milestone of STAY_ALERT_MILESTONES_MINUTES) {
    if (durationMinutes >= milestone && !tracker.alertedMilestones.has(milestone)) {
      newMilestones.push(milestone);
      tracker.alertedMilestones.add(milestone);
    }
  }
  return newMilestones;
}

/**
 * Format duration in minutes to human-readable Vietnamese string.
 * E.g. 30 → "30 phút", 65 → "1 giờ 5 phút", 1440 → "1 ngày"
 */
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  }
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days} ngày ${remainHours} giờ` : `${days} ngày`;
}

/**
 * Initialize Socket.io with JWT authentication and event handlers.
 */
function initializeSocket(io) {
  // ─── Authentication middleware ──────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user to socket
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // ─── Connection handler ─────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const userName = socket.user.name;

    console.log(`🟢 User connected: ${userName} (${userId})`);

    // Update online status
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // ─── Auto-join group rooms ──────────────────────────────
    try {
      const groups = await Group.find({ members: userId });

      for (const group of groups) {
        const roomName = `group_${group._id}`;
        socket.join(roomName);
        console.log(`   → Joined room: ${roomName} (${group.name})`);

        // Notify other members that user is online
        socket.to(roomName).emit('member_online', {
          userId,
          name: userName,
          isOnline: true,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`❌ Error joining rooms for ${userName}:`, error.message);
    }

    // ─── update_location ────────────────────────────────────
    socket.on('update_location', async (data) => {
      try {
        const { latitude, longitude, batteryLevel } = data;

        if (latitude === undefined || longitude === undefined) {
          return socket.emit('error', { message: 'latitude and longitude are required' });
        }

        // 1) Update user's battery level + lastSeenAt + lastKnownLocation
        const updateData = {
          lastSeenAt: new Date(),
          'lastKnownLocation.coordinates': [longitude, latitude],
          'lastKnownLocation.updatedAt': new Date(),
        };
        if (batteryLevel !== undefined) {
          updateData.batteryLevel = Math.min(100, Math.max(0, batteryLevel));
        }
        await User.findByIdAndUpdate(userId, updateData);

        // 2) Save to LocationHistory (with throttling)
        if (shouldSaveLocation(userId, latitude, longitude)) {
          await LocationHistory.create({
            userId,
            location: {
              type: 'Point',
              coordinates: [longitude, latitude], // GeoJSON: [lng, lat]
            },
            timestamp: new Date(),
          });

          // Update throttle cache
          lastSavedLocation.set(userId, {
            latitude,
            longitude,
            timestamp: Date.now(),
          });
        }

        // 3) Update duration tracker & compute stay duration
        const { durationMinutes, durationSince } = updateDurationTracker(userId, latitude, longitude);

        // 3b) Persist durationMinutes to DB (for offline digest)
        await User.findByIdAndUpdate(userId, {
          'lastKnownLocation.durationMinutes': durationMinutes,
        });

        // 4) Check for new stay alert milestones
        const newMilestones = getNewMilestones(userId, durationMinutes);

        // 5) Broadcast to all group rooms
        const groups = await Group.find({ members: userId });

        const locationPayload = {
          userId,
          name: userName,
          latitude,
          longitude,
          batteryLevel: batteryLevel !== undefined ? batteryLevel : socket.user.batteryLevel,
          timestamp: new Date().toISOString(),
          // ── Duration fields (Feature 1) ──
          durationAtLocation: durationMinutes,       // minutes staying at this spot
          durationSince: durationSince,              // ISO timestamp when they arrived
          durationFormatted: formatDuration(durationMinutes), // "1 giờ 30 phút"
        };

        for (const group of groups) {
          const roomName = `group_${group._id}`;
          socket.to(roomName).emit('location_update', locationPayload);

          // 6) Broadcast stay alert to group for each new milestone
          for (const milestone of newMilestones) {
            const stayAlertPayload = {
              type: 'STAY_ALERT',
              userId,
              name: userName,
              latitude,
              longitude,
              durationMinutes: milestone,
              durationFormatted: formatDuration(milestone),
              durationSince: durationSince,
              groupId: group._id,
              groupName: group.name,
              message: `${userName} đang ở một nơi được ${formatDuration(milestone)} rồi!`,
              timestamp: new Date().toISOString(),
            };

            // Broadcast to ALL members (including sender for self-awareness)
            io.to(roomName).emit('location_stay_alert', stayAlertPayload);

            console.log(
              `⏱  Stay alert: ${userName} stayed ${formatDuration(milestone)} in group ${group.name}`
            );
          }
        }
      } catch (error) {
        console.error(`❌ Error updating location for ${userName}:`, error.message);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // ─── sos_alert ──────────────────────────────────────────
    socket.on('sos_alert', async (data) => {
      try {
        console.log(`🚨 SOS ALERT from ${userName} (${userId})`);

        const groups = await Group.find({ members: userId });

        const sosPayload = {
          type: 'SOS',
          userId,
          name: userName,
          message: data?.message || 'Emergency! I need help!',
          latitude: data?.latitude,
          longitude: data?.longitude,
          batteryLevel: data?.batteryLevel,
          timestamp: new Date().toISOString(),
        };

        for (const group of groups) {
          // Broadcast to ALL members in the room (including sender for confirmation)
          io.to(`group_${group._id}`).emit('sos_alert', {
            ...sosPayload,
            groupId: group._id,
            groupName: group.name,
          });
        }

        socket.emit('sos_confirmed', {
          message: 'SOS alert sent to all your groups.',
          groupCount: groups.length,
        });
      } catch (error) {
        console.error(`❌ Error sending SOS for ${userName}:`, error.message);
        socket.emit('error', { message: 'Failed to send SOS alert' });
      }
    });

    // ─── disconnect ─────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`🔴 User disconnected: ${userName} (${userId}) - Reason: ${reason}`);

      try {
        // Update offline status + persist lastSeenAt
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeenAt: new Date(),
        });

        // Clean up throttle cache & duration tracker
        lastSavedLocation.delete(userId);
        locationDurationTracker.delete(userId);

        // Notify all group rooms
        const groups = await Group.find({ members: userId });

        for (const group of groups) {
          socket.to(`group_${group._id}`).emit('member_offline', {
            userId,
            name: userName,
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`❌ Error handling disconnect for ${userName}:`, error.message);
      }
    });
  });

  // ─── Group Digest Scheduler ─────────────────────────────────
  // Chạy mỗi phút, kiểm tra từng group xem đã đến giờ gửi digest chưa
  // "Digest" = thông báo tóm tắt vị trí + thời gian online cuối của từng thành viên
  setInterval(async () => {
    try {
      // Chỉ xử lý group có notificationIntervalMinutes > 0
      const groups = await Group.find({ notificationIntervalMinutes: { $gt: 0 } })
        .populate('members', 'name isOnline lastSeenAt lastKnownLocation batteryLevel');

      const now = new Date();

      for (const group of groups) {
        const intervalMs = group.notificationIntervalMinutes * 60 * 1000;
        const lastSent = group.lastDigestSentAt;

        // Bỏ qua nếu chưa đến giờ gửi
        if (lastSent && now - lastSent < intervalMs) continue;

        // Kiểm tra có ít nhất 1 thành viên online trong room không
        const roomName = `group_${group._id}`;
        const socketsInRoom = await io.in(roomName).allSockets();
        if (socketsInRoom.size === 0) continue; // Bỏ qua nếu không ai online

        // Build digest payload cho từng thành viên
        const memberStatuses = group.members.map((member) => {
          const lastSeen = member.lastSeenAt;
          const lastLoc = member.lastKnownLocation;

          // Tính "online X phút trước"
          let lastSeenText = 'Chưa có dữ liệu';
          if (member.isOnline) {
            lastSeenText = 'Đang online';
          } else if (lastSeen) {
            const diffMs = now - lastSeen;
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 1) lastSeenText = 'Vừa xong';
            else if (diffMin < 60) lastSeenText = `${diffMin} phút trước`;
            else if (diffMin < 1440) lastSeenText = `${Math.floor(diffMin / 60)} giờ trước`;
            else lastSeenText = `${Math.floor(diffMin / 1440)} ngày trước`;
          }

          // Thời gian đứng yên tại vị trí hiện tại
          const durationMin = lastLoc?.durationMinutes || 0;
          const durationText = durationMin > 0 ? `ở đây ${formatDuration(durationMin)}` : null;

          return {
            userId: member._id,
            name: member.name,
            isOnline: member.isOnline,
            lastSeenText,
            batteryLevel: member.batteryLevel,
            latitude: lastLoc?.coordinates?.[1] || null,
            longitude: lastLoc?.coordinates?.[0] || null,
            locationUpdatedAt: lastLoc?.updatedAt || null,
            durationMinutes: durationMin,
            durationFormatted: durationMin > 0 ? formatDuration(durationMin) : null,
            // Message tóm tắt: "Nam đã ở Vietcombank Tower 30 phút rồi và đã online 30 phút trước"
            summary: durationText
              ? `${member.name} ${durationText} và ${lastSeenText.toLowerCase()}`
              : `${member.name} ${lastSeenText.toLowerCase()}`,
          };
        });

        // Phát digest đến tất cả thành viên trong room
        io.to(roomName).emit('group_digest', {
          type: 'GROUP_DIGEST',
          groupId: group._id,
          groupName: group.name,
          intervalMinutes: group.notificationIntervalMinutes,
          members: memberStatuses,
          timestamp: now.toISOString(),
        });

        // Lưu digest vào DB (để GET API có thể query sau)
        await GroupDigest.create({
          groupId: group._id,
          groupName: group.name,
          intervalMinutes: group.notificationIntervalMinutes,
          members: memberStatuses,
          sentAt: now,
        });

        // Cập nhật lastDigestSentAt
        await Group.findByIdAndUpdate(group._id, { lastDigestSentAt: now });

        console.log(
          `📋 Digest sent to group "${group.name}" (${memberStatuses.length} members, interval: ${group.notificationIntervalMinutes}m)`
        );
      }
    } catch (err) {
      console.error('❌ Digest scheduler error:', err.message);
    }
  }, 60 * 1000); // Chạy mỗi 1 phút

  console.log('🔌 Socket.io initialized');
}

module.exports = initializeSocket;
