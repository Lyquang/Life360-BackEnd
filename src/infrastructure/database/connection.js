const mongoose = require('mongoose');

// Registers all schemas so init() below builds every collection/index before traffic.
require('./models/User');
require('./models/Group');
require('./models/FavoritePlace');
require('./models/LocationHistory');
require('./models/GroupDigest');
require('./models/Conversation');
require('./models/ConversationMember');
require('./models/ChatMessage');

async function detectTransactionSupport() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  return Boolean(hello.setName) || hello.msg === 'isdbgrid';
}

/**
 * @returns {Promise<{ supportsTransactions: boolean, usingInMemory: boolean, disconnect: () => Promise<void> }>}
 */
async function connectDatabase({ uri, isProduction, allowInMemoryFallback, logger = console }) {
  let memoryServer = null;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: isProduction ? 10000 : 3000 });
  } catch (error) {
    if (!allowInMemoryFallback) throw error;
    logger.warn(`⚠️  Could not connect to ${uri.split('@').pop()}: ${error.message}`);
    logger.warn('⚠️  Starting in-memory MongoDB replica set (data is lost on stop)...');
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(memoryServer.getUri());
  }

  const supportsTransactions = await detectTransactionSupport();
  if (!supportsTransactions && isProduction) {
    await mongoose.connection.close();
    throw new Error('MongoDB must be a replica set (e.g. Atlas) — transactions are required in production.');
  }

  await Promise.all(Object.values(mongoose.connection.models).map((model) => model.init()));

  return {
    supportsTransactions,
    usingInMemory: Boolean(memoryServer),
    async disconnect() {
      await mongoose.connection.close();
      if (memoryServer) await memoryServer.stop();
    },
  };
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, isDatabaseConnected };
