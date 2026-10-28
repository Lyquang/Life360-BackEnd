const { createSafeMetrics } = require('../../application/ports/metrics');

function attachMongoMetricsObserver(client, metrics) {
  if (!client || typeof client.on !== 'function' || metrics?.enabled !== true) return () => {};
  const telemetry = createSafeMetrics(metrics);

  const events = [
    ['connectionPoolCreated', 'pool_created'],
    ['connectionPoolReady', 'pool_ready'],
    ['connectionPoolClosed', 'pool_closed'],
    ['connectionCreated', 'connection_created'],
    ['connectionReady', 'connection_ready'],
    ['connectionClosed', 'connection_closed'],
    ['connectionCheckOutFailed', 'checkout_failed'],
  ];
  const listeners = events.map(([eventName, event]) => {
    const listener = () => telemetry.increment('mongo_pool_events_total', { event });
    client.on(eventName, listener);
    return [eventName, listener];
  });

  return () => {
    for (const [eventName, listener] of listeners) client.off(eventName, listener);
  };
}

module.exports = { attachMongoMetricsObserver };
