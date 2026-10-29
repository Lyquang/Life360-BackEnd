const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSosOutboxDispatcher } = require('../src/application/sos/sosOutboxDispatcher');

function fixture(kind = 'sos_alert') {
  const sent = [], retries = [];
  const incident = { _id: 'sos', ownerId: 'owner', status: 'active', revision: 3, createdAt: new Date('2026-10-29T00:00:00Z'),
    groupIds: ['one', 'two'], audience: [
      { groupId: 'one', recipientIds: ['viewer'] },
      { groupId: 'two', recipientIds: ['other'] },
    ] };
  const groups = [{ _id: 'one', members: ['owner', 'viewer'] }, { _id: 'two', members: ['owner', 'other'] }];
  const job = { _id: 'event', sosId: 'sos', recipientId: 'viewer', kind, messageId: 'message', attempts: 1, leaseToken: 'lease' };
  const message = { _id: 'message', conversationId: 'chat', senderId: 'owner', type: 'text', content: 'SOS', sos: { id: 'sos', kind: 'alert' } };
  const deps = {
    policy: { leaseMs: 5000, maxAttempts: 3, retryBaseMs: 100, retryMaxMs: 1000 },
    now: () => new Date('2026-10-29T00:00:00Z'), random: () => 1,
    sosRepo: { findIncidentById: async () => incident },
    groupRepo: { findSosAudienceGroups: async () => groups },
    messageRepo: { findByIds: async () => [message] },
    conversationRepo: { findById: async () => ({ groupId: 'one' }) },
    conversationMemberRepo: { find: async () => ({}) },
    userRepo: { findManyByIds: async () => [{ name: 'Owner' }] },
    outboxRepo: {
      claimNext: async () => job, hasActiveLease: async () => true,
      markDelivered: async () => ({}), markDiscarded: async () => ({}),
      reschedule: async (input) => { retries.push(input); return { status: 'pending' }; },
    },
    deliver: async (event) => sent.push(event),
  };
  return { deps, incident, groups, job, message, sent, retries,
    run: () => createSosOutboxDispatcher(deps).dispatchNext() };
}

test('SOS dispatcher sends stable event ID and current revision; updates contain no audience', async () => {
  const f = fixture('sos_updated');
  assert.equal((await f.run()).status, 'delivered');
  assert.deepEqual(f.sent[0], { recipientId: 'viewer', event: 'sos:updated', payload: { eventId: 'event', sosId: 'sos', revision: 3 } });
  await f.run();
  assert.equal(f.sent[1].payload.eventId, f.sent[0].payload.eventId);
});

test('SOS dispatcher discards revoked access, new members and closed urgent alerts', async () => {
  for (const change of [
    (f) => { f.groups[0].members = ['owner']; },
    (f) => { f.incident.audience[0].recipientIds = []; },
    (f) => { f.incident.status = 'resolved'; },
    (f) => { f.groups[0].members = ['viewer']; },
  ]) {
    const f = fixture(); change(f);
    assert.equal((await f.run()).status, 'discarded');
    assert.equal(f.sent.length, 0);
  }
});

test('SOS chat delivery checks exact Circle and conversation membership', async () => {
  const f = fixture('chat_message');
  assert.equal((await f.run()).status, 'delivered');
  assert.equal(f.sent[0].payload.id, 'message');
  f.deps.conversationRepo.findById = async () => ({ groupId: 'two' });
  assert.equal((await f.run()).status, 'discarded');
  f.deps.conversationRepo.findById = async () => ({ groupId: 'one' });
  f.deps.conversationMemberRepo.find = async () => null;
  assert.equal((await f.run()).status, 'discarded');
  assert.equal(f.sent.length, 1);
});

test('SOS dispatcher retries transport and database failures with bounded backoff', async () => {
  const f = fixture();
  f.deps.deliver = async () => { throw new Error('private payload'); };
  assert.deepEqual(await f.run(), { status: 'pending' });
  assert.equal(f.retries[0].retryAt - f.deps.now(), 100);
  f.job.attempts = 30;
  f.deps.sosRepo.findIncidentById = async () => { throw new Error('database unavailable'); };
  await f.run();
  assert.equal(f.retries[1].retryAt - f.deps.now(), 1000);
});

test('SOS dispatcher does not emit on expired lease or claim an overlapping local job', async () => {
  const f = fixture();
  f.deps.outboxRepo.hasActiveLease = async () => false;
  assert.equal((await f.run()).status, 'lease_lost');
  assert.equal(f.sent.length, 0);
  let release;
  f.deps.outboxRepo.claimNext = () => new Promise((resolve) => { release = resolve; });
  const dispatcher = createSosOutboxDispatcher(f.deps);
  const pending = dispatcher.dispatchNext();
  assert.equal((await dispatcher.dispatchNext()).status, 'busy');
  release(null);
  assert.equal((await pending).status, 'idle');
});

test('SOS dispatcher retains owner update access after leaving all groups and rejects missing policy', async () => {
  const f = fixture('sos_updated');
  f.job.recipientId = 'owner';
  f.groups.length = 0;
  assert.equal((await f.run()).status, 'delivered');
  f.deps.policy = {};
  assert.throws(() => createSosOutboxDispatcher(f.deps), RangeError);
});
