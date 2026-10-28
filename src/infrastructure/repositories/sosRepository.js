const SosIncident = require('../database/models/SosIncident');
const SosResponse = require('../database/models/SosResponse');
const { assertSosClosingStatus } = require('../../domain/sos');

function requireTransaction(session) {
  if (!session?.inTransaction()) {
    throw new Error('SOS writes require an active MongoDB transaction.');
  }
}

function requireRevision(revision) {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new RangeError('SOS writes require a positive integer revision.');
  }
}

module.exports = {
  async createIncident({ ownerId, clientRequestId, groupIds, recipientIds, message, location }, { session } = {}) {
    requireTransaction(session);
    const [incident] = await SosIncident.create([
      { ownerId, clientRequestId, groupIds, recipientIds, message, location },
    ], { session });
    return incident.toObject();
  },

  findIncidentById(id, { session } = {}) {
    return SosIncident.findById(id).session(session || null).lean();
  },

  findActiveByOwner(ownerId, { session } = {}) {
    return SosIncident.findOne({ ownerId, status: 'active' }).session(session || null).lean();
  },

  findByRequestId(ownerId, clientRequestId, { session } = {}) {
    if (!clientRequestId) return Promise.resolve(null);
    return SosIncident.findOne({ ownerId, clientRequestId: clientRequestId.toLowerCase() })
      .session(session || null).lean();
  },

  // Both assistance and closure write this document to serialize their transactions.
  touchActive(id, expectedRevision, { session } = {}) {
    requireTransaction(session);
    requireRevision(expectedRevision);
    return SosIncident.findOneAndUpdate(
      { _id: id, status: 'active', revision: expectedRevision },
      { $inc: { revision: 1 } },
      { new: true, runValidators: true, session }
    ).lean();
  },

  closeActive({ id, expectedRevision, status, closedAt }, { session } = {}) {
    requireTransaction(session);
    requireRevision(expectedRevision);
    assertSosClosingStatus(status);
    if (!(closedAt instanceof Date) || !Number.isFinite(closedAt.getTime())) {
      throw new TypeError('SOS closure requires a valid closedAt date.');
    }
    return SosIncident.findOneAndUpdate(
      { _id: id, status: 'active', revision: expectedRevision },
      { $set: { status, closedAt }, $inc: { revision: 1 } },
      { new: true, runValidators: true, session }
    ).lean();
  },

  async createResponse({ sosId, responderId }, { session } = {}) {
    // Caller must authorize and touchActive in this same transaction first.
    requireTransaction(session);
    const [response] = await SosResponse.create([{ sosId, responderId }], { session });
    return response.toObject();
  },

  findResponse(sosId, responderId, { session } = {}) {
    return SosResponse.findOne({ sosId, responderId }).session(session || null).lean();
  },

  // The use case must authorize and filter this internal result before returning it.
  listResponses(sosId, { afterId, limit = 50, session } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('SOS response page size must be between 1 and 100.');
    }
    return SosResponse.find({ sosId, ...(afterId && { _id: { $gt: afterId } }) })
      .sort({ _id: 1 }).limit(limit + 1).session(session || null).lean();
  },
};
