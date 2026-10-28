const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createMetrics } = require('../src/infrastructure/observability/metricsRegistry');
const { createPrivacyUseCases } = require('../src/application/privacy/privacyUseCases');
const { createGroupUseCases } = require('../src/application/groups/groupUseCases');
const { createChatUseCases } = require('../src/application/chat/chatUseCases');
const { createDigestUseCases } = require('../src/application/digests/digestUseCases');

describe('workflow observability metrics', () => {
  it('records privacy pause/resume outcomes without user identifiers', async () => {
    const metrics = createMetrics({ enabled: true });
    const useCases = createPrivacyUseCases({
      userRepo: {
        async setLocationSharing(_userId, locationSharing) { return { locationSharing }; },
      },
      cacheManager: { async del() {} },
      locationRuntimeState: { clearUser() {} },
      liveTrailAccessInvalidator: { async revalidateForTarget() {} },
      metrics,
    });

    await useCases.setLocationSharing({ userId: 'private-user-canary', enabled: false });
    await useCases.setLocationSharing({ userId: 'private-user-canary', enabled: true });
    await assert.rejects(useCases.setLocationSharing({
      userId: 'private-user-canary', enabled: false, pausedUntil: '2000-01-01T00:00:00.000Z',
    }));

    const { text } = await metrics.snapshot();
    assert.match(text, /familytracker_privacy_actions_total\{action="pause",outcome="success"\} 1/);
    assert.match(text, /familytracker_privacy_actions_total\{action="resume",outcome="success"\} 1/);
    assert.match(text, /familytracker_privacy_actions_total\{action="pause",outcome="rejected"\} 1/);
    assert.doesNotMatch(text, /private-user-canary/);
    metrics.close();
  });

  it('records Circle leave and rejected removal outcomes without Circle/member identifiers', async () => {
    const metrics = createMetrics({ enabled: true });
    const useCases = createGroupUseCases({
      groupRepo: {
        async findById() { return { _id: 'private-circle-canary', admin: 'admin-id', members: ['admin-id', 'member-id'] }; },
        async removeMember() {},
      },
      conversationRepo: { async findByGroupId() { return null; } },
      conversationMemberRepo: { async remove() {} },
      unitOfWork: { async run(operation) { return operation({}); } },
      realtime: {
        emitToUser() {}, unsubscribeUserFromGroup() {}, unsubscribeUserFromConversation() {}, emitToGroup() {},
      },
      liveTrailAccessInvalidator: { async revalidateForMembershipChange() {} },
      metrics,
    });

    await useCases.leaveGroup({ userId: 'member-id', groupId: 'private-circle-canary' });
    await assert.rejects(
      useCases.removeMember({ userId: 'member-id', groupId: 'private-circle-canary', memberUserId: 'admin-id' }),
      { status: 403 }
    );

    const { text } = await metrics.snapshot();
    assert.match(text, /familytracker_circle_membership_actions_total\{action="leave",outcome="success"\} 1/);
    assert.match(text, /familytracker_circle_membership_actions_total\{action="remove",outcome="rejected"\} 1/);
    assert.doesNotMatch(text, /private-circle-canary|member-id|admin-id/);
    metrics.close();
  });

  it('records media-ticket success and access rejection without object URLs or keys', async () => {
    const metrics = createMetrics({ enabled: true });
    let member = true;
    const useCases = createChatUseCases({
      conversationMemberRepo: { async find() { return member ? { userId: 'private-user-canary' } : null; } },
      storage: {
        maxUploadBytes: 1024,
        maxUploadBytesFor() { return 1024; },
        urlTtlSeconds: 300,
        async createPresignedUpload() { return { url: 'https://signed-url-canary.invalid/object?signature=secret', headers: {} }; },
        publicUrlFor() { return 'https://public-url-canary.invalid/object'; },
      },
      cacheManager: { async setWithTTL() { return true; } },
      metrics,
    });

    const ticket = await useCases.createMediaUploadTicket({
      userId: 'private-user-canary', conversationId: 'private-conversation-canary',
      mediaType: 'image', extension: 'jpg', mimeType: 'image/jpeg', fileSize: 100,
    });
    assert.equal(ticket.method, 'PUT');
    member = false;
    await assert.rejects(useCases.createMediaUploadTicket({
      userId: 'private-user-canary', conversationId: 'private-conversation-canary',
      mediaType: 'voice', extension: 'm4a', mimeType: 'audio/mp4', fileSize: 100,
    }), { status: 403 });

    const { text } = await metrics.snapshot();
    assert.match(text, /familytracker_media_tickets_total\{media_type="image",outcome="success"\} 1/);
    assert.match(text, /familytracker_media_tickets_total\{media_type="voice",outcome="rejected"\} 1/);
    assert.doesNotMatch(text, /private-user-canary|private-conversation-canary|signed-url-canary|public-url-canary/);
    metrics.close();
  });

  it('records digest job success, failure, duration, and scheduled start delay', async () => {
    const metrics = createMetrics({ enabled: true });
    let shouldFail = false;
    const useCases = createDigestUseCases({
      groupRepo: {
        async listWithDigestEnabled() {
          if (shouldFail) throw new Error('digest-private-error-canary');
          return [];
        },
      },
      digestRepo: {},
      realtime: {},
      metrics,
    });

    await useCases.sendDueDigests(new Date(), { scheduledAt: new Date(Date.now() - 5000) });
    shouldFail = true;
    await assert.rejects(useCases.sendDueDigests());

    const { text } = await metrics.snapshot();
    assert.match(text, /familytracker_job_runs_total\{job="digest",outcome="success"\} 1/);
    assert.match(text, /familytracker_job_runs_total\{job="digest",outcome="error"\} 1/);
    assert.match(text, /familytracker_job_duration_seconds_count\{job="digest"\} 2/);
    assert.match(text, /familytracker_job_schedule_delay_seconds_count\{job="digest"\} 1/);
    assert.doesNotMatch(text, /digest-private-error-canary/);
    metrics.close();
  });
});
