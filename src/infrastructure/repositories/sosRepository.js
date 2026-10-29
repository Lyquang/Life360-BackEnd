const SosIncident = require('../database/models/SosIncident');
const SosResponse = require('../database/models/SosResponse');
const { Types } = require('mongoose');
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
  // Visibility precedes the page limit: revoked incidents cannot create empty pages
  // or leak their IDs through a cursor. All reads use the caller's snapshot transaction.
  listVisible(userId, { status = 'active', cursor, limit = 50, session } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Invalid SOS page limit.');
    const viewer = new Types.ObjectId(String(userId));
    return SosIncident.aggregate([
      { $match: {
        $or: [{ ownerId: viewer }, { recipientIds: viewer }],
        ...(status !== 'all' && { status }),
        ...(cursor && { _id: { $lt: new Types.ObjectId(String(cursor)) } }),
      } },
      { $sort: { _id: -1 } },
      { $lookup: {
        from: 'groups',
        let: { owner: '$ownerId', audience: { $ifNull: ['$audience', []] }, groupIds: '$groupIds' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $in: ['$_id', '$$groupIds'] },
            { $in: ['$$owner', '$members'] },
            { $or: [{ $eq: ['$$owner', viewer] }, { $in: [viewer, '$members'] }] },
            { $anyElementTrue: [{ $map: { input: '$$audience', as: 'entry', in: { $and: [
              { $eq: ['$$entry.groupId', '$_id'] },
              { $or: [{ $eq: ['$$owner', viewer] }, { $in: [viewer, '$$entry.recipientIds'] }] },
            ] } } }] },
          ] } } },
          { $project: { _id: 1 } },
        ],
        as: 'visibleGroups',
      } },
      { $match: { $or: [{ ownerId: viewer }, { 'visibleGroups.0': { $exists: true } }] } },
      { $limit: limit + 1 },
      { $project: { _id: 1, ownerId: 1, status: 1, revision: 1, message: 1, location: 1,
        createdAt: 1, closedAt: 1, visibleGroups: 1 } },
    ]).session(session || null);
  },

  async createIncident({ ownerId, clientRequestId, groupIds, recipientIds, audience, message, location, batteryLevel }, { session } = {}) {
    requireTransaction(session);
    const [incident] = await SosIncident.create([
      { ownerId, clientRequestId, groupIds, recipientIds, audience, message, location, batteryLevel },
    ], { session });
    return incident.toObject();
  },

  isIncidentUniquenessConflict(error) {
    const keys = Object.keys(error?.keyPattern || {});
    return error?.code === 11000 && keys.includes('ownerId') &&
      keys.every((key) => key === 'ownerId' || key === 'clientRequestId');
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
  listResponses(sosId, { afterId, limit = 50, responderIds, session } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('SOS response page size must be between 1 and 100.');
    }
    return SosResponse.find({
      sosId,
      ...(afterId && { _id: { $gt: afterId } }),
      ...(responderIds !== undefined && { responderId: { $in: responderIds } }),
    })
      .sort({ _id: 1 }).limit(limit + 1).session(session || null).lean();
  },
};
