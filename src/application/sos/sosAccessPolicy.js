const { Errors } = require('../../domain/errors');

function createSosAccessPolicy({ groupRepo }) {
  async function load(incident, userId, { session } = {}) {
    if (!incident) throw Errors.notFound('SOS incident not found.');
    const ownerId = String(incident.ownerId);
    const viewerId = String(userId);
    const isOwner = viewerId === ownerId;
    const snapshots = new Map((incident.audience || []).map((entry) => [
      String(entry.groupId), new Set(entry.recipientIds.map(String)),
    ]));
    const currentGroups = await groupRepo.findSosAudienceGroups(incident.groupIds, { session });
    const groups = [];
    for (const group of currentGroups) {
      const members = new Set(group.members.map(String));
      const original = snapshots.get(String(group._id));
      if (!members.has(ownerId) || !original) continue;
      if (!isOwner && (!members.has(viewerId) || !original.has(viewerId))) continue;
      groups.push({
        groupId: group._id,
        recipientIds: [ownerId, ...[...original].filter((id) => id !== ownerId && members.has(id))],
      });
    }
    if (!isOwner && groups.length === 0) throw Errors.forbidden('You cannot access this SOS.');
    return {
      isOwner,
      groups,
      // Undefined intentionally means all historical responses, for the owner only.
      visibleResponderIds: isOwner ? undefined : [...new Set(groups.flatMap((group) => group.recipientIds))],
    };
  }

  return { load };
}

module.exports = { createSosAccessPolicy };
