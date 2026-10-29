const { Errors } = require('../../domain/errors');
const { assertCanOfferAssistance } = require('../../domain/sos');
const { createSosAccessPolicy } = require('./sosAccessPolicy');

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
  const accessPolicy = createSosAccessPolicy({ groupRepo });
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

  async function lockGroups(groups, ownerId, session) {
    for (const group of groups) {
      const locked = await groupRepo.lockForSos(group.groupId, ownerId, { session });
      if (locked.matchedCount !== 1) throw Errors.conflict('Circle membership changed. Retry SOS.');
    }
  }

  async function appendChat({ incident, group, senderId, content, kind, at, session }) {
    const conversation = await conversationRepo.findByGroupId(group.groupId, { session });
    if (!conversation || !(await conversationMemberRepo.find(conversation._id, senderId, { session }))) {
      throw Errors.serviceUnavailable('A Circle chat is unavailable. Retry SOS after synchronization.');
    }
    const chatMessage = await messageRepo.createSosMessage({
      conversationId: conversation._id, senderId, content, sos: { id: incident._id, kind },
    }, { session });
    await conversationRepo.recordLastMessage(conversation._id, chatMessage._id, chatMessage.createdAt, { session });
    await conversationMemberRepo.advanceLastRead(conversation._id, senderId, chatMessage._id, chatMessage.createdAt, { session });
    for (const recipientId of group.recipientIds) {
      await outboxRepo.enqueue({
        eventKey: `chat:${chatMessage._id}:${recipientId}`, kind: 'chat_message',
        sosId: incident._id, recipientId, messageId: chatMessage._id,
        revision: incident.revision, nextAttemptAt: at,
      }, { session });
    }
  }

  async function enqueueUpdates(incident, recipients, at, session) {
    for (const recipientId of recipients) {
      await outboxRepo.enqueue({
        eventKey: `update:${incident._id}:${incident.revision}:${recipientId}`, kind: 'sos_updated',
        sosId: incident._id, recipientId, revision: incident.revision, nextAttemptAt: at,
      }, { session });
    }
  }

  async function create({ userId, clientRequestId, message = '', latitude, longitude, recordedAt, batteryLevel }) {
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
        await lockGroups(audience, userId, session);
        const incident = await sosRepo.createIncident({
          ownerId: userId, clientRequestId, groupIds: groups.map((group) => group._id),
          recipientIds, audience, message, batteryLevel,
          location: latitude === undefined ? null : {
            latitude, longitude, recordedAt: recordedAt ? new Date(recordedAt) : requestedAt,
          },
        }, { session });

        for (const entry of audience) {
          await appendChat({
            incident, group: { ...entry, recipientIds: [String(userId), ...entry.recipientIds] },
            senderId: userId, kind: 'alert', at: requestedAt, session,
            content: `${owner.name} đang cần hỗ trợ khẩn cấp.${message ? ` ${message}` : ''}`,
          });
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

  async function get({ userId, sosId, afterId, limit = 50 }) {
    const snapshot = await unitOfWork.run(async (session) => {
      const incident = await sosRepo.findIncidentById(sosId, { session });
      const access = await accessPolicy.load(incident, userId, { session });
      // Apply visibility before pagination so hidden responders never affect cursors or page sizes.
      const rows = await sosRepo.listResponses(sosId, {
        afterId, limit, responderIds: access.visibleResponderIds, session,
      });
      return { incident, groups: access.groups, rows };
    });
    const { incident, groups, rows } = snapshot;
    const page = rows.slice(0, limit);
    const profiles = await userRepo.findManyByIds(uniqueIds(page.map((row) => row.responderId)));
    const byId = new Map(profiles.map((profile) => [String(profile._id), profile]));
    return {
      incident: {
        id: String(incident._id), ownerId: String(incident.ownerId), status: incident.status,
        revision: incident.revision, message: incident.message,
        location: incident.location ? {
          latitude: incident.location.latitude, longitude: incident.location.longitude,
          recordedAt: incident.location.recordedAt,
        } : null,
        groupIds: groups.map((group) => String(group.groupId)),
        createdAt: incident.createdAt, closedAt: incident.closedAt,
      },
      responders: page.map((row) => {
        const profile = byId.get(String(row.responderId));
        return {
          id: String(row._id), responderId: String(row.responderId),
          name: profile?.name ?? null, avatar: profile?.avatar ?? null,
          status: row.status, respondedAt: row.respondedAt,
        };
      }),
      hasMore: rows.length > limit,
      nextAfterId: rows.length > limit ? String(page.at(-1)._id) : null,
    };
  }

  async function respond({ userId, sosId }) {
    const [responder] = await userRepo.findManyByIds([userId]);
    if (!responder) throw Errors.notFound('User not found.');
    const at = now();
    return unitOfWork.run(async (session) => {
      const incident = await sosRepo.findIncidentById(sosId, { session });
      const access = await accessPolicy.load(incident, userId, { session });
      if (access.isOwner) throw Errors.badRequest('You cannot offer assistance to your own SOS.');
      const previous = await sosRepo.findResponse(sosId, userId, { session });
      const view = (row, revision, created) => ({
        created, sosId: String(sosId), revision,
        response: { id: String(row._id), responderId: String(row.responderId), status: row.status, respondedAt: row.respondedAt },
      });
      // A retry of a committed response remains successful after closure; it does not reopen SOS.
      if (previous) return view(previous, incident.revision, false);
      assertCanOfferAssistance(incident, userId);
      const recipients = uniqueIds(access.groups.flatMap((group) => group.recipientIds));
      const eventCount = access.groups.reduce((sum, group) => sum + group.recipientIds.length, 0) + recipients.length;
      if (eventCount > policy.maxOutboxEvents) throw Errors.serviceUnavailable('SOS audience exceeds the configured delivery capacity.');
      await lockGroups(access.groups, incident.ownerId, session);
      const updated = await sosRepo.touchActive(sosId, incident.revision, { session });
      if (!updated) throw Errors.conflict('SOS changed. Reload before responding.');
      const response = await sosRepo.createResponse({ sosId, responderId: userId }, { session });
      for (const group of access.groups) {
        await appendChat({
          incident: updated, group, senderId: userId, kind: 'assistance',
          content: `${responder.name}: Tôi sẽ đến ngay`, at, session,
        });
      }
      await enqueueUpdates(updated, recipients, at, session);
      return view(response, updated.revision, true);
    });
  }

  async function close({ userId, sosId, status }) {
    if (!['resolved', 'cancelled'].includes(status)) throw Errors.badRequest('SOS can be resolved or cancelled by its owner.');
    const at = now();
    return unitOfWork.run(async (session) => {
      const incident = await sosRepo.findIncidentById(sosId, { session });
      if (!incident) throw Errors.notFound('SOS incident not found.');
      if (String(incident.ownerId) !== String(userId)) throw Errors.forbidden('Only the SOS owner can close it.');
      const result = (row, changed) => ({
        changed, incident: { ...creationResult(row, false).incident, closedAt: row.closedAt },
      });
      if (incident.status === status) return result(incident, false);
      if (incident.status !== 'active') throw Errors.conflict('SOS incident is already closed.');
      const access = await accessPolicy.load(incident, userId, { session });
      const recipients = uniqueIds([userId, ...access.groups.flatMap((group) => group.recipientIds)]);
      if (recipients.length > policy.maxOutboxEvents) throw Errors.serviceUnavailable('SOS audience exceeds the configured delivery capacity.');
      await lockGroups(access.groups, userId, session);
      const updated = await sosRepo.closeActive({ id: sosId, expectedRevision: incident.revision, status, closedAt: at }, { session });
      if (!updated) throw Errors.conflict('SOS changed. Reload before closing.');
      await enqueueUpdates(updated, recipients, at, session);
      return result(updated, true);
    });
  }

  async function list({ userId, status = 'active', cursor, limit = 50 }) {
    const rows = await unitOfWork.run((session) => sosRepo.listVisible(userId, { status, cursor, limit, session }));
    const page = rows.slice(0, limit);
    return {
      items: page.map((incident) => ({
        id: String(incident._id), ownerId: String(incident.ownerId), status: incident.status,
        revision: incident.revision, message: incident.message,
        location: incident.location ? { latitude: incident.location.latitude,
          longitude: incident.location.longitude, recordedAt: incident.location.recordedAt } : null,
        groupIds: incident.visibleGroups.map((group) => String(group._id)),
        createdAt: incident.createdAt, closedAt: incident.closedAt,
      })),
      hasMore: rows.length > limit,
      nextCursor: rows.length > limit ? String(page.at(-1)._id) : null,
    };
  }

  return { create, get, respond, close, list };
}

module.exports = { createSosUseCases };
