const { AppError } = require('../../domain/errors');
const { createSosAccessPolicy } = require('./sosAccessPolicy');
const { toMessageView } = require('../chat/chatMappers');

// One bounded claim per call; scheduling and transport belong to external adapters.
function createSosOutboxDispatcher({
  outboxRepo, sosRepo, groupRepo, messageRepo, conversationRepo,
  conversationMemberRepo, userRepo, deliver, policy, now = () => new Date(), random = Math.random,
}) {
  for (const name of ['leaseMs', 'maxAttempts', 'retryBaseMs', 'retryMaxMs']) {
    if (!Number.isSafeInteger(policy?.[name]) || policy[name] < 1) {
      throw new RangeError(`SOS dispatcher requires positive ${name}.`);
    }
  }
  if (policy.retryMaxMs < policy.retryBaseMs) throw new RangeError('Invalid SOS retry bounds.');
  const accessPolicy = createSosAccessPolicy({ groupRepo });

  async function prepare(job) {
    const incident = await sosRepo.findIncidentById(job.sosId);
    if (!incident) return null;
    let access;
    try {
      access = await accessPolicy.load(incident, job.recipientId);
    } catch (error) {
      if (error instanceof AppError && error.status === 403) return null;
      throw error;
    }
    const common = { eventId: String(job._id), sosId: String(incident._id), revision: incident.revision };
    if (job.kind === 'sos_updated') {
      // Invalidation only: a later authorized read supplies the viewer-specific responders.
      return { event: 'sos:updated', payload: common };
    }
    if (job.kind === 'sos_alert') {
      if (incident.status !== 'active') return null;
      const [owner] = await userRepo.findManyByIds([incident.ownerId]);
      const group = access.groups[0];
      return { event: 'sos_alert', payload: { ...common, ownerId: String(incident.ownerId),
        type: 'SOS', userId: String(incident.ownerId), name: owner?.name ?? '',
        groupId: group ? String(group.groupId) : undefined, groupName: group?.groupName,
        latitude: incident.location?.latitude, longitude: incident.location?.longitude,
        batteryLevel: incident.batteryLevel, timestamp: new Date(incident.createdAt).toISOString(),
        status: incident.status, message: incident.message || 'Emergency! I need help!', location: incident.location ?? null,
        createdAt: incident.createdAt } };
    }
    if (job.kind !== 'chat_message') throw new Error('Unsupported SOS outbox kind.');
    const [message] = await messageRepo.findByIds([job.messageId]);
    if (!message || String(message.sos?.id) !== String(incident._id)) return null;
    const conversation = await conversationRepo.findById(message.conversationId);
    if (!conversation || !access.groups.some((group) => String(group.groupId) === String(conversation.groupId))) return null;
    if (!await conversationMemberRepo.find(message.conversationId, job.recipientId)) return null;
    const [sender] = await userRepo.findManyByIds([message.senderId]);
    return { event: 'chat:new_message', payload: { ...toMessageView(message, sender?.name ?? null), eventId: common.eventId } };
  }

  let running = false;
  async function dispatchNext() {
    if (running) return { status: 'busy' };
    running = true;
    try {
      const job = await outboxRepo.claimNext({ now: now(), ...policy });
      if (!job) return { status: 'idle' };
      const lease = () => ({ id: job._id, leaseToken: job.leaseToken, now: now() });
      try {
        const prepared = await prepare(job);
        if (!prepared) {
          const result = await outboxRepo.markDiscarded(lease());
          return { status: result ? 'discarded' : 'lease_lost' };
        }
        // Avoid emitting after slow reads have consumed the lease. Transport must be bounded.
        if (!await outboxRepo.hasActiveLease(lease())) return { status: 'lease_lost' };
        await deliver({ recipientId: String(job.recipientId), ...prepared });
        const result = await outboxRepo.markDelivered(lease());
        return { status: result ? 'delivered' : 'lease_lost' };
      } catch {
        // No raw exceptions, identities, coordinates or payloads escape into logs/results.
        const at = now();
        const ceiling = Math.min(policy.retryMaxMs, policy.retryBaseMs * 2 ** Math.min(job.attempts - 1, 30));
        const delay = Math.ceil(ceiling * (0.5 + Math.max(0, Math.min(1, random())) * 0.5));
        const result = await outboxRepo.reschedule({ id: job._id, leaseToken: job.leaseToken,
          now: at, retryAt: new Date(at.getTime() + delay), maxAttempts: policy.maxAttempts });
        return { status: result ? result.status : 'lease_lost' };
      }
    } finally {
      running = false;
    }
  }
  return { dispatchNext };
}

module.exports = { createSosOutboxDispatcher };
