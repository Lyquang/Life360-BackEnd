const { AsyncLocalStorage } = require('node:async_hooks');
const { randomBytes } = require('node:crypto');

const storage = new AsyncLocalStorage();
const newRequestId = () => randomBytes(16).toString('hex');
const newConnectionId = () => randomBytes(16).toString('hex');
const withLogContext = (context, callback) => storage.run(Object.freeze(context), callback);
const getLogContext = () => storage.getStore() || {};

module.exports = { newRequestId, newConnectionId, withLogContext, getLogContext };
