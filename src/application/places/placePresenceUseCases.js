const { advancePlacePresence, samePresenceContext, PLACE_PRESENCE_POLICY } = require('../../domain/placePresence');
const { isLocationSharingEnabled } = require('../../domain/locationSharing');
const { Errors } = require('../../domain/errors');
const { requireGroupMember, sameId } = require('../shared/policies');

function labelsForDomain(entries) {
  return entries.filter((entry) => entry.placeId?.location?.coordinates).map((entry) => ({
    id: String(entry._id), placeId: String(entry.placeId._id), label: entry.label,
    customLabel: entry.customLabel || null, name: entry.placeId.name,
    updatedAt: entry.updatedAt, placeUpdatedAt: entry.placeId.updatedAt,
    placeRevision: entry.placeId.revision ?? 0,
    latitude: entry.placeId.location.coordinates[1], longitude: entry.placeId.location.coordinates[0],
  }));
}
function contextFor(group, user) {
  return { privacyUpdatedAt: user.locationSharing?.updatedAt || null,
    privacyVersion: user.placePrivacyVersion ?? 0,
    membershipVersion: group.placeMembershipVersion ?? 0,
    membershipUpdatedAt: group.placeMembershipUpdatedAt || group.createdAt };
}

function createPlacePresenceUseCases({ groupRepo, userRepo, placeRepo, unitOfWork,
  now = () => new Date(), policy = PLACE_PRESENCE_POLICY }) {
  async function project({ userId, ...point }) {
    const clock = now();
    const at = new Date(point.recordedAt).getTime();
    if (!point.recordedAt || !Number.isFinite(at) || at > clock.getTime() + policy.maxFutureMs
      || clock.getTime() - at > policy.maxAgeMs) return;
    const groupIds = await placeRepo.labelGroupIds(userId);
    for (const groupId of groupIds) {
      await unitOfWork.run(async (session) => {
        if (!session) return; // Standalone dev cannot establish atomic projection context.
        const group = await groupRepo.lockForPlaceWrite(groupId, userId, { session });
        if (!group) return;
        const [user] = await userRepo.findPresenceSubjects([userId], { session });
        if (!user || !isLocationSharingEnabled(user.locationSharing, clock)) return;
        const labels = labelsForDomain(await placeRepo.listLabels(groupId, userId, { session }));
        const previous = await placeRepo.findPresence(groupId, userId, { session });
        const state = advancePlacePresence({ previous, point, labels,
          context: contextFor(group, user), now: clock, policy });
        if (state) await placeRepo.savePresence(groupId, userId, state, { session });
      });
    }
  }

  async function snapshot({ userId, groupId, limit = 20, cursor }) {
    const initial = await requireGroupMember(groupRepo, groupId, userId);
    const ordered = initial.members.map(String).sort().filter((id) => !cursor || id > cursor);
    const ids = ordered.slice(0, limit);
    const [states, labels] = await Promise.all([
      placeRepo.listPresence(groupId, ids), placeRepo.listSubjectLabels(groupId, ids),
    ]);
    // Fresh DB reads, deliberately bypass profile/member caches after loading projection data.
    const [group, subjects] = await Promise.all([
      groupRepo.findPresenceGroup(groupId), userRepo.findPresenceSubjects(ids),
    ]);
    if (!group || !group.members.some((id) => sameId(id, userId))) throw Errors.forbidden('Circle membership ended.');
    const members = new Set(group.members.map(String));
    const users = new Map(subjects.map((u) => [String(u._id), u]));
    const byUser = new Map(states.map((state) => [String(state.userId), state]));
    const clock = now();
    const data = ids.filter((id) => members.has(id)).map((id) => {
      const unknown = { userId: id, status: 'unknown', place: null, sourceFixAt: null, expiresAt: null };
      const user = users.get(id), state = byUser.get(id);
      if (!user || !isLocationSharingEnabled(user.locationSharing, clock) || !state?.confirmed
        || new Date(state.expiresAt) <= clock || new Date(state.sourceFixAt).getTime() > clock.getTime() + policy.maxFutureMs) return unknown;
      const ownLabels = labelsForDomain(labels.filter((entry) => String(entry.userId) === id));
      const label = ownLabels.find((entry) => entry.id === String(state.labelId));
      const context = contextFor(group, user);
      if (!label || !samePresenceContext(state, label, context)
        || new Date(state.sourceFixAt) < new Date(context.membershipUpdatedAt)
        || new Date(state.sourceFixAt) < new Date(context.privacyUpdatedAt || 0)) return unknown;
      return { userId: id, status: 'at_place',
        place: { id: label.placeId, name: label.name, label: label.label, customLabel: label.customLabel },
        sourceFixAt: new Date(state.sourceFixAt).toISOString(), expiresAt: new Date(state.expiresAt).toISOString() };
    });
    const hasMore = ordered.length > limit;
    return { data, pagination: { hasMore, nextCursor: hasMore ? ids.at(-1) : null } };
  }
  return { project, snapshot };
}

module.exports = { createPlacePresenceUseCases };
