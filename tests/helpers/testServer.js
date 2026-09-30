const assert = require('node:assert/strict');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { io: ioClient } = require('socket.io-client');
const { loadConfig } = require('../../src/config/env');
const { createServer } = require('../../src/bootstrap');

const quietLogger = { log() {}, warn() {}, error: (...args) => console.error(...args) };

const TEST_STORAGE_ENV = {
  S3_BUCKET: 'test-bucket',
  S3_REGION: 'auto',
  S3_ENDPOINT: 'https://account123.r2.cloudflarestorage.com',
  S3_ACCESS_KEY_ID: 'AKIATESTKEY',
  S3_SECRET_ACCESS_KEY: 'test-secret-key',
  S3_PUBLIC_BASE_URL: 'https://cdn.test.local',
  UPLOAD_MAX_BYTES: String(5 * 1024 * 1024),
};

/**
 * Boots the real server (in-memory MongoDB replica set → real transactions) on a random port.
 */
async function startTestServer({ withStorage = true } = {}) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const config = loadConfig({
    NODE_ENV: 'test',
    MONGODB_URI: replSet.getUri('family-tracker-test'),
    JWT_SECRET: 'test-jwt-secret',
    PORT: '0',
    AUTH_RATE_LIMIT: '10000',
    ...(withStorage && TEST_STORAGE_ENV),
  });
  const instance = await createServer(config, { logger: quietLogger });
  const port = await instance.listen(0);
  const baseUrl = `http://127.0.0.1:${port}`;
  const sockets = new Set();
  let counter = 0;

  async function api(method, path, { token, body, rawBody } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    return { status: res.status, body: await res.json() };
  }

  async function registerUser(name) {
    counter += 1;
    const { status, body } = await api('POST', '/api/v1/auth/register', {
      body: { name, email: `${name.toLowerCase()}.${counter}@test.local`, password: 'secret123' },
    });
    assert.equal(status, 201, JSON.stringify(body));
    return { id: String(body.data.user.id), token: body.data.token, name };
  }

  async function createGroup(owner, name) {
    const { status, body } = await api('POST', '/api/v1/groups', { token: owner.token, body: { name } });
    assert.equal(status, 201, JSON.stringify(body));
    return { id: String(body.data.id), inviteCode: body.data.inviteCode, conversationId: body.data.conversationId };
  }

  async function joinGroup(user, group) {
    const { status, body } = await api('POST', '/api/v1/groups/join', {
      token: user.token,
      body: { inviteCode: group.inviteCode },
    });
    assert.equal(status, 200, JSON.stringify(body));
    return body.data;
  }

  /** Resolves once the server has joined the socket to all its rooms (session:ready). */
  function connect(token) {
    return new Promise((resolve, reject) => {
      const socket = ioClient(baseUrl, {
        auth: token === undefined ? {} : { token },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      sockets.add(socket);
      socket.once('session:ready', (session) => {
        socket.session = session;
        resolve(socket);
      });
      socket.once('connect_error', (err) => {
        sockets.delete(socket);
        socket.close();
        reject(err);
      });
    });
  }

  async function disconnect(...list) {
    for (const socket of list) {
      sockets.delete(socket);
      socket.disconnect();
    }
    await sleep(100);
  }

  async function stop() {
    for (const socket of sockets) socket.disconnect();
    await sleep(200);
    await instance.close();
    await replSet.stop();
  }

  return { instance, config, baseUrl, api, registerUser, createGroup, joinGroup, connect, disconnect, stop };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForEvent(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    socket.once(event, onEvent);
  });
}

function expectNoEvent(socket, event, windowMs = 400) {
  return new Promise((resolve, reject) => {
    const onEvent = (payload) => {
      clearTimeout(timer);
      reject(new Error(`Unexpected "${event}": ${JSON.stringify(payload)}`));
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, windowMs);
    socket.once(event, onEvent);
  });
}

function emitWithAck(socket, event, payload) {
  return socket.timeout(5000).emitWithAck(event, payload);
}

module.exports = { startTestServer, waitForEvent, expectNoEvent, emitWithAck, sleep, TEST_STORAGE_ENV };
