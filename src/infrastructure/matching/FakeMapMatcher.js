function encodeSigned(value) {
  let shifted = value < 0 ? ~(value << 1) : value << 1;
  let output = '';
  while (shifted >= 0x20) {
    output += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
    shifted >>= 5;
  }
  return output + String.fromCharCode(shifted + 63);
}

function encodePolyline6(points) {
  let previousLatitude = 0;
  let previousLongitude = 0;
  let encoded = '';
  for (const point of points) {
    const latitude = Math.round(point.latitude * 1e6);
    const longitude = Math.round(point.longitude * 1e6);
    encoded += encodeSigned(latitude - previousLatitude);
    encoded += encodeSigned(longitude - previousLongitude);
    previousLatitude = latitude;
    previousLongitude = longitude;
  }
  return encoded;
}

function createFakeMapMatcher({ confidence = 0.99 } = {}) {
  return {
    provider: 'fake',
    version: 'fake-v1',
    async matchWindow({ points, signal }) {
      if (signal?.aborted) throw signal.reason;
      return {
        matched: true,
        provider: 'fake',
        version: 'fake-v1',
        encoding: 'polyline6',
        geometry: encodePolyline6(points),
        confidence,
      };
    },
  };
}

module.exports = { createFakeMapMatcher, encodePolyline6 };
