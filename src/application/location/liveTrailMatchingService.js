const { assertMapMatcher } = require('../ports/mapMatcher');
const { createSafeMetrics } = require('../ports/metrics');
const { buildMatchWindows, segmentIdFor, sourceRevision } = require('../../domain/liveTrailMatching');

function createLiveTrailMatchingService({
  liveTrailRepo,
  matcher,
  liveTrailDeltaPublisher,
  policy,
  logger = console,
  metrics,
}) {
  const telemetry = createSafeMetrics(metrics);
  assertMapMatcher(matcher);
  const triggers = new Map();
  const queued = new Map();
  const order = [];
  const workers = new Set();
  let active = 0;
  let closed = false;
  let consecutiveFailures = 0;
  let circuitOpenUntil = 0;
  telemetry.addCollector(() => {
    for (const [state, value] of Object.entries(stats())) telemetry.set('trail_matcher_state', { state }, Number(value));
  });

  function clearTrigger(trailId) {
    const trigger = triggers.get(trailId);
    if (trigger?.timer) clearTimeout(trigger.timer);
    triggers.delete(trailId);
  }

  function pushJob(job) {
    if (closed || !policy.enabled) return;
    if (queued.has(job.trailId)) {
      telemetry.increment('trail_matcher_total', { outcome: 'coalesced' });
      queued.set(job.trailId, job);
      return;
    }
    if (order.length >= policy.queueMaxTrails) {
      telemetry.increment('trail_matcher_total', { outcome: 'queue_drop' });
      const droppedTrailId = order.shift();
      queued.delete(droppedTrailId);
    }
    queued.set(job.trailId, job);
    order.push(job.trailId);
    drain();
  }

  function releaseTrigger(trailId) {
    const trigger = triggers.get(trailId);
    if (!trigger) return;
    clearTrigger(trailId);
    pushJob(trigger.job);
  }

  function schedule({ userId, projection }) {
    if (!policy.enabled || closed) return;
    for (const result of projection?.results || []) {
      if (result.inserted.length === 0) continue;
      const existing = triggers.get(result.trailId);
      if (existing?.timer) clearTimeout(existing.timer);
      const trigger = {
        count: (existing?.count || 0) + result.inserted.length,
        job: {
          userId: String(userId),
          trailId: result.trailId,
          revision: result.revision,
          lastSeq: result.lastSeq,
        },
        timer: null,
      };
      triggers.set(result.trailId, trigger);
      if (result.lateArrival || trigger.count >= policy.windowSize) {
        releaseTrigger(result.trailId);
      } else {
        trigger.timer = setTimeout(() => releaseTrigger(result.trailId), policy.windowWaitMs);
        trigger.timer.unref?.();
      }
    }
  }

  function validMatch(result) {
    if (!result || typeof result.matched !== 'boolean') return false;
    if (typeof result.provider !== 'string' || typeof result.version !== 'string') return false;
    if (!result.matched) return true;
    if (result.encoding !== 'polyline6' || typeof result.geometry !== 'string' || !result.geometry) return false;
    return result.confidence === undefined ||
      (Number.isFinite(result.confidence) && result.confidence >= 0 && result.confidence <= 1);
  }

  async function callMatcher(window, profile) {
    if (Date.now() < circuitOpenUntil) {
      telemetry.increment('trail_matcher_total', { outcome: 'circuit_open' });
      return null;
    }
    const controller = new AbortController();
    let timedOut = false;
    let rejectTimeout;
    const timeout = new Promise((resolve, reject) => {
      rejectTimeout = reject;
    });
    const timer = setTimeout(() => {
      timedOut = true;
      const error = new Error('Map matcher timed out.');
      controller.abort(error);
      rejectTimeout(error);
    }, policy.timeoutMs);
    timer.unref?.();
    try {
      const result = await Promise.race([
        matcher.matchWindow({
          points: window.points,
          profile,
          signal: controller.signal,
        }),
        timeout,
      ]);
      if (!validMatch(result)) throw new Error('Map matcher returned an invalid result.');
      consecutiveFailures = 0;
      telemetry.increment('trail_matcher_total', { outcome: result.matched ? 'matched' : 'unmatched' });
      return result;
    } catch (error) {
      telemetry.increment('trail_matcher_total', { outcome: timedOut ? 'timeout' : 'error' });
      consecutiveFailures += 1;
      if (consecutiveFailures >= policy.circuitFailureThreshold) {
        circuitOpenUntil = Date.now() + policy.circuitCooldownMs;
        consecutiveFailures = 0;
      }
      logger.warn('LIVE_TRAIL_MATCHER_FAILED');
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function publicMatch(match) {
    return {
      segmentId: match.segmentId,
      fromSeq: match.fromSeq,
      toSeq: match.toSeq,
      status: match.status,
      matcher: match.matcher,
      sourceRevision: match.sourceRevision,
      generatedAt: match.updatedAt || match.createdAt || new Date(),
      ...(match.geometry?.data && {
        geometry: { encoding: match.geometry.encoding, data: match.geometry.data },
      }),
      ...(match.confidence !== undefined && { confidence: match.confidence }),
    };
  }

  async function processJob(job) {
    const snapshot = await liveTrailRepo.loadMatchingSnapshot(job.trailId);
    if (!snapshot || snapshot.trail.revision !== job.revision) return;
    await liveTrailRepo.deleteMatchesOutsideRevision(job.trailId, job.revision);
    const windows = buildMatchWindows(snapshot.points, policy);
    const updates = [];

    for (const window of windows) {
      if (closed) return;
      const counts = window.points.reduce((acc, point) => {
        const key = point.motionState === 'automotive' ? 'driving'
          : point.motionState === 'cycling' ? 'cycling' : 'walking';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const profile = Object.keys(counts).sort((left, right) => counts[right] - counts[left])[0] || 'walking';
      const source = sourceRevision({
        trailId: job.trailId,
        revision: job.revision,
        window,
        matcher: { provider: matcher.provider, version: matcher.version },
        profile,
        policy,
      });
      const cached = await liveTrailRepo.findMatchBySourceRevision(source);
      let saved;
      if (cached) {
        telemetry.increment('trail_matcher_total', { outcome: 'cache_hit' });
        saved = window.lifecycle === 'final' && cached.status === 'provisional'
          ? await liveTrailRepo.saveMatch({ ...cached, status: 'final' })
          : cached;
      } else {
        const result = await callMatcher(window, profile);
        if (!result) continue;
        saved = await liveTrailRepo.saveMatch({
          trailId: job.trailId,
          userId: job.userId,
          revision: job.revision,
          segmentId: segmentIdFor(job.trailId, job.revision, window.fromSeq),
          fromSeq: window.fromSeq,
          toSeq: window.toSeq,
          status: result.matched ? window.lifecycle : 'unmatched',
          matcher: { provider: result.provider, version: result.version },
          sourceRevision: source,
          expiresAt: snapshot.trail.expiresAt,
          ...(result.matched && {
            geometry: { encoding: result.encoding, data: result.geometry },
          }),
          ...(result.confidence !== undefined && { confidence: result.confidence }),
        });
      }
      if (saved) updates.push(publicMatch(saved));
    }

    if (updates.length > 0) {
      liveTrailDeltaPublisher.publishMatchedUpdates({
        userId: job.userId,
        trailId: job.trailId,
        revision: job.revision,
        lastSeq: job.lastSeq,
        updates,
      });
    }
  }

  function drain() {
    while (!closed && active < policy.concurrency && order.length > 0) {
      const trailId = order.shift();
      const job = queued.get(trailId);
      queued.delete(trailId);
      if (!job) continue;
      active += 1;
      const worker = processJob(job)
        .catch((error) => {
          telemetry.increment('trail_matcher_total', { outcome: 'job_error' });
          logger.error('LIVE_TRAIL_MATCH_JOB_FAILED');
        })
        .finally(() => {
          active -= 1;
          workers.delete(worker);
          drain();
        });
      workers.add(worker);
    }
  }

  async function close() {
    closed = true;
    for (const trailId of triggers.keys()) clearTrigger(trailId);
    queued.clear();
    order.length = 0;
    await Promise.allSettled([...workers]);
  }

  function stats() {
    return {
      active,
      queued: order.length,
      pendingTriggers: triggers.size,
      circuitOpen: Date.now() < circuitOpenUntil,
    };
  }

  return { schedule, close, stats };
}

module.exports = { createLiveTrailMatchingService };
