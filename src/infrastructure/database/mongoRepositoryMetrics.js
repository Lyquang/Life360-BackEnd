const { createSafeMetrics } = require('../../application/ports/metrics');

const bulkReads = new Set([
  'findByIds', 'findManyByIds', 'listByConversationIds', 'listForUserBetween',
  'listRangePage', 'listPointsAfter', 'listPointsChronological', 'listMatches',
  'listAllForSync', 'listWithDigestEnabled', 'listSummariesByMember',
  'countUnreadByConversation',
]);
const bulkWrites = new Set(['addMany', 'appendPoints', 'insertBatchIdempotent']);

function operationClass(method) {
  if (bulkReads.has(method)) return 'bulk_read';
  if (bulkWrites.has(method)) return 'bulk_write';
  if (/^(find|list|count|exists|load|usersShare)/.test(method)) return 'read';
  if (/^(create|ensure|findOrCreate|add|remove|update|mark|set|advance|record|save|delete|revoke|enforce)/.test(method)) return 'write';
  return 'other';
}

function instrumentMongoRepositories(repositories, metrics) {
  if (metrics?.enabled !== true) return repositories;
  const telemetry = createSafeMetrics(metrics);
  const instrumented = {};

  for (const [repository, methods] of Object.entries(repositories)) {
    instrumented[repository] = Object.fromEntries(Object.entries(methods).map(([method, implementation]) => {
      if (typeof implementation !== 'function') return [method, implementation];
      const operation = operationClass(method);
      return [method, function measuredRepositoryOperation(...args) {
        const startedAt = process.hrtime.bigint();
        const finish = (outcome) => {
          telemetry.increment('mongo_repository_operations_total', { operation, outcome });
          telemetry.observe('mongo_repository_duration_seconds', { operation }, Number(process.hrtime.bigint() - startedAt) / 1e9);
        };

        try {
          const result = implementation.apply(this, args);
          if (result && typeof result.then === 'function') {
            return result.then((value) => {
              finish('success');
              return value;
            }, (error) => {
              finish('error');
              throw error;
            });
          }
          finish('success');
          return result;
        } catch (error) {
          finish('error');
          throw error;
        }
      }];
    }));
  }

  return instrumented;
}

module.exports = { instrumentMongoRepositories, operationClass };
