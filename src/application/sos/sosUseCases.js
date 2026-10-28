const { Errors } = require('../../domain/errors');

const uniqueIds = (ids) => [...new Set(ids.map(String))];

function creationResult(incident, created) {
  return {
    created,
    incident: {
      id: String(incident._id),
      ownerId: String(incident.ownerId),
      status: incident.status,
      revision: incident.revision,
      groupCount: incident.groupIds.length,
      recipientCount: incident.recipientIds.length,
      createdAt: incident.createdAt,
    },
  };
}

function createSosUseCases({
  sosRepo, outboxRepo, groupRepo, conversationRepo, conversationMemberRepo, messageRepo,
  userRepo, unitOfWork, policy, now = () => new Date(),
}) {
  // Require explicit operational limits; API wiring will supply configuration later.
  for (const key of ['maxGroups', 'maxRecipients', 'maxOutboxEvents']) {
    if (!Number.isSafeInteger(policy?.[key]) || policy[key] < 1 || policy[key] >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError(`SOS policy requires a positive safe limit: ${key}.`);
    }
  }

  async function findReplay(userId, clientRequestId, session) {
    if (clientRequestId) {
      const previous = await sosRepo.findByRequestId(userId, clientRequestId, { session });
      if (previous) return creationResult(previous, false);
    }
    const active = await sosRepo.findActiveByOwner(userId, { session });
    if (!active) return null;
    // Do not acknowledge an unrecorded new request ID: a retry after closure could create another SOS.
    if (clientRequestId) throw Errors.conflict('You already have an active SOS. Open it before creating another.');
    return creationResult(active, false);
  }

  async function create({ userId, clientRequestId, message = '', latitude, longitude, recordedAt }) {
    if ((latitude === undefined) !== (longitude === undefined)) {
      throw Errors.badRequest('SOS location requires both latitude and longitude.');
    }
    const [owner] = await userRepo.findManyByIds([userId]);
    if (!owner) throw Errors.notFound('User not found.');
    const requestedAt = now();
    try {
      return await unitOfWork.run(async (session) => {
        const replay = await findReplay(userId, clientRequestId, session);
        if (replay) return replay;
        const groups = await groupRepo.listForSos(userId, { session, limit: policy.maxGroups + 1 });
        if (groups.length === 0) throw Errors.badRequest('Join a Circle before sending SOS.');
        const audience = groups.map((group) => ({
          groupId: group._id,
          recipientIds: uniqueIds(group.members).filter((id) => id !== String(userId)),
        }));
        const recipientIds = uniqueIds(audience.flatMap((entry) => entry.recipientIds));
        const chatEventCount = audience.reduce((sum, entry) => sum + entry.recipientIds.length + 1, 0);
        if (groups.length > policy.maxGroups || recipientIds.length > policy.maxRecipients ||
            chatEventCount + recipientIds.length > policy.maxOutboxEvents) {
          throw Errors.serviceUnavailable('SOS audience exceeds the configured delivery capacity.');
        }
        // Sorted group writes serialize with join/leave/remove; transaction retry reloads membership.
        for (const group of groups) {
          const locked = await groupRepo.lockForSos(group._id, userId, { session });
          if (locked.matchedCount !== 1) throw Errors.conflict('Circle membership changed. Retry SOS.');
        }
        const incident = await sosRepo.createIncident({
          ownerId: userId, clientRequestId, groupIds: groups.map((group) => group._id),
          recipientIds, audience, message,
          location: latitude === undefined ? null : {
            latitude, longitude, recordedAt: recordedAt ? new Date(recordedAt) : requestedAt,
          },
        }, { session });

        for (const entry of audience) {
          const conversation = await conversationRepo.findByGroupId(entry.groupId, { session });
          if (!conversation || !(await conversationMemberRepo.find(conversation._id, userId, { session }))) {
            throw Errors.serviceUnavailable('A Circle chat is unavailable. Retry SOS after synchronization.');
          }
          const chatMessage = await messageRepo.createSosMessage({
            conversationId: conversation._id, senderId: userId,
            content: `${owner.name} đang cần hỗ trợ khẩn cấp.${message ? ` ${message}` : ''}`,
            sos: { id: incident._id, kind: 'alert' },
          }, { session });
          await conversationRepo.recordLastMessage(conversation._id, chatMessage._id, chatMessage.createdAt, { session });
          await conversationMemberRepo.advanceLastRead(conversation._id, userId, chatMessage._id, chatMessage.createdAt, { session });
          for (const recipientId of [String(userId), ...entry.recipientIds]) {
            await outboxRepo.enqueue({
              eventKey: `chat:${chatMessage._id}:${recipientId}`,
              kind: 'chat_message', sosId: incident._id, recipientId, messageId: chatMessage._id,
              revision: incident.revision, nextAttemptAt: requestedAt,
            }, { session });
          }
        }
        // One urgent alert per person, even when they belong to several of the owner's Circles.
        for (const recipientId of recipientIds) {
          await outboxRepo.enqueue({
            eventKey: `alert:${incident._id}:${recipientId}`, kind: 'sos_alert',
            sosId: incident._id, recipientId, revision: incident.revision, nextAttemptAt: requestedAt,
          }, { session });
        }
        return creationResult(incident, true);
      });
    } catch (error) {
      if (!sosRepo.isIncidentUniquenessConflict(error)) throw error;
      // Duplicate-key aborts the transaction; resolve replay only after rollback.
      const replay = await unitOfWork.run((session) => findReplay(userId, clientRequestId, session));
      if (replay) return replay;
      throw error;
    }
  }

  return { create };
}

module.exports = { createSosUseCases };
