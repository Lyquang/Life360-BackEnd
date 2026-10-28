require('dotenv').config();

const { initializeTracing, shutdownTracing } = require('./src/infrastructure/observability/tracing');
initializeTracing();

const { loadConfig } = require('./src/config/env');
const { createServer } = require('./src/bootstrap');
const { createSafeLogger, createLogDestination } = require('./src/infrastructure/observability/safeLogger');

const logger = createSafeLogger({ destination: createLogDestination(process.env.LOG_FILE_PATH) });

async function main() {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    logger.error('SERVER_CONFIG_FAILED');
    process.exit(1);
  }

  let instance;
  try {
    instance = await createServer(config, { logger });
  } catch (error) {
    logger.error('SERVER_START_FAILED');
    process.exit(1);
  }

  try {
    await instance.listen(config.port);
  } catch {
    logger.error('SERVER_START_FAILED');
    await instance.close();
    process.exit(1);
  }
  logger.log('SERVER_READY');

  // Render sends SIGTERM on deploy/restart.
  const shutdown = async (signal) => {
    logger.log('SERVER_SHUTDOWN_STARTED');
    setTimeout(() => process.exit(1), 10000).unref();
    try {
      await instance.close();
      await shutdownTracing();
      logger.log('SERVER_SHUTDOWN_COMPLETE');
      process.exit(0);
    } catch (error) {
      logger.error('SERVER_SHUTDOWN_FAILED');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
