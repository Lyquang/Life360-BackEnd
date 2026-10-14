function stableSortByRecordedAt(points) {
  return points
    .map((point, order) => ({ point, order }))
    .sort((a, b) => a.point.recordedAt.getTime() - b.point.recordedAt.getTime() || a.order - b.order)
    .map(({ point }) => point);
}

function recordedAtRejection(recordedAt, now, { maxAgeMs, maxFutureMs }) {
  const timestamp = recordedAt.getTime();
  if (timestamp > now + maxFutureMs) {
    return { code: 'RECORDED_AT_IN_FUTURE', reason: 'recordedAt is too far in the future.' };
  }
  if (timestamp < now - maxAgeMs) {
    return { code: 'RECORDED_AT_TOO_OLD', reason: 'recordedAt exceeds the maximum allowed age.' };
  }
  return null;
}

module.exports = { stableSortByRecordedAt, recordedAtRejection };
