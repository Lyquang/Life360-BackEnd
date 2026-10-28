const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { registerSocketServer } = require('../src/presentation/socket/socketServer');
const { createSafeLogger } = require('../src/infrastructure/observability/safeLogger');
const { getLogContext } = require('../src/infrastructure/observability/logContext');
const { startDigestScheduler } = require('../src/presentation/jobs/digestScheduler');

test('socket events have distinct IDs within one connection without logging payloads', async () => {
  const lines = [];
  const logger = createSafeLogger({ destination: { write(line) { lines.push(JSON.parse(line)); } } });
  const io = { use(fn) { this.authenticate = fn; }, on(name, fn) { this[name] = fn; } };
  const socket = new EventEmitter();
  socket.id = 'client-controlled-id';
  socket.data = {};
  socket.handshake = { auth: { token: 'private-token-canary' } };
  socket.join = async () => {};
  socket.leave = async () => {};
  const seen = [];
  const location = {
    connect: async () => ({ groupIds: [] }),
    disconnect: async () => {},
    updateLocation: async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
      seen.push(getLogContext());
      logger.log('SAFE_EVENT', { token: 'private-token-canary', latitude: 10 });
    },
  };
  registerSocketServer(io, {
    auth: { authenticateToken: async () => ({ user: { _id: 'user-1', name: 'Private Name' }, auth: {} }) },
    location,
    chat: { getConversationIdsForUser: async () => [] },
    liveTrailWatch: {},
    liveTrailAccessInvalidator: { register: () => () => {} },
    realtime: { rooms: { user: () => 'user-room', session: () => 'session-room', group: () => 'group-room', conversation: () => 'chat-room' } },
    liveTrailPolicy: { watchActionsPerMinute: 30, watchLeaseMs: 60000, maxWatchesPerSocket: 5 },
    logger,
  });
  await new Promise((resolve, reject) => io.authenticate(socket, error => error ? reject(error) : resolve()));
  io.connection(socket);
  try {
    const handler = socket.listeners('update_location')[0];
    await Promise.all([
      handler({ latitude: 10, longitude: 106 }),
      handler({ latitude: 11, longitude: 107 }),
    ]);
    assert.equal(seen.length, 2);
    assert.match(seen[0].connectionId, /^[0-9a-f]{32}$/);
    assert.equal(seen[0].connectionId, seen[1].connectionId);
    assert.notEqual(seen[0].eventId, seen[1].eventId);
    assert.equal(seen[0].event, 'update_location');
    assert.equal(lines.filter(line => line.msg === 'SAFE_EVENT').length, 2);
    assert.deepEqual(new Set(lines.filter(line => line.msg === 'SAFE_EVENT').map(line => line.eventId)),
      new Set(seen.map(context => context.eventId)));
    assert.doesNotMatch(JSON.stringify(lines), /private-token-canary|Private Name|client-controlled-id|latitude|longitude/);
  } finally {
    socket.emit('disconnect');
  }
});

test('digest scheduler logs only a fixed event code on failure', async () => {
  const events = [];
  const calls = [];
  const scheduler = startDigestScheduler({
    digests: { sendDueDigests: async (...args) => { calls.push(args); throw new Error('private-digest-canary'); } },
    intervalMs: 5,
    logger: { error: (...args) => events.push(args) },
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.ok(events.length > 0);
    assert.ok(events.every(args => args.length === 1 && args[0] === 'DIGEST_SCHEDULER_FAILED'));
    assert.ok(calls.length > 0);
    assert.ok(calls.every(([now, context]) => now instanceof Date && context.scheduledAt instanceof Date));
  } finally {
    scheduler.stop();
  }
});
