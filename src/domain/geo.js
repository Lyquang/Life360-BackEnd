const EARTH_RADIUS_METERS = 6371000;

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 30 → "30 phút", 65 → "1 giờ 5 phút", 1440 → "1 ngày" */
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days} ngày ${remainHours} giờ` : `${days} ngày`;
}

/** "Đang online" / "Vừa xong" / "30 phút trước" / "2 giờ trước" / "3 ngày trước" */
function formatLastSeen({ isOnline, lastSeenAt }, now) {
  if (isOnline) return 'Đang online';
  if (!lastSeenAt) return 'Chưa có dữ liệu';
  const diffMin = Math.floor((now - lastSeenAt) / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} giờ trước`;
  return `${Math.floor(diffMin / 1440)} ngày trước`;
}

module.exports = { haversineDistance, formatDuration, formatLastSeen };
