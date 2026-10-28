function startDigestScheduler({ digests, intervalMs = 60 * 1000, logger = console }) {
  let nextScheduledAt = Date.now() + intervalMs;
  const timer = setInterval(() => {
    const scheduledAt = new Date(nextScheduledAt);
    nextScheduledAt += intervalMs;
    digests.sendDueDigests(new Date(), { scheduledAt }).catch(() => logger.error('DIGEST_SCHEDULER_FAILED'));
  }, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

module.exports = { startDigestScheduler };
