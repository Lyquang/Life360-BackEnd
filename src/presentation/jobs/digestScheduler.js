function startDigestScheduler({ digests, intervalMs = 60 * 1000, logger = console }) {
  const timer = setInterval(() => {
    digests.sendDueDigests().catch(() => logger.error('DIGEST_SCHEDULER_FAILED'));
  }, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

module.exports = { startDigestScheduler };
