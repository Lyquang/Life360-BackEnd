function startDigestScheduler({ digests, intervalMs = 60 * 1000, logger = console }) {
  const timer = setInterval(() => {
    digests.sendDueDigests().catch((error) => logger.error('❌ Digest scheduler error:', error.message));
  }, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

module.exports = { startDigestScheduler };
