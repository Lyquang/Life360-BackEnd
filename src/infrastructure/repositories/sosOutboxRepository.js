const { randomUUID } = require('node:crypto');
const SosOutbox = require('../database/models/SosOutbox');

function requireDate(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError('Expected a valid outbox date.');
}

function requirePositiveInteger(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('Expected a positive outbox integer.');
}

function ownedLease(id, leaseToken, now) {
  requireDate(now);
  if (typeof leaseToken !== 'string' || !leaseToken) throw new TypeError('Outbox lease token is required.');
  return { _id: id, status: 'processing', leaseToken, leaseUntil: { $gt: now } };
}

module.exports = {
  async enqueue({ eventKey, kind, sosId, recipientId, messageId, revision, nextAttemptAt }, { session } = {}) {
    if (!session?.inTransaction()) throw new Error('SOS outbox enqueue requires an active MongoDB transaction.');
    const [event] = await SosOutbox.create([
      { eventKey, kind, sosId, recipientId, messageId, revision, nextAttemptAt },
    ], { session });
    return event.toObject();
  },

  async claimNext({ now, leaseMs, maxAttempts }) {
    requireDate(now);
    requirePositiveInteger(leaseMs);
    requirePositiveInteger(maxAttempts);
    const leaseUntil = new Date(now.getTime() + leaseMs);
    requireDate(leaseUntil);
    // A worker can crash on its final attempt; expired leases must not stay processing forever.
    await SosOutbox.updateMany({
      attempts: { $gte: maxAttempts },
      $or: [{ status: 'pending' }, { status: 'processing', leaseUntil: { $lte: now } }],
    }, { $set: { status: 'failed', leaseToken: null, leaseUntil: null } });
    return SosOutbox.findOneAndUpdate({
      attempts: { $lt: maxAttempts },
      nextAttemptAt: { $lte: now },
      $or: [{ status: 'pending' }, { status: 'processing', leaseUntil: { $lte: now } }],
    }, {
      $set: { status: 'processing', leaseUntil, leaseToken: randomUUID() },
      $inc: { attempts: 1 },
    }, { new: true, sort: { nextAttemptAt: 1, _id: 1 } }).lean();
  },

  hasActiveLease({ id, leaseToken, now }) {
    return SosOutbox.exists(ownedLease(id, leaseToken, now));
  },

  markDiscarded({ id, leaseToken, now }) {
    return SosOutbox.findOneAndUpdate(ownedLease(id, leaseToken, now), {
      $set: { status: 'discarded', leaseToken: null, leaseUntil: null },
    }, { new: true }).lean();
  },

  markDelivered({ id, leaseToken, now }) {
    return SosOutbox.findOneAndUpdate(ownedLease(id, leaseToken, now), {
      $set: { status: 'delivered', deliveredAt: now, leaseToken: null, leaseUntil: null },
    }, { new: true }).lean();
  },

  reschedule({ id, leaseToken, now, retryAt, maxAttempts }) {
    const filter = ownedLease(id, leaseToken, now);
    requireDate(retryAt);
    requirePositiveInteger(maxAttempts);
    if (retryAt < now) throw new RangeError('Outbox retry cannot be scheduled in the past.');
    return SosOutbox.findOneAndUpdate(filter, [{ $set: {
      status: { $cond: [{ $gte: ['$attempts', maxAttempts] }, 'failed', 'pending'] },
      nextAttemptAt: retryAt,
      leaseToken: null,
      leaseUntil: null,
    } }], { new: true }).lean();
  },
};
