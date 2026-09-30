const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForEvent, emitWithAck } = require('./helpers/testServer');
const { createChatUseCases } = require('../src/application/chat/chatUseCases');

const BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
const MAX_BYTES = 5 * 1024 * 1024;

describe('Media upload tickets and image messages', { timeout: 120000 }, () => {
  let t, alice, bob, carol, family;

  const ticket = (user, body) => t.api('POST', '/api/v1/chat/upload-ticket', { token: user.token, body });
  const imagePayload = (conversationId, attachmentUrl, extra = {}) => ({
    conversationId,
    type: 'image',
    attachmentUrl,
    metadata: { width: 1080, height: 1920, blurhash: BLURHASH, mimeType: 'image/jpeg', size: 204800 },
    ...extra,
  });

  before(async () => {
    t = await startTestServer();
    [alice, bob, carol] = await Promise.all(['Alice', 'Bob', 'Carol'].map(t.registerUser));
    family = await t.createGroup(alice, 'Family');
    await t.joinGroup(bob, family);
    await t.createGroup(carol, 'Other');
  });
  after(() => t.stop());

  describe('POST /api/v1/chat/upload-ticket', () => {
    it('returns a pre-signed PUT URL bound to type, size and a per-user key', async () => {
      const res = await ticket(alice, { conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 204800 });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const data = res.body.data;

      assert.equal(data.method, 'PUT');
      assert.deepEqual(data.headers, { 'Content-Type': 'image/jpeg', 'Content-Length': '204800' });
      assert.match(
        data.key,
        new RegExp(`^chat/${family.conversationId}/${alice.id}/[0-9a-f-]{36}\\.jpg$`)
      );
      assert.equal(data.fileUrl, `https://cdn.test.local/${data.key}`);
      assert.equal(data.expiresIn, 300);
      assert.ok(Date.parse(data.expiresAt) > Date.now());

      const url = new URL(data.uploadUrl);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.host, 'test-bucket.account123.r2.cloudflarestorage.com');
      assert.equal(url.pathname, `/${data.key}`);
      assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
      assert.ok(url.searchParams.get('X-Amz-Signature'));
      assert.deepEqual(url.searchParams.get('X-Amz-SignedHeaders').split(';'), ['content-length', 'content-type', 'host']);
      assert.ok(![...url.searchParams.keys()].some((k) => k.toLowerCase().includes('checksum')), 'no SDK checksum params');
    });

    it('issues unique keys and maps content types to extensions', async () => {
      const png = await ticket(alice, { conversationId: family.conversationId, contentType: 'image/png', contentLength: 10 });
      const png2 = await ticket(alice, { conversationId: family.conversationId, contentType: 'image/png', contentLength: 10 });
      assert.ok(png.body.data.key.endsWith('.png'));
      assert.notEqual(png.body.data.key, png2.body.data.key);
      const heic = await ticket(alice, { conversationId: family.conversationId, contentType: 'image/heic', contentLength: 10 });
      assert.ok(heic.body.data.key.endsWith('.heic'));
    });

    it('validates the request with Zod and the configured size limit', async () => {
      const base = { conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 100 };
      const invalid = [
        { ...base, contentType: 'application/pdf' },
        { ...base, contentType: 'image/svg+xml' },
        { ...base, contentLength: 0 },
        { ...base, contentLength: -1 },
        { ...base, contentLength: 1.5 },
        { ...base, contentLength: '100' },
        { ...base, conversationId: 'nope' },
        { contentType: 'image/jpeg', contentLength: 100 },
      ];
      for (const body of invalid) {
        const res = await ticket(alice, body);
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.code, 'VALIDATION_ERROR');
      }

      const tooBig = await ticket(alice, { ...base, contentLength: MAX_BYTES + 1 });
      assert.equal(tooBig.status, 400);
      assert.match(tooBig.body.message, /too large/);
      const exact = await ticket(alice, { ...base, contentLength: MAX_BYTES });
      assert.equal(exact.status, 201);
    });

    it('only members of the conversation get a ticket', async () => {
      const res = await ticket(carol, { conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 100 });
      assert.equal(res.status, 403);
      const noAuth = await t.api('POST', '/api/v1/chat/upload-ticket', {
        body: { conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 100 },
      });
      assert.equal(noAuth.status, 401);
    });

    it('answers 503 when storage is not configured', async () => {
      const chat = createChatUseCases({ ...t.instance.container.deps, storage: null });
      await assert.rejects(
        chat.createUploadTicket({ userId: alice.id, conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 1 }),
        (error) => error.status === 503
      );
    });
  });

  describe('chat:send_message (image)', () => {
    it('stores the attachment and broadcasts it', async () => {
      const { fileUrl } = (await ticket(alice, { conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 204800 })).body.data;
      const a = await t.connect(alice.token);
      const b = await t.connect(bob.token);
      const received = waitForEvent(b, 'chat:new_message');

      const ack = await emitWithAck(a, 'chat:send_message', imagePayload(family.conversationId, fileUrl, { content: '  Ảnh đi chơi  ' }));
      assert.equal(ack.success, true, JSON.stringify(ack));
      assert.equal(ack.data.type, 'image');
      assert.equal(ack.data.content, 'Ảnh đi chơi');
      assert.deepEqual(ack.data.attachment, {
        url: fileUrl,
        mimeType: 'image/jpeg',
        size: 204800,
        width: 1080,
        height: 1920,
        blurhash: BLURHASH,
      });
      assert.deepEqual(await received, ack.data);

      const history = await t.api('GET', `/api/v1/conversations/${family.conversationId}/messages`, { token: bob.token });
      assert.deepEqual(history.body.data.at(-1), ack.data);
      const list = await t.api('GET', '/api/v1/conversations', { token: bob.token });
      assert.equal(list.body.data[0].lastMessage.type, 'image');

      await t.disconnect(a, b);
    });

    it('accepts an image without caption or optional metadata', async () => {
      const { fileUrl } = (await ticket(alice, { conversationId: family.conversationId, contentType: 'image/png', contentLength: 10 })).body.data;
      const a = await t.connect(alice.token);
      const ack = await emitWithAck(a, 'chat:send_message', {
        conversationId: family.conversationId,
        type: 'image',
        attachmentUrl: fileUrl,
        metadata: { width: 1, height: 1, blurhash: 'LKO2?U' },
      });
      assert.equal(ack.success, true, JSON.stringify(ack));
      assert.equal(ack.data.content, '');
      assert.equal(ack.data.attachment.mimeType, null);
      await t.disconnect(a);
    });

    it('rejects attachment URLs that were not issued to the sender for this conversation', async () => {
      const bobTicket = (await ticket(bob, { conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 10 })).body.data;
      const second = await t.createGroup(alice, 'Second');
      const otherConvTicket = (await ticket(alice, { conversationId: second.conversationId, contentType: 'image/jpeg', contentLength: 10 })).body.data;
      const aliceTicket = (await ticket(alice, { conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 10 })).body.data;
      const a = await t.connect(alice.token);

      const cases = [
        ['someone else\'s upload', bobTicket.fileUrl],
        ['foreign host', 'https://evil.example.com/chat/x.jpg'],
        ['lookalike host', `https://cdn.test.local.evil.com/${aliceTicket.key}`],
        ['path traversal', `https://cdn.test.local/chat/${family.conversationId}/${alice.id}/../${bob.id}/x.jpg`],
        ['query string', `${aliceTicket.fileUrl}?v=1`],
        ['arbitrary key', 'https://cdn.test.local/avatars/me.jpg'],
        ['ticket for another conversation', otherConvTicket.fileUrl],
      ];
      for (const [label, url] of cases) {
        const ack = await emitWithAck(a, 'chat:send_message', imagePayload(family.conversationId, url));
        assert.equal(ack.status, 400, label);
        assert.match(ack.message, /upload ticket/, label);
      }

      // Sanity check: the legitimate ticket works.
      const ok = await emitWithAck(a, 'chat:send_message', imagePayload(family.conversationId, aliceTicket.fileUrl));
      assert.equal(ok.success, true);

      const c = await t.connect(carol.token);
      const outsider = await emitWithAck(c, 'chat:send_message', imagePayload(family.conversationId, aliceTicket.fileUrl));
      assert.equal(outsider.status, 403);
      await t.disconnect(a, c);
    });

    it('validates image payloads with Zod', async () => {
      const { fileUrl } = (await ticket(alice, { conversationId: family.conversationId, contentType: 'image/jpeg', contentLength: 10 })).body.data;
      const a = await t.connect(alice.token);
      const good = imagePayload(family.conversationId, fileUrl);
      const cases = [
        [{ ...good, attachmentUrl: fileUrl.replace('https:', 'http:') }, 'attachmentUrl'],
        [{ ...good, attachmentUrl: undefined }, 'attachmentUrl'],
        [{ ...good, metadata: undefined }, 'metadata'],
        [{ ...good, metadata: { ...good.metadata, width: 0 } }, 'metadata.width'],
        [{ ...good, metadata: { ...good.metadata, height: 20001 } }, 'metadata.height'],
        [{ ...good, metadata: { ...good.metadata, width: 10.5 } }, 'metadata.width'],
        [{ ...good, metadata: { ...good.metadata, blurhash: 'bad hash!' } }, 'metadata.blurhash'],
        [{ ...good, metadata: { ...good.metadata, blurhash: 'abc' } }, 'metadata.blurhash'],
        [{ ...good, metadata: { ...good.metadata, mimeType: 'text/html' } }, 'metadata.mimeType'],
        [{ ...good, content: 'x'.repeat(2001) }, 'content'],
      ];
      for (const [payload, field] of cases) {
        const ack = await emitWithAck(a, 'chat:send_message', payload);
        assert.equal(ack.status, 400, field);
        assert.ok(ack.errors.some((e) => e.field === field), `${field}: ${JSON.stringify(ack.errors)}`);
      }
      await t.disconnect(a);
    });
  });
});
