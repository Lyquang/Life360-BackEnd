const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createErrorHandler } = require('../src/presentation/http/middleware/errorHandler');
const { registerLocationGateway } = require('../src/presentation/socket/gateways/locationGateway');

function capture() {
  const entries = [];
  const append = (...args) => entries.push(args);
  return { entries, logger: { log: append, warn: append, error: append } };
}

test('HTTP unexpected errors log only the event code and preserve production response', () => {
  const { entries, logger } = capture();
  const error = new Error(randomUUID());
  error.document = { password: randomUUID(), email: randomUUID() };
  let status;
  let body;
  const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
  createErrorHandler({ isProduction: true, logger })(error, {}, res, () => {});
  assert.deepEqual(entries, [['HTTP_UNHANDLED_ERROR']]);
  assert.equal(status, 500);
  assert.equal(body.message, 'Internal Server Error');
});

test('location and SOS failures cannot export identity, coordinates or exception data to logger', async () => {
  const { entries, logger } = capture();
  const handlers = {};
  const events = [];
  const socket = {
    id: randomUUID(),
    data: { user: { id: randomUUID(), name: randomUUID() } },
    on(event, handler) { handlers[event] = handler; },
    emit(event, payload) { events.push({ event, payload }); },
  };
  const fail = async () => { throw new Error(randomUUID()); };
  registerLocationGateway(socket, { location: { updateLocation: fail, sendSos: fail }, logger });
  const payload = { latitude: Math.random(), longitude: Math.random() };
  await handlers.update_location(payload);
  await handlers.sos_alert(payload);
  assert.deepEqual(entries, [
    ['LOCATION_UPDATE_FAILED'], ['SOS_ALERT_REQUESTED'], ['SOS_ALERT_FAILED'],
  ]);
  assert.equal(events.length, 2);
  assert.ok(events.every(({ event }) => event === 'error'));
});
