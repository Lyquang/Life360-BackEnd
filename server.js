require('dotenv').config();

const { loadConfig } = require('./src/config/env');
const { createServer } = require('./src/bootstrap');

async function main() {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  let instance;
  try {
    instance = await createServer(config);
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }

  const port = await instance.listen(config.port);
  console.log('');
  console.log('🚀 Family Tracker API');
  console.log(`   Environment: ${config.env}`);
  console.log(`   Server:      ${config.publicUrl}`);
  console.log(`   REST:        ${config.publicUrl}/api/v1`);
  console.log(`   Swagger UI:  ${config.publicUrl}/api-docs`);
  console.log(`   Socket Docs: ${config.publicUrl}/api/v1/socket-info`);
  console.log(`   Transactions: ${instance.db.supportsTransactions ? 'enabled' : 'DISABLED (standalone MongoDB)'}`);
  console.log(`   Media upload: ${config.storage ? 'enabled' : 'disabled (S3_* not set)'}`);
  console.log(`   Listening:   0.0.0.0:${port}`);
  console.log('');

  // Render sends SIGTERM on deploy/restart.
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    setTimeout(() => process.exit(1), 10000).unref();
    try {
      await instance.close();
      console.log('👋 Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
